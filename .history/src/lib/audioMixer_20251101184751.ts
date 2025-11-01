/**
 * Audio Mixer Utilities
 * Web Audio API 기반 오디오 믹싱 유틸리티
 * - 실시간 미리듣기
 * - 오토덕킹 (Auto-ducking)
 * - 3밴드 EQ
 * - 페이드 인/아웃
 * - WAV/MP3 내보내기
 */

export interface MixingSettings {
  ttsGain: number; // TTS 음량 (0-2)
  bgmGain: number; // BGM 음량 (0-2)
  effectGain: number; // 효과음 음량 (0-2)
  masterGain: number; // 마스터 음량 (0-2)
  fadeIn: number; // 페이드 인 시간 (초)
  fadeOut: number; // 페이드 아웃 시간 (초)
  // EQ (BGM 경로)
  lowShelf: number; // Low Shelf (100Hz, dB)
  midPeaking: number; // Mid Peaking (1kHz, Q=1, dB)
  highShelf: number; // High Shelf (8kHz, dB)
  // 오토덕킹
  duckingEnabled: boolean;
  duckDb: number; // 덕킹 감소량 (dB)
  duckThreshold: number; // 덕킹 임계값 (dBFS)
  duckRelease: number; // 덕킹 릴리즈 시간 (초)
  // 오프셋 및 트림
  bgmOffset: number; // BGM 시작 오프셋 (초)
  ttsOffset: number; // TTS 시작 오프셋 (초)
  trimEndSec?: number | null; // 종료 트림 (초)
}

export const DEFAULT_MIXING_SETTINGS: MixingSettings = {
  ttsGain: 1.0,
  bgmGain: 0.6,
  effectGain: 0.7,
  masterGain: 1.0,
  fadeIn: 0.3,
  fadeOut: 0.5,
  lowShelf: 0,
  midPeaking: 0,
  highShelf: -1.5,
  duckingEnabled: true,
  duckDb: -10,
  duckThreshold: -42,
  duckRelease: 0.2,
  bgmOffset: 0,
  ttsOffset: 0,
  trimEndSec: null,
};

/**
 * 파일을 AudioBuffer로 디코딩
 */
export async function decodeFileToBuffer(
  ctx: BaseAudioContext,
  file: File | Blob
): Promise<AudioBuffer> {
  const arr = await file.arrayBuffer();
  return await ctx.decodeAudioData(arr);
}

/**
 * URL을 AudioBuffer로 디코딩
 */
export async function decodeUrlToBuffer(
  ctx: BaseAudioContext,
  url: string
): Promise<AudioBuffer> {
  const response = await fetch(url);
  const blob = await response.blob();
  return decodeFileToBuffer(ctx, blob);
}

/**
 * 16-bit PCM WAV 인코딩
 */
export function encodeWavPCM16(
  interleaved: Float32Array,
  sampleRate: number,
  numChannels: number
): Blob {
  const byteRate = (sampleRate * numChannels * 16) / 8;
  const blockAlign = (numChannels * 16) / 8;
  const wavBuffer = new ArrayBuffer(44 + interleaved.length * 2);
  const view = new DataView(wavBuffer);

  function writeString(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + interleaved.length * 2, true);
  writeString(8, "WAVE");

  // fmt chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(36, "data");
  view.setUint32(40, interleaved.length * 2, true);

  // samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(
      offset,
      s < 0 ? s * 0x8000 : s * 0x7fff,
      true
    );
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

/**
 * AudioBuffer를 스테레오 인터리브 Float32Array로 변환
 */
export function mixDownToStereo(buffer: AudioBuffer): Float32Array {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const tmp = new Float32Array(length * 2); // stereo interleaved
  const L = new Float32Array(length);
  const R = new Float32Array(length);

  if (numChannels === 1) {
    buffer.copyFromChannel(L, 0);
    R.set(L);
  } else {
    buffer.copyFromChannel(L, 0);
    buffer.copyFromChannel(R, 1);
  }

  for (let i = 0; i < length; i++) {
    const li = L[i];
    const ri = R[i];
    tmp[i * 2] = li;
    tmp[i * 2 + 1] = ri;
  }

  return tmp;
}

/**
 * 믹싱된 오디오를 오프라인 렌더링하여 WAV로 내보내기
 */
