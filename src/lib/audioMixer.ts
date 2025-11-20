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
  fadeInRatio?: number; // 페이드인 음원증감 비율 (0-100, 기본값: 100)
  fadeOutRatio?: number; // 페이드아웃 음원증감 비율 (0-100, 기본값: 100)
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
  bgmOffset: number; // TTS 시작 전 BGM 시작 오프셋 (양수: 초)
  ttsOffset: number; // TTS 시작 오프셋 (초)
  bgmOffsetAfterTts?: number; // TTS 종료 후 BGM 연장 시간 (양수: 초)
  trimEndSec?: number | null; // 종료 트림 (초, 호환성을 위해 유지)
}

export const DEFAULT_MIXING_SETTINGS: MixingSettings = {
  ttsGain: 1.0,
  bgmGain: 0.6,
  effectGain: 0.7,
  masterGain: 1.0,
  fadeIn: 0.3,
  fadeOut: 0.5,
  fadeInRatio: 100, // 기본값: 0% → 100%
  fadeOutRatio: 100, // 기본값: 100% → 0%
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
  // BGM은 항상 0초부터 시작 (고정)
  const bgmStartTime = 0;
  
  // TTS 시작 시간: fadeIn + bgmOffset
  const ttsStartTime = settings.fadeIn + settings.bgmOffset;
  const ttsLen = ttsBuffer ? ttsBuffer.duration : 0;
  
  // BGM 전체 길이: fadeIn + bgmOffset + ttsDuration + bgmOffsetAfterTts + fadeOut
  // BGM은 항상 TTS보다 길어야 함 (최소 TTS 길이 + fadeIn + fadeOut)
  let bgmTotalLen = 0;
  if (bgmBuffer && settings.trimEndSec != null && settings.trimEndSec > 0) {
    // trimEndSec가 있으면 그것이 BGM 전체 길이
    bgmTotalLen = settings.trimEndSec;
  } else if (bgmBuffer) {
    // trimEndSec가 없으면 계산된 길이 사용
    bgmTotalLen = settings.fadeIn + settings.bgmOffset + ttsLen + (settings.bgmOffsetAfterTts || 0) + settings.fadeOut;
    const minBgmLen = ttsLen + (settings.fadeIn || 0) + (settings.fadeOut || 0);
    bgmTotalLen = Math.max(bgmTotalLen, minBgmLen);
  } else {
    // BGM이 없는 경우: TTS 길이 + fadeIn + fadeOut + bgmOffset + bgmOffsetAfterTts
    bgmTotalLen = ttsLen + (settings.fadeIn || 0) + (settings.fadeOut || 0) + (settings.bgmOffset || 0) + (settings.bgmOffsetAfterTts || 0);
  }
  
  const effectLen = effectBuffer ? effectBuffer.duration : 0;
  // 렌더링 길이는 BGM 전체 길이, TTS 길이, 효과음 길이 중 가장 긴 것
  let renderDur = Math.max(bgmTotalLen, ttsLen, effectLen);
  
  // 최소 길이 보장 (최소 1프레임 이상)
  // 모든 길이가 0이거나 음수인 경우 최소 1초 보장
  if (renderDur <= 0 || !isFinite(renderDur)) {
    renderDur = 1.0;
  }
  
  // 최소 1프레임 보장 (sampleRate / 1000 = 44.1프레임, 약 1ms)
  const minLength = Math.max(1, Math.ceil(renderDur * sampleRate));
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: minLength, sampleRate });

  // 값 검증 및 정규화 헬퍼 함수
  const clamp = (value: number, min: number, max: number, defaultValue: number): number => {
    if (!isFinite(value) || isNaN(value)) return defaultValue;
    return Math.max(min, Math.min(max, value));
  };

  // 마스터 게인
  const master = ctx.createGain();
  master.gain.value = clamp(settings.masterGain, 0, 10, 1.0);

  // BGM 경로 with EQ (BGM이 있을 때만 생성)
  let lowShelf: BiquadFilterNode | null = null;
  let midPeaking: BiquadFilterNode | null = null;
  let highShelf: BiquadFilterNode | null = null;
  let bgmGain: GainNode | null = null;

  if (bgmBuffer) {
    lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 100;
    lowShelf.gain.value = clamp(settings.lowShelf, -40, 40, 0);

    midPeaking = ctx.createBiquadFilter();
    midPeaking.type = "peaking";
    midPeaking.frequency.value = 1000;
    midPeaking.Q.value = 1;
    midPeaking.gain.value = clamp(settings.midPeaking ?? 0, -40, 40, 0);

    highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 8000;
    highShelf.gain.value = clamp(settings.highShelf, -40, 40, 0);

    bgmGain = ctx.createGain();
    bgmGain.gain.value = clamp(settings.bgmGain, 0, 10, 0.5);
  }

  // TTS 경로 (페이드 없음)
  const ttsGain = ctx.createGain();
  ttsGain.gain.value = clamp(settings.ttsGain, 0, 10, 1.0);

  // 효과음 경로
  const effectGain = ctx.createGain();
  effectGain.gain.value = clamp(settings.effectGain, 0, 10, 0);

  // BGM에만 페이드 적용 (TTS는 페이드 없음)
  // BGM은 항상 0초부터 시작하므로 페이드인도 0초부터
  // 음원증감 비율 적용: 50%가 기본값(원래 볼륨), 0-50%는 감소, 50-100%는 증가
  if (bgmBuffer && bgmGain && lowShelf && midPeaking && highShelf && settings.fadeIn > 0) {
    const bgmFadeInGain = ctx.createGain();
    const fadeInRatio = clamp(settings.fadeInRatio ?? 50, 0, 100, 50) / 100; // 0-100을 0-1로 변환 (50%가 중앙 = 기본 볼륨)
    // 50% = 기본 볼륨 (bgmGain * 1.0), 0% = 0 볼륨, 100% = bgmGain * 2.0
    const bgmGainValue = clamp(settings.bgmGain, 0, 10, 0.5);
    const fadeInTargetGain = clamp(bgmGainValue * (fadeInRatio * 2), 0.0001, 10, bgmGainValue); // 중앙 기준 증감
    bgmFadeInGain.gain.setValueAtTime(0.0001, bgmStartTime);
    bgmFadeInGain.gain.exponentialRampToValueAtTime(fadeInTargetGain, bgmStartTime + Math.max(0.01, clamp(settings.fadeIn, 0, 60, 0.3)));
    lowShelf.connect(midPeaking);
    midPeaking.connect(highShelf);
    highShelf.connect(bgmFadeInGain);
    bgmFadeInGain.connect(bgmGain);
    bgmGain.gain.value = fadeInTargetGain; // 페이드인 후 유지
  } else if (bgmBuffer && bgmGain && lowShelf && midPeaking && highShelf) {
    // 페이드인 없이 바로 연결
    lowShelf.connect(midPeaking);
    midPeaking.connect(highShelf);
    highShelf.connect(bgmGain);
    bgmGain.gain.value = clamp(settings.bgmGain, 0, 10, 0.5);
  }

  // BGM 종료 시 페이드아웃 적용 (선형 페이드아웃)
  // bgmTotalLen이 이미 계산되어 있음 (위에서 계산)
  // 음원증감 비율 적용: 100%가 기본값(원래 볼륨), 0-100%는 시작 볼륨 비율
  if (bgmBuffer && bgmGain && settings.fadeOut > 0) {
    const bgmEndTime = bgmTotalLen || renderDur;
    const bgmFadeOutGain = ctx.createGain();
    const fadeOutRatio = clamp(settings.fadeOutRatio ?? 100, 0, 100, 100) / 100; // 0-100을 0-1로 변환 (100%가 기본 볼륨)
    // 100% = 기본 볼륨 (bgmGain * 1.0), 0% = 0 볼륨
    const bgmGainValue = clamp(settings.bgmGain, 0, 10, 0.5);
    const fadeOutStartGain = clamp(bgmGainValue * fadeOutRatio, 0.0001, 10, bgmGainValue); // 시작 볼륨
    const fadeOutDuration = clamp(settings.fadeOut, 0, 60, 0.5);
    const fadeOutStartTime = bgmEndTime - Math.max(0.01, fadeOutDuration);
    
    // 페이드아웃 시작 시점에 bgmGain을 원래 볼륨으로 복원 (덕킹 영향 제거)
    // 이렇게 하면 페이드아웃이 항상 원래 볼륨에서 시작하여 선형으로 감소
    bgmGain.gain.setValueAtTime(bgmGainValue, fadeOutStartTime);
    bgmGain.gain.linearRampToValueAtTime(bgmGainValue, fadeOutStartTime + 0.01);
    
    // 페이드아웃 게인 노드: 100%에서 시작하여 0%로 선형 감소
    bgmFadeOutGain.gain.setValueAtTime(1.0, fadeOutStartTime); // 100% 볼륨
    bgmFadeOutGain.gain.linearRampToValueAtTime(0.0, bgmEndTime); // 0%로 선형 감소
    
    bgmGain.connect(bgmFadeOutGain);
    bgmFadeOutGain.connect(master);
  } else if (bgmBuffer && bgmGain) {
    bgmGain.connect(master);
  }

  // TTS는 페이드 없이 바로 연결 (음량 유지)
  ttsGain.connect(master);
  effectGain.connect(master);
  master.gain.value = clamp(settings.masterGain, 0, 10, 1.0); // 마스터 게인은 상수로 유지
  master.connect(ctx.destination);

  // 소스 생성 및 시작
  if (bgmBuffer && lowShelf) {
    const bgmSrc = ctx.createBufferSource();
    bgmSrc.buffer = bgmBuffer;
    bgmSrc.connect(lowShelf);
    
    // BGM이 필요한 길이만큼 재생되도록 루프 설정
    // bgmTotalLen만큼 재생하려면 루프 필요
    const bgmNeededDuration = bgmTotalLen;
    const bgmOriginalDuration = bgmBuffer.duration;
    
    if (bgmNeededDuration > bgmOriginalDuration) {
      // BGM이 더 길 필요가 있으면 루프 설정
      bgmSrc.loop = true;
      bgmSrc.loopEnd = bgmOriginalDuration;
    }
    
    // BGM은 항상 0초부터 시작
    bgmSrc.start(0);
    
    // OfflineAudioContext에서는 전체 길이만큼 렌더링하면 자동으로 필요한 만큼만 처리됨
    // bgmTotalLen만큼 렌더링하도록 이미 renderDur을 설정했으므로 추가 처리 불필요
  }

  if (ttsBuffer) {
    const ttsSrc = ctx.createBufferSource();
    ttsSrc.buffer = ttsBuffer;
    ttsSrc.connect(ttsGain); // TTS는 페이드 없이 바로 연결
    // TTS 시작 시간: fadeIn + bgmOffset
    const ttsStartTime = settings.fadeIn + settings.bgmOffset;
    ttsSrc.start(ttsStartTime);
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
      const fadeOutStart = bgmTotalLen - settings.fadeOut;
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
      // 페이드아웃 시작 시점에 원래 볼륨으로 복원 (덕킹 영향 제거)
      // 페이드아웃이 선형으로 점진적으로 감소하도록 보장
      bgmControlGain.gain.setValueAtTime(settings.bgmGain, fadeOutStart - 0.01);
      bgmControlGain.gain.linearRampToValueAtTime(settings.bgmGain, fadeOutStart);
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

