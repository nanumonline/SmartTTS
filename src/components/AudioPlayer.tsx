import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Download, Volume2, Clock } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
  title?: string;
  duration?: number;
  onDownload?: () => void;
  className?: string;
  onError?: () => void; // blob URL 복원을 위한 콜백
  cacheKey?: string; // 복원을 위한 cacheKey
  mimeType?: string; // 재생 소스 타입 힌트
}

const AudioPlayer = ({ 
  audioUrl, 
  title = "생성된 음성", 
  duration = 0,
  onDownload,
  className,
  onError,
  cacheKey,
  mimeType
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [actualDuration, setActualDuration] = useState<number | null>(null);
  const [isRecovering, setIsRecovering] = useState(false); // 복원 중 상태 (UI에 표시)
  const audioRef = useRef<HTMLAudioElement>(null);
  const isRecoveringRef = useRef(false); // 복원 중 중복 호출 방지
  const lastErrorTimeRef = useRef(0); // 마지막 에러 발생 시간
  const lastAudioUrlRef = useRef<string | null>(null); // 마지막 audioUrl 추적
  const recoveryTimeoutRef = useRef<number | null>(null); // 복원 타임아웃
  const blobLoadTimeoutRef = useRef<number | null>(null); // blob URL 로드 타임아웃
  const playTimeoutRef = useRef<number | null>(null); // 재생 대기 타임아웃
  const guessedType = (() => {
    if (mimeType && typeof mimeType === 'string') return mimeType;
    const url = audioUrl || '';
    if (url.startsWith('data:')) {
      const match = /^data:([^;]+)/i.exec(url);
      if (match?.[1]) {
        return match[1];
      }
    }
    const lower = url.toLowerCase();
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.ogg')) return 'audio/ogg';
    if (lower.endsWith('.flac')) return 'audio/flac';
    if (lower.endsWith('.mp3') || lower.startsWith('blob:')) return 'audio/mpeg';
    return 'audio/mpeg';
  })();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // audioUrl이 변경되면 복원 상태 리셋
    if (audioUrl !== lastAudioUrlRef.current) {
      console.log(`[AudioPlayer] audioUrl 변경: ${lastAudioUrlRef.current?.substring(0, 50)} → ${audioUrl?.substring(0, 50)}`);
      // audioUrl이 유효한 값으로 변경되면 복원 상태 강제 해제
      if (audioUrl && audioUrl.trim() !== '' && audioUrl.startsWith('blob:')) {
        // 새로운 blob URL이 설정되면 복원 상태를 즉시 해제
        isRecoveringRef.current = false;
        setIsRecovering(false);
      } else if (!audioUrl || audioUrl.trim() === '') {
        // audioUrl이 비어있으면 복원 상태 유지 (복원 대기 중)
        // 복원 상태는 유지하되, 기존 타임아웃은 클리어
      } else {
        // 일반 URL이면 복원 상태 해제
        isRecoveringRef.current = false;
        setIsRecovering(false);
      }
      lastAudioUrlRef.current = audioUrl;
      // 기존 복원 타임아웃 클리어
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      // 기존 blob 로드 타임아웃 클리어
      if (blobLoadTimeoutRef.current) {
        clearTimeout(blobLoadTimeoutRef.current);
        blobLoadTimeoutRef.current = null;
      }
    }

    // audioUrl이 빈 문자열이면 src를 비우고 리턴
    if (!audioUrl || audioUrl.trim() === '') {
      if (audio.src) {
        audio.src = '';
        audio.load();
        audio.removeAttribute('type');
      }
      // audioUrl이 없고 cacheKey가 있으면 onError 콜백 호출하여 복원 시도
      if (!audioUrl && cacheKey && onError && !isRecoveringRef.current) {
        isRecoveringRef.current = true;
        setIsRecovering(true);
        setTimeout(() => {
          onError();
        }, 100);
      }
      return;
    }

    // audioUrl이 유효한 경우에만 src 설정
    // blob URL인 경우, AudioPlayer 컴포넌트가 마운트될 때 에러가 발생할 수 있으므로
    // 에러 발생 시 onError 콜백에서 복원하도록 함
    if (audio.src !== audioUrl) {
      // audioUrl이 변경되었고 복원 중이 아니면 src 설정
      if (!isRecoveringRef.current) {
        // blob URL인 경우, 충분한 지연 후 설정하여 브라우저가 blob을 완전히 준비하도록 함
        if (audioUrl.startsWith('blob:')) {
          // 기존 타임아웃이 있으면 클리어
          if (blobLoadTimeoutRef.current) {
            clearTimeout(blobLoadTimeoutRef.current);
          }
          // PublicVoiceGenerator에서 이미 200ms 지연 후 전달하고 blob을 재구성하므로,
          // 추가로 500ms 지연하여 브라우저가 blob URL을 완전히 준비하도록 함
          // 복원 후에는 더 긴 지연 시간이 필요할 수 있음
          blobLoadTimeoutRef.current = window.setTimeout(() => {
            if (audio.src !== audioUrl && !isRecoveringRef.current && audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.setAttribute('type', guessedType);
              audioRef.current.load(); // 새 소스 로드
            }
            blobLoadTimeoutRef.current = null;
          }, 500);
        } else {
          // 일반 URL인 경우 즉시 설정
          audio.src = audioUrl;
          audio.setAttribute('type', guessedType);
          audio.load(); // 새 소스 로드
        }
      }
    }

    const updateTime = () => {
      const time = audio.currentTime;
      // 실제 duration을 가져와서 초과하지 않도록 제한
      const maxTime = actualDuration || duration || audio.duration || Infinity;
      setCurrentTime(Math.min(time, maxTime));
    };
    const handleDurationChange = () => {
      // 실제 오디오 길이 업데이트
      if (audio.duration && isFinite(audio.duration)) {
        setActualDuration(audio.duration);
      }
    };
    const handleLoadedMetadata = () => {
      console.log(`[AudioPlayer] loadedmetadata - duration: ${audio.duration}, recovering: ${isRecoveringRef.current}`);
      // 메타데이터 로드 시 duration 업데이트 및 복원 해제
      if (audio.duration && isFinite(audio.duration)) {
        setActualDuration(audio.duration);
      }
      if (isRecoveringRef.current) {
        console.log('[AudioPlayer] ✅ 복원 상태 해제 (loadedmetadata)');
        isRecoveringRef.current = false;
        setIsRecovering(false);
        if (recoveryTimeoutRef.current) {
          clearTimeout(recoveryTimeoutRef.current);
          recoveryTimeoutRef.current = null;
        }
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      // 재생 완료 시 currentTime을 duration에 맞춤
      const maxTime = actualDuration || duration || 0;
      setCurrentTime(maxTime);
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      console.log(`[AudioPlayer] canplay - recovering: ${isRecoveringRef.current}`);
      setIsLoading(false);
      // 메타데이터/재생 가능 시 복원 상태 해제
      if (isRecoveringRef.current) {
        console.log('[AudioPlayer] ✅ 복원 상태 해제 (canplay)');
        isRecoveringRef.current = false;
        setIsRecovering(false);
        if (recoveryTimeoutRef.current) {
          clearTimeout(recoveryTimeoutRef.current);
          recoveryTimeoutRef.current = null;
        }
      }
    };
    const handleError = (e: any) => {
      const audio = e.target || audioRef.current;
      if (!audio) return;
      
      // audioUrl이 없으면 에러 처리하지 않음
      if (!audioUrl || audioUrl.trim() === '') {
        return;
      }
      
      // 이미 복원 중이면 중복 호출 방지 (같은 audioUrl에 대한 에러)
      const now = Date.now();
      if (isRecoveringRef.current && (now - lastErrorTimeRef.current) < 3000) {
        // 3초 이내에 같은 에러가 반복 발생하면 무시
        console.log('[AudioPlayer] ⚠️ 복원 중 에러 무시 (중복 방지)');
        return;
      }
      
      lastErrorTimeRef.current = now;
      
      setIsLoading(false);
      setIsPlaying(false);
      audio.removeAttribute('type');
      
      // blob URL 관련 오류 감지
      const isBlobUrl = audioUrl.startsWith('blob:');
      const error = e.target?.error;
      
      console.log(`[AudioPlayer] ❌ 에러 발생:`, {
        isBlobUrl,
        errorCode: error?.code,
        errorMessage: error?.message,
        networkState: audio?.networkState,
        readyState: audio?.readyState,
        audioUrl: audioUrl?.substring(0, 80)
      });
      
      // 파일이 없는 경우 감지 (networkState: 3 = NETWORK_NO_SOURCE)
      // errorCode: 4는 MEDIA_ERR_SRC_NOT_SUPPORTED 또는 DEMUXER_ERROR
      const src = audioUrl || audio?.src || '';
      const isSampleFile = src.includes('/samples/');
      const isFileNotFound = !isBlobUrl && !audioUrl.startsWith('data:') && 
        (audio?.networkState === 3 || (error?.code === 4 && error?.message?.includes('DEMUXER_ERROR'))) && 
        (audio?.readyState === 0 || audio?.readyState === 1);
      
      if (isFileNotFound) {
        // 중복 호출 방지: 같은 오류가 이미 처리되었는지 확인
        const errorKey = `file-not-found-${src}`;
        if (lastErrorTimeRef.current && (now - lastErrorTimeRef.current) < 1000) {
          // 1초 이내에 같은 오류가 발생하면 무시
          console.log('[AudioPlayer] ⚠️ 파일 없음 오류 무시 (중복 방지)');
          return;
        }
        
        console.warn('[AudioPlayer] ⚠️ 파일이 없거나 소스를 찾을 수 없습니다:', {
          audioUrl: src.substring(0, 100),
          networkState: audio?.networkState,
          readyState: audio?.readyState,
          errorCode: error?.code,
          isSampleFile
        });
        
        // 샘플 파일 경로인 경우 더 명확한 메시지
        if (isSampleFile) {
          handlePlayError(new Error('샘플 오디오 파일을 찾을 수 없습니다. 샘플 생성 페이지에서 파일을 먼저 생성해주세요.'));
        } else {
          handlePlayError(new Error('오디오 파일을 찾을 수 없습니다.'));
        }
        return;
      }
      
      // ERR_REQUEST_RANGE_NOT_SATISFIABLE 또는 일반 blob URL 오류 감지
      const isBlobError = isBlobUrl && (error?.code === 4 || 
          error?.message?.includes('RANGE_NOT_SATISFIABLE') ||
          error?.message?.includes('FILE_NOT_FOUND') ||
          error?.message?.includes('Format error') ||
          error?.name === 'NotSupportedError' ||
          audio?.networkState === 3 || // NETWORK_NO_SOURCE
          audio?.readyState === 0); // HAVE_NOTHING
      
      if (isBlobError) {
        // 복원 중 상태로 전환 (추가 에러 방지)
        if (!isRecoveringRef.current) {
          console.log('[AudioPlayer] 🔄 blob 에러 감지 - 복원 시작');
          isRecoveringRef.current = true;
          setIsRecovering(true);
          
          // 즉시 src 비우기 (추가 에러 방지)
          audio.src = '';
          audio.load();
          
          // 복원 시도 (onError 콜백 호출)
          if (onError) {
            // 약간의 지연 후 복원 시도 (상태 업데이트 시간 확보)
            setTimeout(() => {
              console.log('[AudioPlayer] 📞 onError 콜백 호출');
              onError();
            }, 100);
            
            // 3초 후에도 복원되지 않으면 타임아웃 (더 짧게 설정)
            recoveryTimeoutRef.current = window.setTimeout(() => {
              if (isRecoveringRef.current) {
                console.warn('[AudioPlayer] ⏱️ 음원 복원 타임아웃 (3초)');
                isRecoveringRef.current = false;
                setIsRecovering(false);
                // 타임아웃 시 src를 비워서 추가 에러 방지
                if (audioRef.current) {
                  audioRef.current.src = '';
                  audioRef.current.load();
                }
              }
            }, 3000); // 5초에서 3초로 단축
          } else {
            console.log('[AudioPlayer] ⚠️ onError 콜백 없음 - 복원 불가');
            // onError가 없으면 즉시 복원 상태 해제
            setTimeout(() => {
              isRecoveringRef.current = false;
              setIsRecovering(false);
            }, 1000);
          }
        }
      } else if (isBlobUrl && onError && !isRecoveringRef.current) {
        // 다른 blob URL 오류도 복원 시도
        console.log('[AudioPlayer] 🔄 blob URL 일반 에러 - 복원 시작');
        isRecoveringRef.current = true;
        setIsRecovering(true);
        audio.src = '';
        audio.load();
        setTimeout(() => {
          console.log('[AudioPlayer] 📞 onError 콜백 호출 (일반)');
          onError();
        }, 100);
        
        // 3초 후에도 복원되지 않으면 타임아웃
        recoveryTimeoutRef.current = window.setTimeout(() => {
          if (isRecoveringRef.current) {
            console.warn('[AudioPlayer] ⏱️ 음원 복원 타임아웃 (일반, 3초)');
            isRecoveringRef.current = false;
            setIsRecovering(false);
            // 타임아웃 시 src를 비워서 추가 에러 방지
            if (audioRef.current) {
              audioRef.current.src = '';
              audioRef.current.load();
            }
          }
        }, 3000); // 5초에서 3초로 단축
      } else {
        // 일반 오류는 로그만 출력 (복원 시도하지 않음)
        console.warn('[AudioPlayer] ⚠️ 일반 오디오 에러 (복원 안함):', e);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('error', handleError);

    // 초기 duration 설정
    if (audio.duration && isFinite(audio.duration)) {
      setActualDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      
      // 복원 타임아웃 클리어
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      // blob 로드 타임아웃 클리어
      if (blobLoadTimeoutRef.current) {
        clearTimeout(blobLoadTimeoutRef.current);
        blobLoadTimeoutRef.current = null;
      }
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, onError, isRecovering]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // 오디오 소스 유효성 확인
      if (!audioUrl || audioUrl.trim() === '') {
        console.warn('[AudioPlayer] 오디오 URL이 없습니다.');
        if (cacheKey && onError && !isRecoveringRef.current) {
          // URL이 없고 cacheKey가 있으면 복원 시도
          isRecoveringRef.current = true;
          setIsRecovering(true);
          onError();
        }
        return;
      }

      // audio.src가 설정되지 않았거나 다른 경우 재설정
      // 브라우저는 상대 경로를 절대 URL로 변환하므로, 실제 URL 비교 시 이를 고려
      const currentSrcNormalized = audio.src ? new URL(audio.src, window.location.origin).pathname : '';
      const expectedUrlNormalized = audioUrl.startsWith('http') 
        ? new URL(audioUrl, window.location.origin).pathname 
        : audioUrl;
      
      if (!audio.src || currentSrcNormalized !== expectedUrlNormalized) {
        console.log('[AudioPlayer] src 재설정 (재생 요청):', { 
          currentSrc: audio.src?.substring(0, 50) || '없음', 
          expectedUrl: audioUrl.substring(0, 50),
          normalized: { current: currentSrcNormalized, expected: expectedUrlNormalized }
        });
        try {
          // audioUrl이 유효한지 확인
          // 허용되는 형식: blob:, data:, http:, https:, 상대 경로(/로 시작)
          const isValidUrl = audioUrl.match(/^(blob:|data:|https?:|\/)/i);
          if (!isValidUrl && !audioUrl.startsWith('./') && !audioUrl.startsWith('../')) {
            // 상대 경로도 허용 (./ 또는 ../로 시작하거나 /로 시작)
            throw new Error(`유효하지 않은 오디오 URL 형식: ${audioUrl.substring(0, 50)}`);
          }
          audio.src = audioUrl;
          audio.setAttribute('type', guessedType);
          audio.load();
        } catch (error: any) {
          console.error('[AudioPlayer] src 설정 실패:', error);
          setIsLoading(false);
          // blob URL이 만료되었을 수 있음
          if ((audioUrl.startsWith('blob:') || audioUrl.startsWith('data:')) && onError && !isRecoveringRef.current) {
            isRecoveringRef.current = true;
            setIsRecovering(true);
            onError();
          } else {
            handlePlayError(new Error(`오디오 소스를 설정할 수 없습니다: ${error?.message || '알 수 없는 오류'}`));
          }
          return;
        }
        // 로드 후 재생을 위해 아래 로직으로 진행
      }

      // 오디오 로드 상태 확인 및 재생
      const attemptPlay = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
          setIsLoading(false);
      } catch (error: any) {
          console.warn('[AudioPlayer] 재생 오류:', error);
        setIsPlaying(false);
          setIsLoading(false);
          handlePlayError(error);
        }
      };

      // readyState 확인
      // 0: HAVE_NOTHING - 정보 없음
      // 1: HAVE_METADATA - 메타데이터만 로드됨
      // 2: HAVE_CURRENT_DATA - 현재 위치의 데이터 있음
      // 3: HAVE_FUTURE_DATA - 현재 및 미래 데이터 있음
      // 4: HAVE_ENOUGH_DATA - 재생 가능
      
      if (audio.readyState >= 2) {
        // 이미 충분한 데이터가 로드된 경우 바로 재생
        await attemptPlay();
      } else if (audio.readyState === 1) {
        // 메타데이터만 로드된 경우, canplay 이벤트 대기
        setIsLoading(true);
        const handleCanPlay = () => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleLoadError);
          attemptPlay();
        };
        
        const handleLoadError = (e: any) => {
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleLoadError);
          setIsLoading(false);
          const error = e.target?.error;
          const src = audio.src || audioUrl || '';
          const isSampleFile = src.includes('/samples/');
          
          console.error('[AudioPlayer] 오디오 로드 실패:', {
            errorCode: error?.code,
            errorMessage: error?.message,
            networkState: audio.networkState,
            readyState: audio.readyState,
            src: src.substring(0, 100)
          });
          
          // 샘플 파일이 없을 때 더 명확한 메시지
          if (isSampleFile && (error?.code === 4 || error?.message?.includes('DEMUXER_ERROR'))) {
            handlePlayError(new Error(`샘플 오디오 파일을 찾을 수 없습니다. 샘플 생성 페이지에서 파일을 먼저 생성해주세요.`));
          } else {
            handlePlayError(new Error(`오디오를 로드할 수 없습니다. (${error?.message || '알 수 없는 오류'})`));
          }
        };

        audio.addEventListener('canplay', handleCanPlay, { once: true });
        audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
        audio.addEventListener('error', handleLoadError, { once: true });
        
        // 파일이 없는 경우 빠르게 감지하기 위한 짧은 체크 (2초)
        const quickCheckTimeout = window.setTimeout(() => {
          // networkState: 3 (NETWORK_NO_SOURCE)이면 파일이 없음
          if (audio.networkState === 3 && (audio.readyState === 0 || audio.readyState === 1)) {
            // 파일이 없는 것으로 판단
            const src = audio.src || audioUrl || '';
            const isSampleFile = src.includes('/samples/');
            
            console.warn('[AudioPlayer] 파일이 없는 것으로 감지 (빠른 체크, readyState=1):', {
              networkState: audio.networkState,
              readyState: audio.readyState,
              src: src.substring(0, 100)
            });
            
            // 이벤트 리스너 제거
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleLoadError);
            
            if (playTimeoutRef.current) {
              clearTimeout(playTimeoutRef.current);
              playTimeoutRef.current = null;
            }
            
            setIsLoading(false);
            
            // 샘플 파일인 경우 더 명확한 메시지
            if (isSampleFile) {
              handlePlayError(new Error('샘플 오디오 파일을 찾을 수 없습니다. 샘플 생성 페이지에서 파일을 먼저 생성해주세요.'));
            } else {
              handlePlayError(new Error('오디오 파일을 찾을 수 없습니다.'));
            }
          }
        }, 2000); // 2초 후 빠른 체크
        
        // 타임아웃 설정 (10초)
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
        }
        playTimeoutRef.current = window.setTimeout(() => {
          clearTimeout(quickCheckTimeout); // 빠른 체크 타임아웃도 클리어
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleLoadError);
          setIsLoading(false);
          playTimeoutRef.current = null;
          if (audio.readyState < 2) {
            const src = audio.src || audioUrl || '';
            const isSampleFile = src.includes('/samples/');
            
            console.error('[AudioPlayer] 오디오 로드 타임아웃:', {
              readyState: audio.readyState,
              networkState: audio.networkState,
              src: src.substring(0, 100)
            });
            
            // 샘플 파일인 경우 더 명확한 메시지
            if (isSampleFile && audio.networkState === 3) {
              handlePlayError(new Error('샘플 오디오 파일을 찾을 수 없습니다. 샘플 생성 페이지에서 파일을 먼저 생성해주세요.'));
            } else {
              handlePlayError(new Error('오디오 로드 시간 초과'));
            }
          }
        }, 10000);
      } else {
        // HAVE_NOTHING (0) - 아직 로드되지 않음
        setIsLoading(true);
        const handleLoadedData = () => {
          audio.removeEventListener('loadeddata', handleLoadedData);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleLoadError);
          attemptPlay();
        };
        
        const handleCanPlay = () => {
          audio.removeEventListener('loadeddata', handleLoadedData);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleLoadError);
          attemptPlay();
        };
        
        const handleLoadError = (e: any) => {
          audio.removeEventListener('loadeddata', handleLoadedData);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleLoadError);
          setIsLoading(false);
          const error = e.target?.error;
          const src = audio.src || audioUrl || '';
          const isSampleFile = src.includes('/samples/');
          
          console.error('[AudioPlayer] 오디오 로드 실패:', {
            errorCode: error?.code,
            errorMessage: error?.message,
            networkState: audio.networkState,
            readyState: audio.readyState,
            src: src.substring(0, 100)
          });
          
          // 샘플 파일이 없을 때 더 명확한 메시지
          if (isSampleFile && (error?.code === 4 || error?.message?.includes('DEMUXER_ERROR'))) {
            handlePlayError(new Error(`샘플 오디오 파일을 찾을 수 없습니다. 샘플 생성 페이지에서 파일을 먼저 생성해주세요.`));
          } else {
            handlePlayError(new Error(`오디오를 로드할 수 없습니다. (${error?.message || '알 수 없는 오류'})`));
          }
        };

        audio.addEventListener('loadeddata', handleLoadedData, { once: true });
        audio.addEventListener('canplay', handleCanPlay, { once: true });
        audio.addEventListener('canplaythrough', handleCanPlay, { once: true });
        audio.addEventListener('error', handleLoadError, { once: true });
        
        // 파일이 없는 경우 빠르게 감지하기 위한 짧은 체크 (2초)
        const quickCheckTimeout = window.setTimeout(() => {
          if (audio.networkState === 3 && audio.readyState === 0) {
            // 파일이 없는 것으로 판단
            const src = audio.src || audioUrl || '';
            const isSampleFile = src.includes('/samples/');
            
            console.warn('[AudioPlayer] 파일이 없는 것으로 감지 (빠른 체크):', {
              networkState: audio.networkState,
              readyState: audio.readyState,
              src: src.substring(0, 100)
            });
            
            // 이벤트 리스너 제거
            audio.removeEventListener('loadeddata', handleLoadedData);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('error', handleLoadError);
            
            if (playTimeoutRef.current) {
              clearTimeout(playTimeoutRef.current);
              playTimeoutRef.current = null;
            }
            
            setIsLoading(false);
            
            // 샘플 파일인 경우 더 명확한 메시지
            if (isSampleFile) {
              handlePlayError(new Error('샘플 오디오 파일을 찾을 수 없습니다. 샘플 생성 페이지에서 파일을 먼저 생성해주세요.'));
            } else {
              handlePlayError(new Error('오디오 파일을 찾을 수 없습니다.'));
            }
          }
        }, 2000); // 2초 후 빠른 체크
        
        // 타임아웃 설정 (10초)
        if (playTimeoutRef.current) {
          clearTimeout(playTimeoutRef.current);
        }
        playTimeoutRef.current = window.setTimeout(() => {
          clearTimeout(quickCheckTimeout); // 빠른 체크 타임아웃도 클리어
          audio.removeEventListener('loadeddata', handleLoadedData);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlay);
          audio.removeEventListener('error', handleLoadError);
          setIsLoading(false);
          playTimeoutRef.current = null;
          if (audio.readyState < 2) {
            const src = audio.src || audioUrl || '';
            const isSampleFile = src.includes('/samples/');
            
            console.error('[AudioPlayer] 오디오 로드 타임아웃:', {
              readyState: audio.readyState,
              networkState: audio.networkState,
              src: src.substring(0, 100)
            });
            
            // 샘플 파일인 경우 더 명확한 메시지
            if (isSampleFile && audio.networkState === 3) {
              handlePlayError(new Error('샘플 오디오 파일을 찾을 수 없습니다. 샘플 생성 페이지에서 파일을 먼저 생성해주세요.'));
            } else {
              handlePlayError(new Error('오디오 로드 시간 초과'));
            }
          }
        }, 10000);
      }
    }
  };

  const handlePlayError = (error: any) => {
        // blob URL이 만료되었을 수 있음 - onError 콜백 호출
    if (audioUrl && (audioUrl.startsWith('blob:') || audioUrl.startsWith('data:')) && onError && !isRecoveringRef.current) {
          isRecoveringRef.current = true;
          onError();
          setTimeout(() => {
            isRecoveringRef.current = false;
          }, 1000);
        } else {
          // 일반 오류는 사용자에게 알림
      console.error('[AudioPlayer] 오디오 재생 실패:', error);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // 실제 duration 사용
    const maxDuration = actualDuration || duration || audio.duration || 0;
    if (!maxDuration || !isFinite(maxDuration)) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width)); // 0-1 사이로 제한
    const newTime = percentage * maxDuration;
    
    audio.currentTime = Math.min(newTime, maxDuration); // duration 초과 방지
    setCurrentTime(Math.min(newTime, maxDuration));
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time) || time < 0) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // 실제 duration 사용 (prop duration보다 우선)
  const displayDuration = actualDuration || duration || 0;
  // currentTime이 duration을 초과하지 않도록 제한
  const clampedCurrentTime = displayDuration > 0 
    ? Math.max(0, Math.min(currentTime, displayDuration))
    : currentTime;
  // 프로그레스 퍼센트 계산 (0-100%로 제한)
  const progressPercentage = displayDuration > 0 
    ? Math.max(0, Math.min(100, (clampedCurrentTime / displayDuration) * 100))
    : 0;

  // 복원 중이면 로딩 상태 표시
  if (isRecovering) {
    return (
      <Card className={`border-primary/20 bg-primary/5 ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current mx-auto mb-2" />
              <p className="text-sm">음원 복원 중...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className}`}>
      <CardContent className="p-4">
        <audio 
          key={audioUrl} 
          ref={audioRef} 
          preload={audioUrl.startsWith('blob:') ? 'auto' : 'metadata'}
        >
          {/* type 지정으로 NotSupportedError 감소 */}
          <source src={audioUrl} type={guessedType} />
        </audio>
            
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(clampedCurrentTime)} / {formatTime(displayDuration)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={togglePlayPause}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                
                {onDownload && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onDownload}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div 
                className="w-full h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
                onClick={handleProgressClick}
              >
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-100"
                  style={{ width: `${progressPercentage}%`, maxWidth: '100%' }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTime(clampedCurrentTime)}</span>
                <span>{formatTime(displayDuration)}</span>
              </div>
            </div>
      </CardContent>
    </Card>
  );
};

export default AudioPlayer;
