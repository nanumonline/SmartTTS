import { supabase } from "@/integrations/supabase/client";

// 음성 생성 API 서비스
export interface VoiceSettings {
  emotion: {
    type: string;
    preset: string;
    customPrompt: string;
  };
  readingSpeed: {
    preset: string;
    customTime: string;
  };
  pause: {
    duration: number;
    segments: Array<{ start: number; end: number; duration: number }>;
  };
  endingTone: {
    mode: string;
  };
  playbackSpeed: number;
  pitch: number;
}

export interface VoiceGenerationRequest {
  text: string;
  voice: string;
  settings: VoiceSettings;
  organization?: string;
  department?: string;
}

export interface VoiceGenerationResponse {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

// Supertone TTS API 서비스
class VoiceGenerationService {
  async generateVoice(request: VoiceGenerationRequest): Promise<VoiceGenerationResponse> {
    try {
      console.log('음성 생성 요청:', request);
      
      // Supertone API 요청 파라미터 구성
      const apiRequest = {
        text: request.text,
        speed: request.settings.playbackSpeed,
        pitch: request.settings.pitch,
        voice_id: request.voice, // voice_id 추가
      };

      // Edge Function을 통해 Supertone API 호출
      const { data, error } = await supabase.functions.invoke('supertone-proxy/text-to-speech', {
        body: apiRequest,
      });

      if (error) {
        console.error('음성 생성 오류:', error);
        return {
          success: false,
          error: error.message || '음성 생성 중 오류가 발생했습니다.'
        };
      }

      // base64로 인코딩된 오디오 데이터 처리
      if (data && data.audioData) {
        try {
          // base64 디코딩
          const binaryString = atob(data.audioData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Blob 생성 (MIME type 자동 판별 + 서버 보고값 활용)
          const detectMime = (b: Uint8Array): string | null => {
            if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45) return 'audio/wav';
            if (b.length >= 4 && b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
            if (b.length >= 4 && b[0] === 0x66 && b[1] === 0x4C && b[2] === 0x61 && b[3] === 0x43) return 'audio/flac';
            if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'audio/mp4';
            if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg';
            if (b.length >= 2 && b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return 'audio/mpeg';
            if (b.length >= 4 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'audio/webm';
            return null;
          };
          const detectedMime = detectMime(bytes);
          const mimeType = detectedMime || data.contentType || 'audio/mpeg';
          const audioBlob = new Blob([bytes], { type: mimeType });
          
          console.log('음성 생성 완료:', {
            blobSize: audioBlob.size,
            mimeType: mimeType,
            detectedMime,
            reportedContentType: data.contentType,
            audioLength: data.audioLength
          });
          
          // blob 크기가 0이면 에러
          if (audioBlob.size === 0) {
            throw new Error('생성된 오디오 데이터가 비어있습니다.');
          }
          
          const audioUrl = URL.createObjectURL(audioBlob);
          return {
            success: true,
            audioUrl,
            duration: data.audioLength || this.calculateDuration(request.text, request.settings)
          };
        } catch (decodeError: any) {
          console.error('오디오 디코딩 오류:', decodeError);
          return {
            success: false,
            error: `오디오 디코딩 실패: ${decodeError.message}`
          };
        }
      }

      return {
        success: false,
        error: '올바른 오디오 데이터를 받지 못했습니다.'
      };
    } catch (error: any) {
      console.error('음성 생성 예외:', error);
      return {
        success: false,
        error: error.message || '음성 생성 중 오류가 발생했습니다.'
      };
    }
  }


  private calculateDuration(text: string, settings: VoiceSettings): number {
    const baseDuration = text.length * 0.1; // 기본 0.1초 per character
    const speedMultiplier = this.getSpeedMultiplier(settings.readingSpeed);
    const pauseTime = settings.pause.duration * (text.split(' ').length - 1);
    
    return Math.round((baseDuration / speedMultiplier + pauseTime) * 100) / 100;
  }

  private getSpeedMultiplier(readingSpeed: { preset: string; customTime: string }): number {
    switch (readingSpeed.preset) {
      case '느림': return 0.7;
      case '빠름': return 1.3;
      default: return 1.0;
    }
  }

  async getAvailableVoices() {
    return [
      {
        id: 'male_anchor_1',
        name: '앵커 스타일 남성 1',
        description: '뉴스 앵커 톤 - 도지사, 시장용',
        category: '남성',
        isPro: false,
        previewUrl: '/audio/previews/male_anchor_1.wav'
      },
      {
        id: 'male_anchor_2',
        name: '앵커 스타일 남성 2',
        description: '정치 앵커 톤 - 도지사, 시장용',
        category: '남성',
        isPro: false,
        previewUrl: '/audio/previews/male_anchor_2.wav'
      },
      {
        id: 'female_anchor_1',
        name: '아나운서 스타일 여성 1',
        description: '뉴스 아나운서 톤 - 부시장, 부지사용',
        category: '여성',
        isPro: false,
        previewUrl: '/audio/previews/female_anchor_1.wav'
      },
      {
        id: 'female_weather_1',
        name: '기상 아나운서 스타일',
        description: '기상청 아나운서 톤 - 부시장, 부지사용',
        category: '여성',
        isPro: true,
        previewUrl: '/audio/previews/female_weather_1.wav'
      }
    ];
  }

  async downloadAudio(audioUrl: string, filename: string) {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: '다운로드 중 오류가 발생했습니다.' };
    }
  }
}

export const voiceGenerationService = new VoiceGenerationService();
