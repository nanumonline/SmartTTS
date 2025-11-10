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
  
  // 패턴: 명사 + 조사 (띄어쓰기 있을 수도 있음)
  // 예: 춘천시청는, 서울가, 강원도로, 춘천시청 은 → 춘천시청은
  
  let corrected = text;
  
  // 조사 패턴 정의 (띄어쓰기 고려)
  // 1단계: 띄어쓰기가 있는 경우도 처리 (예: "춘천시청 는" → "춘천시청은")
  const patternsWithSpace = [
    // 을/를 (띄어쓰기)
    { wrong: /([가-힣]+)\s+을/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? `${n}을` : `${n}를` },
    { wrong: /([가-힣]+)\s+를/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? `${n}을` : `${n}를` },
    // 이/가 (띄어쓰기)
    { wrong: /([가-힣]+)\s+이/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? `${n}이` : `${n}가` },
    { wrong: /([가-힣]+)\s+가/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? `${n}이` : `${n}가` },
    // 은/는 (띄어쓰기)
    { wrong: /([가-힣]+)\s+은/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? `${n}은` : `${n}는` },
    { wrong: /([가-힣]+)\s+는/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? `${n}은` : `${n}는` },
    // 로/으로 (띄어쓰기)
    { wrong: /([가-힣]+)\s+로/g, correct: (m: string, n: string) => {
      const consonantCode = getFinalConsonantCode(n);
      if (consonantCode === 0) return `${n}로`; // 받침 없음
      if (consonantCode === 8) return `${n}로`; // ㄹ 받침
      return `${n}으로`; // 다른 받침
    }},
    { wrong: /([가-힣]+)\s+으로/g, correct: (m: string, n: string) => {
      const consonantCode = getFinalConsonantCode(n);
      if (consonantCode === 0) return `${n}로`; // 받침 없음
      if (consonantCode === 8) return `${n}로`; // ㄹ 받침
      return `${n}으로`; // 다른 받침
    }},
  ];
  
  // 띄어쓰기 있는 경우 먼저 처리
  for (const { wrong, correct } of patternsWithSpace) {
    corrected = corrected.replace(wrong, correct);
  }
  
  // 2단계: 띄어쓰기 없는 경우 처리
  const patternsWithoutSpace = [
    // 을/를
    { wrong: /([가-힣]+)을/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? m : m.replace("을", "를") },
    { wrong: /([가-힣]+)를/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? m.replace("를", "을") : m },
    // 이/가
    { wrong: /([가-힣]+)이/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? m : m.replace("이", "가") },
    { wrong: /([가-힣]+)가/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? m.replace("가", "이") : m },
    // 은/는
    { wrong: /([가-힣]+)은/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? m : m.replace("은", "는") },
    { wrong: /([가-힣]+)는/g, correct: (m: string, n: string) => hasFinalConsonant(n) ? m.replace("는", "은") : m },
    // 로/으로
    { wrong: /([가-힣]+)로/g, correct: (m: string, n: string) => {
      const consonantCode = getFinalConsonantCode(n);
      if (consonantCode === 0) return m; // 받침 없음 → "로" 맞음
      if (consonantCode === 8) return m; // ㄹ 받침 → "로" 맞음
      return m.replace("로", "으로"); // 다른 받침 → "으로"
    }},
    { wrong: /([가-힣]+)으로/g, correct: (m: string, n: string) => {
      const consonantCode = getFinalConsonantCode(n);
      if (consonantCode === 0) return m.replace("으로", "로"); // 받침 없음 → "로"
      if (consonantCode === 8) return m.replace("으로", "로"); // ㄹ 받침 → "로"
      return m; // 다른 받침 → "으로" 맞음
    }},
  ];
  
  // 띄어쓰기 없는 경우 처리
  for (const { wrong, correct } of patternsWithoutSpace) {
    corrected = corrected.replace(wrong, correct);
  }
  
  // 3단계: "~가며" → "~며" 교정 (받침 없을 때), "~이며" 교정 (받침 있을 때)
  // "~가며"는 잘못된 표현이므로 받침 유무에 따라 "~며" 또는 "~이며"로 교정
  corrected = corrected.replace(/([가-힣]+)가며/g, (match, noun) => {
    return hasFinalConsonant(noun) ? `${noun}이며` : `${noun}며`;
  });
  
  return corrected;
}

