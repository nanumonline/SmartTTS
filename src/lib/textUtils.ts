/**
 * 텍스트 유틸리티 함수
 */

/**
 * 마크다운 기호를 제거합니다
 * @param text 원본 텍스트
 * @returns 마크다운 기호가 제거된 텍스트
 */
export function removeMarkdown(text: string): string {
  if (!text) return text;
  
  let cleaned = text;
  
  // **, *, __, _ 제거 (볼드, 이탤릭)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');
  
  // # 제거 (헤더)
  cleaned = cleaned.replace(/^#+\s+/gm, '');
  
  // ~~ 제거 (취소선)
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');
  
  // ` 제거 (인라인 코드)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  
  // ``` 제거 (코드 블록)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  
  // [] 제거 (링크 텍스트 부분만 남김)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // > 제거 (인용)
  cleaned = cleaned.replace(/^>\s+/gm, '');
  
  // - , *, + 제거 (리스트)
  cleaned = cleaned.replace(/^[-*+]\s+/gm, '');
  cleaned = cleaned.replace(/^\d+\.\s+/gm, '');
  
  // 남은 마크다운 특수문자 정리
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*/g, '');
  cleaned = cleaned.replace(/__/g, '');
  cleaned = cleaned.replace(/_/g, '');
  
  // 공백 정리 (연속된 공백을 하나로)
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // 앞뒤 공백 제거
  cleaned = cleaned.trim();
  
  return cleaned;
}

