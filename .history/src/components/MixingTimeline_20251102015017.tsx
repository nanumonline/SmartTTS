import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface MixingTimelineProps {
  ttsDuration: number;
  bgmDuration: number;
  bgmOffset: number; // 음수면 TTS 전, 양수면 TTS 후
  fadeIn: number;
  fadeOut: number;
  trimEndSec?: number | null; // TTS 종료 후 BGM 종료 시간 (BGM 전체 길이)
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
  trimEndSec,
  onBgmOffsetChange,
  onFadeInChange,
  onFadeOutChange,
}) => {
  // BGM 전체 길이: TTS 종료 후 연장 시간 포함
  // trimEndSec가 있으면 그것이 BGM 전체 길이, 없으면 bgmDuration 사용
  const bgmTotalDuration = trimEndSec ?? (ttsDuration + Math.abs(bgmOffset));
  
  // BGM이 TTS보다 길어야 함 (최소한 TTS 길이 + fadeIn + fadeOut)
  const minBgmDuration = ttsDuration + fadeIn + fadeOut;
  const actualBgmDuration = Math.max(bgmTotalDuration, minBgmDuration);
  
  // 전체 타임라인 길이: BGM 전체 길이가 기준 (BGM이 항상 더 길거나 같음)
  const totalDuration = actualBgmDuration;
  const scale = 100 / Math.max(10, totalDuration); // 100%를 기준으로 스케일링

  // TTS 시작 위치 (항상 0)
  const ttsStart = 0;
  const ttsEnd = ttsDuration;
  const ttsWidth = (ttsDuration / totalDuration) * 100;

  // BGM 시작/끝 위치 계산
  // bgmOffset이 음수면 BGM이 TTS보다 먼저 시작 (예: -7.4초 = BGM이 7.4초 먼저 시작)
  const bgmStartOffset = bgmOffset < 0 ? Math.abs(bgmOffset) : 0;
  const bgmStart = bgmStartOffset; // BGM 시작 위치
  const bgmEnd = actualBgmDuration; // BGM 종료 위치
  const bgmVisualWidth = (actualBgmDuration / totalDuration) * 100;

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
          <div 
            className="relative h-8 bg-blue-600/80 rounded border-2 border-blue-400 shadow-lg"
            style={{
              width: `${ttsWidth}%`,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">TTS 음원</span>
            </div>
            {/* TTS는 페이드인/아웃 없음 */}
          </div>
        </div>

        {/* BGM 트랙 (페이드인/아웃 시각화 포함) */}
        {actualBgmDuration > 0 && (
          <div className="absolute bottom-1 left-3 right-3">
            <div 
              className="relative h-6 bg-green-600/60 rounded border border-green-400/50"
              style={{
                left: `${(bgmStart / totalDuration) * 100}%`,
                width: `${bgmVisualWidth}%`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-white">BGM</span>
              </div>
              {/* BGM 페이드인 영역 (BGM 시작 시) */}
              {fadeIn > 0 && bgmOffset < 0 && (
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-green-900/60 rounded-l border-r border-green-300/50"
                  style={{ 
                    width: `${Math.min(100, (fadeIn / Math.abs(bgmOffset)) * 100)}%`,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.8), transparent)'
                  }}
                />
              )}
              {/* BGM 페이드아웃 영역 (BGM 종료 시) */}
              {fadeOut > 0 && (
                <div 
                  className="absolute right-0 top-0 bottom-0 bg-green-900/60 rounded-r border-l border-green-300/50"
                  style={{ 
                    width: `${Math.min(100, (fadeOut / bgmDuration) * 100)}%`,
                    background: 'linear-gradient(to left, rgba(0,0,0,0.8), transparent)'
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* BGM 페이드인/아웃 슬라이더 (BGM 전용) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label style={{ color: '#E5E7EB' }} className="text-xs">BGM 페이드 인</Label>
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
          <p className="text-[10px] text-gray-500">BGM이 먼저 시작될 때 적용</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label style={{ color: '#E5E7EB' }} className="text-xs">BGM 페이드 아웃</Label>
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
          <p className="text-[10px] text-gray-500">TTS 종료 후 BGM 종료 시 적용</p>
        </div>
      </div>
    </div>
  );
};

export default MixingTimeline;

