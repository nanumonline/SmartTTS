/**
 * 한국어 조사 자동 교정 유틸리티
 * 명사의 받침 유무에 따라 조사를 올바르게 교정합니다.
 */

/**
 * 마지막 글자에 받침이 있는지 확인
 * @param text 확인할 텍스트
 * @returns 받침이 있으면 true, 없으면 false
 */
export function hasFinalConsonant(text: string): boolean {
  if (!text || text.length === 0) return false;
  
  // 공백 제거하고 마지막 글자 확인
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  
  const lastChar = trimmed[trimmed.length - 1];
  const charCode = lastChar.charCodeAt(0);
  
  // 한글 유니코드 범위: AC00-D7A3 (가-힣)
  if (charCode < 0xAC00 || charCode > 0xD7A3) {
    // 한글이 아니면 받침 없음으로 처리
    return false;
  }
  
  // 받침 추출: (유니코드 - 0xAC00) % 28
  // 받침이 0이면 받침 없음, 1 이상이면 받침 있음
  const finalConsonant = (charCode - 0xAC00) % 28;
  return finalConsonant > 0;
}

/**
 * 받침 종류 확인 (특수 케이스 처리용)
 * @param text 확인할 텍스트
 * @returns 받침 코드 (0이면 받침 없음)
 */
function getFinalConsonantCode(text: string): number {
  if (!text || text.length === 0) return 0;
  
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  
  const lastChar = trimmed[trimmed.length - 1];
  const charCode = lastChar.charCodeAt(0);
  
  if (charCode < 0xAC00 || charCode > 0xD7A3) {
    return 0;
  }
  
  return (charCode - 0xAC00) % 28;
}

/**
 * 한국어 조사 자동 교정
 * 명사 뒤에 오는 조사를 받침 유무에 따라 올바르게 교정합니다.
 * 
 * 교정 규칙:
 * - 을/를: 받침 있으면 "을", 없으면 "를"
 * - 이/가: 받침 있으면 "이", 없으면 "가"
 * - 은/는: 받침 있으면 "은", 없으면 "는"
 * - 로/으로: 받침 있으면 "으로", 없으면 "로" (단, 받침이 ㄹ이면 "로")
 * 
 * @param text 교정할 텍스트
 * @returns 교정된 텍스트
 */
export function correctKoreanPostpositions(text: string): string {
  if (!text) return text;
  
  // 패턴: 명사 + 조사 (띄어쓰기 없음)
  // 예: 춘천시청는, 서울가, 강원도로, 서울에서
  
  // 조사 패턴 정의
  const patterns = [
    // 을/를 교정
    { 
      pattern: /([가-힣]+)을/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        return hasConsonant ? match : match.replace("을", "를");
      }
    },
    { 
      pattern: /([가-힣]+)를/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        return hasConsonant ? match.replace("를", "을") : match;
      }
    },
    // 이/가 교정
    { 
      pattern: /([가-힣]+)이/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        return hasConsonant ? match : match.replace("이", "가");
      }
    },
    { 
      pattern: /([가-힣]+)가/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        return hasConsonant ? match.replace("가", "이") : match;
      }
    },
    // 은/는 교정
    { 
      pattern: /([가-힣]+)은/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        return hasConsonant ? match : match.replace("은", "는");
      }
    },
    { 
      pattern: /([가-힣]+)는/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        return hasConsonant ? match.replace("는", "은") : match;
      }
    },
    // 로/으로 교정
    { 
      pattern: /([가-힣]+)로/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        if (!hasConsonant) return match; // 받침 없으면 "로"가 맞음
        
        // 받침이 있지만 ㄹ이면 "로"가 맞음
        const lastChar = noun[noun.length - 1];
        const charCode = lastChar.charCodeAt(0);
        const finalConsonant = (charCode - 0xAC00) % 28;
        // 받침이 ㄹ(8)이면 "로" 유지
        if (finalConsonant === 8) return match; // ㄹ 받침
        
        return match.replace("로", "으로");
      }
    },
    { 
      pattern: /([가-힣]+)으로/g, 
      replacement: (match: string, noun: string) => {
        const hasConsonant = hasFinalConsonant(noun);
        if (!hasConsonant) return match.replace("으로", "로"); // 받침 없으면 "로"로 변경
        
        // 받침이 있지만 ㄹ이면 "로"로 변경
        const lastChar = noun[noun.length - 1];
        const charCode = lastChar.charCodeAt(0);
        const finalConsonant = (charCode - 0xAC00) % 28;
        if (finalConsonant === 8) return match.replace("으로", "로"); // ㄹ 받침이면 "로"
        
        return match; // 받침 있고 ㄹ이 아니면 "으로"가 맞음
      }
    },
  ];
  
  let corrected = text;
  
  // 각 패턴 적용
  for (const { pattern, replacement } of patterns) {
    corrected = corrected.replace(pattern, replacement);
  }
  
  return corrected;
}

