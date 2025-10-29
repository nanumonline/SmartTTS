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

// Mock TTS API 서비스
class VoiceGenerationService {
  private baseUrl = 'https://api.example-tts.com/v1';

  async generateVoice(request: VoiceGenerationRequest): Promise<VoiceGenerationResponse> {
    try {
      // 실제 API 호출 시뮬레이션
      console.log('음성 생성 요청:', request);
      
      // 로딩 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
      
      // 성공 응답 시뮬레이션
      const audioUrl = `data:audio/wav;base64,${this.generateMockAudioData()}`;
      
      return {
        success: true,
        audioUrl,
        duration: this.calculateDuration(request.text, request.settings)
      };
    } catch (error) {
      return {
        success: false,
        error: '음성 생성 중 오류가 발생했습니다.'
      };
    }
  }

  private generateMockAudioData(): string {
    // 실제로는 서버에서 생성된 오디오 데이터를 받아옴
    return 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzqO0fPTgjMGHm7A7+OZURE='; // Mock base64 audio data
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