export async function exportMixToWav(
  ttsBuffer: AudioBuffer | null,
  bgmBuffer: AudioBuffer | null,
  effectBuffer: AudioBuffer | null,
  settings: MixingSettings,
  sampleRate: number = 44100
): Promise<Blob> {
  // 렌더링 길이 계산
  const ttsLen = ttsBuffer ? ttsBuffer.duration + settings.ttsOffset : 0;
  const bgmLen = bgmBuffer ? bgmBuffer.duration + settings.bgmOffset : 0;
  const effectLen = effectBuffer ? effectBuffer.duration : 0;
  let renderDur = Math.max(ttsLen, bgmLen, effectLen);
  if (settings.trimEndSec != null) {
    renderDur = Math.min(renderDur, settings.trimEndSec);
  }

  const length = Math.ceil(renderDur * sampleRate);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length, sampleRate });

  // 마스터 게인
  const master = ctx.createGain();
  master.gain.value = settings.masterGain;

  // BGM 경로 with EQ
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = 100;
  lowShelf.gain.value = settings.lowShelf;

  const midPeaking = ctx.createBiquadFilter();
  midPeaking.type = "peaking";
  midPeaking.frequency.value = 1000;
  midPeaking.Q.value = 1;
  midPeaking.gain.value = settings.midPeaking;

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 8000;
  highShelf.gain.value = settings.highShelf;

  const bgmGain = ctx.createGain();
  bgmGain.gain.value = settings.bgmGain;

  lowShelf.connect(midPeaking);
  midPeaking.connect(highShelf);
  highShelf.connect(bgmGain);

  // TTS 경로
  const ttsGain = ctx.createGain();
  ttsGain.gain.value = settings.ttsGain;

  // 효과음 경로
  const effectGain = ctx.createGain();
  effectGain.gain.value = settings.effectGain;

  // BGM에만 페이드 적용 (TTS는 페이드 없음)
  // BGM이 먼저 시작되는 경우 (bgmOffset < 0): 페이드인 적용
  const bgmStartTime = Math.max(0, -settings.bgmOffset);
  if (bgmBuffer && settings.fadeIn > 0 && bgmStartTime > 0) {
    const bgmFadeInGain = ctx.createGain();
    bgmFadeInGain.gain.setValueAtTime(0.0001, bgmStartTime);
    bgmFadeInGain.gain.exponentialRampToValueAtTime(settings.bgmGain, bgmStartTime + Math.max(0.01, settings.fadeIn));
    lowShelf.connect(midPeaking);
    midPeaking.connect(highShelf);
    highShelf.connect(bgmFadeInGain);
    bgmFadeInGain.connect(bgmGain);
    bgmGain.gain.value = settings.bgmGain; // 페이드인 후 유지
  } else {
    // 페이드인 없이 바로 연결
    lowShelf.connect(midPeaking);
    midPeaking.connect(highShelf);
    highShelf.connect(bgmGain);
    bgmGain.gain.value = settings.bgmGain;
  }

  // BGM 종료 시 페이드아웃 적용
  const ttsEndTime = ttsBuffer ? (settings.ttsOffset + ttsBuffer.duration) : 0;
  const bgmEndTime = settings.trimEndSec || (bgmBuffer ? (bgmStartTime + bgmBuffer.duration) : renderDur);
  if (bgmBuffer && settings.fadeOut > 0) {
    const bgmFadeOutGain = ctx.createGain();
    bgmFadeOutGain.gain.setValueAtTime(settings.bgmGain, bgmEndTime - Math.max(0.01, settings.fadeOut));
    bgmFadeOutGain.gain.exponentialRampToValueAtTime(0.0001, bgmEndTime);
    bgmGain.connect(bgmFadeOutGain);
    bgmFadeOutGain.connect(master);
  } else {
    bgmGain.connect(master);
  }

  // TTS는 페이드 없이 바로 연결 (음량 유지)
  ttsGain.connect(master);
  effectGain.connect(master);
  master.gain.value = settings.masterGain; // 마스터 게인은 상수로 유지
  master.connect(ctx.destination);

  // 소스 생성 및 시작
  if (bgmBuffer) {
    const bgmSrc = ctx.createBufferSource();
    bgmSrc.buffer = bgmBuffer;
    if (settings.fadeIn > 0 && bgmStartTime > 0) {
      bgmSrc.connect(lowShelf); // 페이드인 경로
    } else {
      bgmSrc.connect(lowShelf); // 일반 경로
    }
    // BGM이 먼저 시작되면 음수 offset 허용
    bgmSrc.start(0, Math.max(0, -settings.bgmOffset));
  }

  if (ttsBuffer) {
    const ttsSrc = ctx.createBufferSource();
    ttsSrc.buffer = ttsBuffer;
    ttsSrc.connect(ttsGain); // TTS는 페이드 없이 바로 연결
    ttsSrc.start(0, Math.max(0, settings.ttsOffset));
  }

  if (effectBuffer) {
    const effectSrc = ctx.createBufferSource();
    effectSrc.buffer = effectBuffer;
    effectSrc.connect(effectGain);
    effectSrc.start(0, 0);
  }

  // 오프라인 오토덕킹: TTS가 재생될 때만 BGM을 낮춤 (TTS는 그대로 유지)
  if (settings.duckingEnabled && ttsBuffer && bgmBuffer) {
    const step = 0.02; // 20ms 분석
    const reduction = Math.pow(10, settings.duckDb / 20); // BGM 감소량
    
    // BGM 페이드인/아웃을 고려한 게인 노드 확인
    let bgmControlGain = bgmGain;
    if (settings.fadeIn > 0 && bgmStartTime > 0) {
      // 페이드인이 있는 경우, 페이드인 후 게인 조절
      bgmControlGain = bgmGain;
    }
    if (settings.fadeOut > 0) {
      // 페이드아웃이 있는 경우, 페이드아웃 전까지 게인 조절
      const fadeOutStart = bgmEndTime - settings.fadeOut;
      for (let t = 0; t < fadeOutStart; t += step) {
        const tt = t - settings.ttsOffset; // TTS 시간 계산
        if (tt < 0 || tt >= ttsBuffer.duration) {
          // TTS가 재생되지 않으면 BGM 원래 볼륨
          bgmControlGain.gain.setValueAtTime(settings.bgmGain, t);
          continue;
        }
        const idxStart = Math.floor(tt * sampleRate);
        const window = Math.floor(step * sampleRate);
        const ch = new Float32Array(window);
        ttsBuffer.copyFromChannel(ch, 0, idxStart);
        let sum = 0;
        for (let i = 0; i < ch.length; i++) {
          sum += ch[i] * ch[i];
        }
        const rms = Math.sqrt(sum / (ch.length || 1));
        const db = 20 * Math.log10(rms + 1e-8);
        // TTS가 재생 중이면 BGM만 낮춤, TTS는 그대로
        const target = db > settings.duckThreshold ? (settings.bgmGain * reduction) : settings.bgmGain;
        bgmControlGain.gain.setValueAtTime(target, t);
        bgmControlGain.gain.linearRampToValueAtTime(target, Math.min(fadeOutStart, t + settings.duckRelease));
      }
    } else {
      // 페이드아웃 없으면 전체 구간에 대해 적용
      for (let t = 0; t < renderDur; t += step) {
        const tt = t - settings.ttsOffset; // TTS 시간 계산
        if (tt < 0 || tt >= ttsBuffer.duration) {
          // TTS가 재생되지 않으면 BGM 원래 볼륨
          bgmControlGain.gain.setValueAtTime(settings.bgmGain, t);
          continue;
        }
        const idxStart = Math.floor(tt * sampleRate);
        const window = Math.floor(step * sampleRate);
        const ch = new Float32Array(window);
        ttsBuffer.copyFromChannel(ch, 0, idxStart);
        let sum = 0;
        for (let i = 0; i < ch.length; i++) {
          sum += ch[i] * ch[i];
        }
        const rms = Math.sqrt(sum / (ch.length || 1));
        const db = 20 * Math.log10(rms + 1e-8);
        // TTS가 재생 중이면 BGM만 낮춤, TTS는 그대로
        const target = db > settings.duckThreshold ? (settings.bgmGain * reduction) : settings.bgmGain;
        bgmControlGain.gain.setValueAtTime(target, t);
        bgmControlGain.gain.linearRampToValueAtTime(target, Math.min(renderDur, t + settings.duckRelease));
      }
    }
  }

  const rendered = await ctx.startRendering();
  const interleaved = mixDownToStereo(rendered);
  return encodeWavPCM16(interleaved, sampleRate, 2);
}

/**
 * WAV Blob를 MP3로 변환 (Web Worker 사용)
 * 참고: 실제 구현에서는 lamejs 또는 서버 API를 사용해야 합니다.
 * 브라우저에서는 직접 MP3 인코딩이 제한적이므로, WAV를 반환하거나
 * 서버 API를 통해 변환하는 것을 권장합니다.
 */
export async function convertWavToMp3(wavBlob: Blob): Promise<Blob> {
  // 브라우저에서 직접 MP3 인코딩은 제한적입니다.
  // 실제 구현시에는:
  // 1. lamejs 라이브러리 사용 (Web Worker)
  // 2. 또는 서버 API 호출
  
  // 임시로 WAV 반환 (실제로는 서버 변환이 필요)
  console.warn("MP3 변환은 서버 API를 통해 처리되어야 합니다. WAV를 반환합니다.");
  return wavBlob;
}

/**
 * 블롭 다운로드
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 시간 포맷팅 (초 -> MM:SS)
 */
export function formatTime(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

