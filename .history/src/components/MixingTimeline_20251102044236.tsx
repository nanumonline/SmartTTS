import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface MixingTimelineProps {
  ttsDuration: number;
  bgmDuration: number;
  bgmOffset: number; // TTS 시작 전 BGM 시작 오프셋 (양수: BGM이 TTS보다 먼저 시작하는 시간)
  fadeIn: number;
  fadeOut: number;
  fadeInRatio?: number; // 페이드인 음원증감 비율 (0-100, 기본값: 100)
  fadeOutRatio?: number; // 페이드아웃 음원증감 비율 (0-100, 기본값: 100)
  bgmOffsetAfterTts?: number; // TTS 종료 후 BGM 연장 시간 (양수: TTS 종료 후 BGM이 추가로 재생되는 시간)
  onBgmOffsetChange: (offset: number) => void;
  onFadeInChange: (fade: number) => void;
  onFadeOutChange: (fade: number) => void;
  onFadeInRatioChange?: (ratio: number) => void;
  onFadeOutRatioChange?: (ratio: number) => void;
  onBgmOffsetAfterTtsChange?: (offset: number) => void;
}

const MixingTimeline: React.FC<MixingTimelineProps> = ({
  ttsDuration,
  bgmDuration,
  bgmOffset, // TTS 시작 전 BGM 시작 오프셋 (양수)
  fadeIn,
  fadeOut,
  fadeInRatio = 100, // 페이드인 음원증감 비율 (0-100, 기본값: 100)
  fadeOutRatio = 100, // 페이드아웃 음원증감 비율 (0-100, 기본값: 100)
  bgmOffsetAfterTts = 0, // TTS 종료 후 BGM 연장 시간 (양수)
  onBgmOffsetChange,
  onFadeInChange,
  onFadeOutChange,
  onFadeInRatioChange,
  onFadeOutRatioChange,
  onBgmOffsetAfterTtsChange,
}) => {
  // BGM은 항상 0초부터 고정 시작
  // BGM 전체 길이 = fadeIn + bgmOffset (TTS 시작 전) + ttsDuration + bgmOffsetAfterTts (TTS 후) + fadeOut
  const bgmTotalDuration = fadeIn + bgmOffset + ttsDuration + bgmOffsetAfterTts + fadeOut;
  
  // 실제 BGM 길이는 계산된 값과 bgmDuration 중 큰 값 사용 (최소 보장)
  const actualBgmDuration = Math.max(bgmTotalDuration, bgmDuration);
  
  // 전체 타임라인 길이: BGM 전체 길이가 기준
  const totalDuration = actualBgmDuration;
  const scale = 100 / Math.max(10, totalDuration); // 100%를 기준으로 스케일링

  // BGM은 항상 0초부터 시작 (고정)
  const bgmStart = 0;
  const bgmEnd = actualBgmDuration;
  const bgmVisualWidth = (actualBgmDuration / totalDuration) * 100;
  const bgmLeft = 0; // BGM은 항상 0% 위치부터 시작

  // TTS 시작 위치: fadeIn + bgmOffset (BGM 바 위에서 이동)
  const ttsStart = fadeIn + bgmOffset;
  const ttsEnd = ttsStart + ttsDuration;
  const ttsWidth = (ttsDuration / totalDuration) * 100;
  const ttsLeft = (ttsStart / totalDuration) * 100; // TTS 시작 위치 (%)
  
  // 페이드인/아웃 영역 계산
  const fadeInWidth = fadeIn > 0 ? (fadeIn / actualBgmDuration) * 100 : 0;
  const fadeOutStart = ttsEnd + bgmOffsetAfterTts; // TTS 종료 + 연장 시간 후 페이드아웃 시작
  const fadeOutWidth = fadeOut > 0 ? (fadeOut / actualBgmDuration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* 타임라인 시각화 */}
      <div className="relative h-24 bg-gray-900/50 rounded-lg p-3 border border-gray-700">
        {/* 시간 축 */}
        <div className="absolute top-1 left-3 right-3 h-0.5 bg-gray-600" />
        {[0, Math.floor(totalDuration / 4), Math.floor(totalDuration / 2), Math.floor(totalDuration * 3 / 4), Math.floor(totalDuration)].map((t) => (
          <div key={t} className="absolute top-0" style={{ left: `${3 + (t * scale)}%` }}>
            <div className="w-px h-2 bg-gray-500" />
            <span className="text-[10px] text-gray-400 ml-0.5">{t.toFixed(1)}s</span>
          </div>
        ))}

        {/* BGM 트랙 (고정, 하단에 배치) */}
        {actualBgmDuration > 0 && (
          <div className="absolute bottom-1 left-3 right-3">
            <div 
              className="relative h-6 bg-green-600/60 rounded border border-green-400/50"
              style={{
                left: `${bgmLeft}%`,
                width: `${bgmVisualWidth}%`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-white">BGM</span>
              </div>
              {/* BGM 페이드인 영역 (0초부터) */}
              {fadeIn > 0 && (
                <div 
                  className="absolute left-0 top-0 bottom-0 rounded-l border-r border-green-300/50"
                  style={{ 
                    width: `${fadeInWidth}%`,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.8), transparent)'
                  }}
                />
              )}
              {/* BGM 페이드아웃 영역 (TTS 종료 + 연장 후) */}
              {fadeOut > 0 && (
                <div 
                  className="absolute right-0 top-0 bottom-0 rounded-r border-l border-green-300/50"
                  style={{ 
                    width: `${fadeOutWidth}%`,
                    background: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)'
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* TTS 트랙 (BGM 위에서 이동, 상단에 배치) */}
        <div className="absolute top-8 left-3 right-3">
          <div 
            className="relative h-8 bg-blue-600/80 rounded border-2 border-blue-400 shadow-lg z-10"
            style={{
              left: `${ttsLeft}%`,
              width: `${ttsWidth}%`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">TTS 음원 ({ttsDuration.toFixed(1)}s)</span>
            </div>
            {/* TTS는 페이드인/아웃 없음 */}
          </div>
        </div>
      </div>

      {/* BGM 페이드인/아웃 슬라이더 (시간 + 음원증감 비율) */}
      <div className="space-y-4">
        {/* 페이드인 */}
        <div className="space-y-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          <Label style={{ color: '#E5E7EB' }} className="text-xs font-semibold">BGM 페이드 인</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label style={{ color: '#E5E7EB' }} className="text-xs">페이드 인 시간</Label>
                <span className="text-xs text-gray-400">{fadeIn.toFixed(2)}s</span>
              </div>
              <Slider
                value={[fadeIn * 10]}
                onValueChange={(values) => onFadeInChange(values[0] / 10)}
                min={0}
                max={50}
                step={0.5}
                className="w-full"
              />
              <p className="text-[10px] text-gray-500">페이드인 지속 시간</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label style={{ color: '#E5E7EB' }} className="text-xs">음원증감 비율</Label>
                <span className="text-xs text-gray-400">{fadeInRatio.toFixed(0)}%</span>
              </div>
              <Slider
                value={[fadeInRatio]}
                onValueChange={(values) => onFadeInRatioChange?.(values[0])}
                min={0}
                max={100}
                step={1}
                className="w-full"
                disabled={!onFadeInRatioChange}
              />
              <p className="text-[10px] text-gray-500">페이드인 목표 음량 비율 (0% → 설정값%)</p>
            </div>
          </div>
        </div>
        
        {/* 페이드아웃 */}
        <div className="space-y-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700">
          <Label style={{ color: '#E5E7EB' }} className="text-xs font-semibold">BGM 페이드 아웃</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label style={{ color: '#E5E7EB' }} className="text-xs">페이드 아웃 시간</Label>
                <span className="text-xs text-gray-400">{fadeOut.toFixed(2)}s</span>
              </div>
              <Slider
                value={[fadeOut * 10]}
                onValueChange={(values) => onFadeOutChange(values[0] / 10)}
                min={0}
                max={50}
                step={0.5}
                className="w-full"
              />
              <p className="text-[10px] text-gray-500">페이드아웃 지속 시간</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label style={{ color: '#E5E7EB' }} className="text-xs">음원증감 비율</Label>
                <span className="text-xs text-gray-400">{fadeOutRatio.toFixed(0)}%</span>
              </div>
              <Slider
                value={[fadeOutRatio]}
                onValueChange={(values) => onFadeOutRatioChange?.(values[0])}
                min={0}
                max={100}
                step={1}
                className="w-full"
                disabled={!onFadeOutRatioChange}
              />
              <p className="text-[10px] text-gray-500">페이드아웃 시작 음량 비율 (50% = 기본 볼륨, 0% = 감소, 100% = 증가)</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* BGM 시작/종료 오프셋 슬라이더 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label style={{ color: '#E5E7EB' }} className="text-xs">BGM 시작: TTS 전</Label>
            <span className="text-xs text-gray-400">{bgmOffset.toFixed(1)}초</span>
          </div>
          <Slider
            value={[bgmOffset * 10]}
            onValueChange={(values) => onBgmOffsetChange(values[0] / 10)}
            min={0}
            max={100}
            step={0.5}
            className="w-full"
          />
          <p className="text-[10px] text-gray-500">BGM이 TTS보다 먼저 시작하는 시간</p>
        </div>
        {onBgmOffsetAfterTtsChange && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label style={{ color: '#E5E7EB' }} className="text-xs">BGM 종료: TTS 후</Label>
              <span className="text-xs text-gray-400">{bgmOffsetAfterTts.toFixed(1)}초</span>
            </div>
            <Slider
              value={[bgmOffsetAfterTts * 10]}
              onValueChange={(values) => onBgmOffsetAfterTtsChange(values[0] / 10)}
              min={0}
              max={100}
              step={0.5}
              className="w-full"
            />
            <p className="text-[10px] text-gray-500">TTS 종료 후 BGM이 추가로 재생되는 시간</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MixingTimeline;

