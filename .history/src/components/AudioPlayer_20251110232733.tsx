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
  const [hasError, setHasError] = useState(false); // 에러 발생 시 컴포넌트 숨김
  const audioRef = useRef<HTMLAudioElement>(null);
  const errorRecoveryRef = useRef(false); // 에러 복원 중복 호출 방지
  const lastAudioUrlRef = useRef<string | null>(null); // 마지막으로 시도한 audioUrl 추적
  const guessedType = (() => {
    if (mimeType && typeof mimeType === 'string') return mimeType;
    const lower = (audioUrl || '').toLowerCase();
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.mp3') || lower.startsWith('blob:')) return 'audio/mpeg';
    return 'audio/mpeg';
  })();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // audioUrl이 변경되면 에러 상태 리셋
    if (audioUrl !== lastAudioUrlRef.current) {
      setHasError(false);
      errorRecoveryRef.current = false;
      lastAudioUrlRef.current = audioUrl;
    }

    // blob URL origin 확인 (fetch 없이 빠르게 확인)
    const checkBlobUrlOrigin = (url: string): boolean => {
      if (!url.startsWith('blob:')) return true; // blob URL이 아니면 유효하다고 간주
      
      try {
        const urlObj = new URL(url);
        const currentOrigin = window.location.origin;
        if (urlObj.origin !== currentOrigin) {
          console.warn('Cross-origin blob URL detected:', url);
          return false;
        }
        return true;
      } catch (e) {
        console.warn('Blob URL origin check failed:', url, e);
        return false;
      }
    };

    // audioUrl이 변경되면 src 업데이트
    // null이거나 빈 문자열인 경우 src를 명시적으로 비워서 브라우저가 접근하지 않도록 함
    if (audioUrl && audioUrl.trim() !== '' && !hasError) {
      // blob URL인 경우 origin만 확인 (fetch는 사용하지 않음 - 만료된 blob URL에 대한 fetch는 에러 발생)
      if (audioUrl.startsWith('blob:')) {
        const isValidOrigin = checkBlobUrlOrigin(audioUrl);
        if (!isValidOrigin && onError && !errorRecoveryRef.current) {
          // Cross-origin blob URL이면 즉시 재생성 시도
          console.warn('Cross-origin blob URL detected, attempting recovery:', audioUrl);
          errorRecoveryRef.current = true;
          setHasError(true);
          audio.src = ''; // 즉시 src 비우기
          audio.load();
          setTimeout(() => {
            onError();
            errorRecoveryRef.current = false;
          }, 50);
          return;
        }
        // origin이 유효하면 src 설정 (실제 만료 여부는 에러 핸들러에서 처리)
        if (audio.src !== audioUrl) {
          audio.src = audioUrl;
          audio.load(); // 새 소스 로드
        }
      } else {
        // blob URL이 아니면 바로 설정
        if (audio.src !== audioUrl) {
          audio.src = audioUrl;
          audio.load(); // 새 소스 로드
        }
      }
    } else {
      // audioUrl이 null이거나 에러 상태면 src를 빈 문자열로 설정하여 브라우저가 접근하지 않도록 함
      if (audio.src) {
        audio.src = '';
        audio.load();
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
      // 메타데이터 로드 시 duration 업데이트
      if (audio.duration && isFinite(audio.duration)) {
        setActualDuration(audio.duration);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      // 재생 완료 시 currentTime을 duration에 맞춤
      const maxTime = actualDuration || duration || 0;
      setCurrentTime(maxTime);
    };
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: any) => {
      const audio = e.target || audioRef.current;
      if (!audio) return;
      
      // 이미 복원 중이면 중복 호출 방지
      if (errorRecoveryRef.current) {
        return;
      }
      
      // blob URL 관련 오류 감지
      const isBlobUrl = audioUrl.startsWith('blob:');
      const error = e.target?.error;
      
      // ERR_REQUEST_RANGE_NOT_SATISFIABLE, ERR_FILE_NOT_FOUND 또는 일반 blob URL 오류 감지
      const isBlobError = error?.code === 4 || 
          error?.message?.includes('RANGE_NOT_SATISFIABLE') ||
          error?.message?.includes('FILE_NOT_FOUND') ||
          error?.message?.includes('Empty src attribute') ||
          error?.message?.includes('Format error') ||
          error?.name === 'NotSupportedError' ||
          audio?.networkState === 3 || // NETWORK_NO_SOURCE
          audio?.readyState === 0; // HAVE_NOTHING
      
      if (isBlobUrl && isBlobError) {
        // 에러 로그는 한 번만 출력 (중복 방지)
        if (!errorRecoveryRef.current) {
          console.warn('Blob URL expired or invalid:', audioUrl, error);
        }
        
        // 즉시 src 비우기 및 컴포넌트 숨김 (추가 에러 방지)
        errorRecoveryRef.current = true;
        setHasError(true);
        setIsLoading(false);
        setIsPlaying(false);
        audio.src = '';
        audio.load();
        
        // onError 콜백 호출하여 재생성 시도
        if (onError) {
          setTimeout(() => {
            onError();
            // 재생성 후 플래그 리셋 (약간의 지연 후)
            setTimeout(() => {
              errorRecoveryRef.current = false;
            }, 500);
          }, 100);
        } else {
          // onError가 없으면 즉시 플래그 리셋
          setTimeout(() => {
            errorRecoveryRef.current = false;
          }, 1000);
        }
      } else {
        // 일반 오류 처리
        console.warn('Audio loading/playing error:', e);
        setIsLoading(false);
        setIsPlaying(false);
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
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, onError]);

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error: any) {
        console.warn('Audio play error:', error);
        setIsPlaying(false);
        // blob URL이 만료되었을 수 있음 - onError 콜백 호출
        if (audioUrl.startsWith('blob:') && onError) {
          onError();
        } else {
          // 일반 오류는 사용자에게 알림
          console.error('Failed to play audio:', error);
        }
      }
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

  return (
    <Card className={`border-primary/20 bg-primary/5 ${className}`}>
      <CardContent className="p-4">
        <audio key={audioUrl} ref={audioRef} preload="metadata">
          {/* type 지정으로 NotSupportedError 감소 */}
          {audioUrl ? <source src={audioUrl} type={guessedType} /> : null}
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
