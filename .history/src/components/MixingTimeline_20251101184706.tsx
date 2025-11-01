import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface MixingTimelineProps {
  ttsDuration: number;
  bgmDuration: number;
  bgmOffset: number; // 음수면 TTS 전, 양수면 TTS 후
  fadeIn: number;
  fadeOut: number;
  onBgmOffsetChange: (offset: number) => void;
  onFadeInChange: (fade: number) => void;
  onFadeOutChange: (fade: number) => void;
}

const MixingTimeline: React.FC<MixingTimelineProps> = ({
  ttsDuration,
  bgmDuration,
  bgmOffset,
  fadeIn,
  fadeOut,
  onBgmOffsetChange,
  onFadeInChange,
  onFadeOutChange,
}) => {
  const totalDuration = Math.max(ttsDuration, bgmDuration + Math.abs(bgmOffset));
  const scale = 100 / Math.max(10, totalDuration); // 100%를 기준으로 스케일링

  // TTS 시작 위치 (항상 0)
  const ttsStart = 0;
  const ttsEnd = ttsDuration;
  const ttsWidth = ttsDuration * scale;

  // BGM 시작/끝 위치
  const bgmStart = bgmOffset < 0 ? Math.abs(bgmOffset) : 0;
  const bgmEnd = bgmOffset < 0 ? bgmDuration - Math.abs(bgmOffset) : bgmDuration + bgmOffset;

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

        {/* TTS 트랙 (주요 - 강조, 페이드 없음) */}
        <div className="absolute top-8 left-3 right-3">
          <div className="relative h-8 bg-blue-600/80 rounded border-2 border-blue-400 shadow-lg">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">TTS 음원</span>
            </div>
            {/* TTS는 페이드인/아웃 없음 */}
          </div>
        </div>

        {/* BGM 트랙 */}
        {bgmDuration > 0 && (
          <div className="absolute bottom-1 left-3 right-3">
            <div 
              className="relative h-6 bg-green-600/60 rounded border border-green-400/50"
              style={{
                left: `${bgmStart * scale}%`,
                width: `${(bgmDuration / totalDuration) * 100}%`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-white">BGM</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 페이드인/아웃 슬라이더 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label style={{ color: '#E5E7EB' }} className="text-xs">페이드 인</Label>
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
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label style={{ color: '#E5E7EB' }} className="text-xs">페이드 아웃</Label>
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
        </div>
      </div>
    </div>
  );
};

export default MixingTimeline;

