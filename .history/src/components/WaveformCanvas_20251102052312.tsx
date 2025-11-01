import { useEffect, useRef } from 'react';

interface WaveformCanvasProps {
  audioBuffer: AudioBuffer | null | undefined;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export default function WaveformCanvas({ 
  audioBuffer, 
  width = 800, 
  height = 200,
  color = '#3b82f6',
  backgroundColor = '#1f2937'
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 초기화
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // 오디오 데이터 추출
    const channelData = audioBuffer.getChannelData(0); // 첫 번째 채널만 사용
    const bufferLength = channelData.length;
    const samplesPerPixel = Math.floor(bufferLength / width);
    
    // 파형 그리기
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, bufferLength);
      
      // 이 구간의 최대값과 최소값 찾기
      let max = 0;
      let min = 0;
      for (let i = start; i < end; i++) {
        const value = channelData[i];
        if (value > max) max = value;
        if (value < min) min = value;
      }

      // 중앙선 기준으로 위아래로 그리기
      const centerY = height / 2;
      const amplitude = Math.max(Math.abs(max), Math.abs(min));
      const y = centerY + (amplitude * centerY * 0.9); // 90% 높이 사용

      if (x === 0) {
        ctx.moveTo(x, centerY);
        ctx.lineTo(x, centerY - (amplitude * centerY * 0.9));
        ctx.moveTo(x, centerY);
      } else {
        // 위쪽 파형
        ctx.moveTo(x, centerY);
        ctx.lineTo(x, centerY - (amplitude * centerY * 0.9));
        // 아래쪽 파형
        ctx.moveTo(x, centerY);
        ctx.lineTo(x, centerY + (amplitude * centerY * 0.9));
      }
    }

    ctx.stroke();
    
    // 중앙선 그리기
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }, [audioBuffer, width, height, color, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full border border-gray-600 rounded"
      style={{ backgroundColor }}
    />
  );
}
