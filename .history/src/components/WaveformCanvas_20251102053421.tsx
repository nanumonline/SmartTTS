import { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  audioBuffer: AudioBuffer | null | undefined;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  showGrid?: boolean;
}

export default function WaveformCanvas({ 
  audioBuffer, 
  width = 800, 
  height = 200,
  color = '#3b82f6',
  backgroundColor = '#1f2937',
  showGrid = true
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) {
      // 버퍼가 없으면 캔버스 초기화만
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, width, height);
        }
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 초기화
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // 그리드 그리기
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      // 수평선 (5개)
      for (let i = 1; i < 5; i++) {
        const y = (height / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      // 수직선 (10개)
      for (let i = 1; i < 10; i++) {
        const x = (width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // 오디오 데이터 추출
    const channelData = audioBuffer.getChannelData(0); // 첫 번째 채널만 사용
    const bufferLength = channelData.length;
    const samplesPerPixel = Math.max(1, Math.floor(bufferLength / width));
    
    // 파형 그리기 (RMS 방식으로 더 부드럽게)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const centerY = height / 2;
    let firstPoint = true;

    for (let x = 0; x < width; x++) {
      const start = Math.floor(x * samplesPerPixel);
      const end = Math.min(start + samplesPerPixel, bufferLength);
      
      if (start >= bufferLength) break;
      
      // RMS (Root Mean Square) 계산으로 더 부드러운 파형
      let sumSquares = 0;
      let count = 0;
      let max = 0;
      let min = 0;
      
      for (let i = start; i < end; i++) {
        const value = channelData[i];
        sumSquares += value * value;
        count++;
        if (value > max) max = value;
        if (value < min) min = value;
      }
      
      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      const amplitude = Math.max(rms, Math.abs(max), Math.abs(min));
      const normalizedAmplitude = Math.min(amplitude, 1.0);
      const yOffset = normalizedAmplitude * centerY * 0.85; // 85% 높이 사용

      if (firstPoint) {
        ctx.moveTo(x, centerY);
        ctx.lineTo(x, centerY - yOffset);
        ctx.moveTo(x, centerY);
        firstPoint = false;
      } else {
        // 위쪽 파형
        ctx.lineTo(x, centerY - yOffset);
        // 아래쪽으로 이동
        ctx.moveTo(x, centerY);
        // 아래쪽 파형
        ctx.lineTo(x, centerY + yOffset);
        // 중앙으로 복귀
        ctx.moveTo(x, centerY);
      }
    }

    ctx.stroke();
    
    // 중앙선 그리기
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    
    // 시간 표시 (초 단위)
    if (audioBuffer.duration > 0 && showGrid) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      
      const duration = audioBuffer.duration;
      const timeStep = duration / 10;
      
      for (let i = 0; i <= 10; i++) {
        const time = (duration / 10) * i;
        const x = (width / 10) * i;
        ctx.fillText(`${time.toFixed(1)}s`, x, height - 20);
      }
    }
  }, [audioBuffer, width, height, color, backgroundColor, showGrid]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full border border-gray-600 rounded"
        style={{ backgroundColor }}
      />
      {!audioBuffer && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
          파형 데이터 없음
        </div>
      )}
    </div>
  );
}
