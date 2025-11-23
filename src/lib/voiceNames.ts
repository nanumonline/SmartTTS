/**
 * 음성 ID와 한글 이름 매핑
 * Supertone API에서 가져온 음성 ID를 한글 이름으로 변환
 */

// 음성 ID -> 한글 이름 매핑
const voiceNameMap: Record<string, string> = {
  // 여성 음성
  "Agatha": "아가사",
  "Alice": "앨리스",
  "Amy": "에이미",
  "Anna": "안나",
  "Aria": "아리아",
  "Aurora": "오로라",
  "Bella": "벨라",
  "Chloe": "클로이",
  "Diana": "다이아나",
  "Emma": "엠마",
  "Eva": "에바",
  "Fiona": "피오나",
  "Grace": "그레이스",
  "Hannah": "한나",
  "Iris": "아이리스",
  "Ivy": "아이비",
  "Jade": "제이드",
  "Julia": "줄리아",
  "Kate": "케이트",
  "Lily": "릴리",
  "Luna": "루나",
  "Maya": "마야",
  "Nora": "노라",
  "Olivia": "올리비아",
  "Phoebe": "피비",
  "Rose": "로즈",
  "Sophia": "소피아",
  "Stella": "스텔라",
  "Tina": "티나",
  "Vera": "베라",
  "Wendy": "웬디",
  "Zoe": "조이",
  
  // 남성 음성
  "Alex": "알렉스",
  "Andrew": "앤드류",
  "Ben": "벤",
  "Brian": "브라이언",
  "Chris": "크리스",
  "Daniel": "다니엘",
  "David": "데이비드",
  "Dom": "돔",
  "Eric": "에릭",
  "Ethan": "이단",
  "George": "조지",
  "Henry": "헨리",
  "Jack": "잭",
  "James": "제임스",
  "John": "존",
  "Kevin": "케빈",
  "Leo": "레오",
  "Lucas": "루카스",
  "Mark": "마크",
  "Michael": "마이클",
  "Noah": "노아",
  "Oliver": "올리버",
  "Paul": "폴",
  "Peter": "피터",
  "Robert": "로버트",
  "Ryan": "라이언",
  "Sam": "샘",
  "Thomas": "토마스",
  "Timmy": "티미",
  "Toby": "토비",
  "Toma": "토마",
  "Tom": "톰",
  "Tracy": "트레이시",
  "Travis": "트래비스",
  "Valiant": "발리언트",
  "Victor": "빅터",
  "Vince": "빈스",
  "Violet": "바이올렛",
  "William": "윌리엄",
  
  // 기타 특수 음성
  "jiyun": "지윤",
  "male_anchor_1": "앵커 스타일 남성 1",
  "male_anchor_2": "앵커 스타일 남성 2",
  "female_anchor_1": "아나운서 스타일 여성 1",
  "female_anchor_2": "아나운서 스타일 여성 2",
  "female_weather_1": "기상 아나운서 스타일",
  
  // 소문자/대문자 변형도 지원
  "agatha": "아가사",
  "alice": "앨리스",
  "amy": "에이미",
  "anna": "안나",
  "aria": "아리아",
  "aurora": "오로라",
  "bella": "벨라",
  "chloe": "클로이",
  "diana": "다이아나",
  "emma": "엠마",
  "eva": "에바",
  "fiona": "피오나",
  "grace": "그레이스",
  "hannah": "한나",
  "iris": "아이리스",
  "ivy": "아이비",
  "jade": "제이드",
  "julia": "줄리아",
  "kate": "케이트",
  "lily": "릴리",
  "luna": "루나",
  "maya": "마야",
  "nora": "노라",
  "olivia": "올리비아",
  "phoebe": "피비",
  "rose": "로즈",
  "sophia": "소피아",
  "stella": "스텔라",
  "tina": "티나",
  "vera": "베라",
  "wendy": "웬디",
  "zoe": "조이",
  "alex": "알렉스",
  "andrew": "앤드류",
  "ben": "벤",
  "brian": "브라이언",
  "chris": "크리스",
  "daniel": "다니엘",
  "david": "데이비드",
  "dom": "돔",
  "eric": "에릭",
  "ethan": "이단",
  "george": "조지",
  "henry": "헨리",
  "jack": "잭",
  "james": "제임스",
  "john": "존",
  "kevin": "케빈",
  "leo": "레오",
  "lucas": "루카스",
  "mark": "마크",
  "michael": "마이클",
  "noah": "노아",
  "oliver": "올리버",
  "paul": "폴",
  "peter": "피터",
  "robert": "로버트",
  "ryan": "라이언",
  "sam": "샘",
  "thomas": "토마스",
  "timmy": "티미",
  "toby": "토비",
  "toma": "토마",
  "tom": "톰",
  "tracy": "트레이시",
  "travis": "트래비스",
  "valiant": "발리언트",
  "victor": "빅터",
  "vince": "빈스",
  "violet": "바이올렛",
  "william": "윌리엄",
  
  // 추가 영어 이름 한글 매핑 (DB에 저장된 영어 이름들을 위한 추가 매핑)
  // 기존에 이미 있는 키들은 제외하고 새로운 매핑만 추가
  "takumi": "타쿠미",
  "Takumi": "타쿠미",
  "mason": "메이슨",
  "Mason": "메이슨",
  "selena": "셀레나",
  "Selena": "셀레나",
  "aiden": "에이든",
  "Aiden": "에이든",
  "kai": "카이",
  "Kai": "카이",
  "evan": "에반",
  "Evan": "에반",
  "lun": "룬",
  "Lun": "룬",
  "mai": "마이",
  "Mai": "마이",
  "cindy": "신디",
  "Cindy": "신디",
  "coco": "코코",
  "Coco": "코코",
  "lauren": "로렌",
  "Lauren": "로렌",
  "misa": "미사",
  "Misa": "미사",
  "kaori": "카오리",
  "Kaori": "카오리",
  "shade": "셰이드",
  "Shade": "셰이드",
  "kazuki": "카즈키",
  "Kazuki": "카즈키",
  "sota": "소타",
  "Sota": "소타",
  "ryota": "료타",
  "Ryota": "료타",
  "holt": "홀트",
  "Holt": "홀트",
  "viper": "바이퍼",
  "Viper": "바이퍼",
  "harrison": "해리슨",
  "Harrison": "해리슨",
  "diego": "디에고",
  "Diego": "디에고",
  
  // 추가 영어 이름 (DB에 실제로 저장된 이름들)
  "sangchul": "상철",
  "Sangchul": "상철",
  "hanbi": "한비",
  "Hanbi": "한비",
  "se-a": "세아",
  "Se-A": "세아",
  "tilly": "틸리",
  "Tilly": "틸리",
  "thanatos": "타나토스",
  "Thanatos": "타나토스",
  "honoka": "호노카",
  "Honoka": "호노카",
  "geomec": "지오맥",
  "Geomec": "지오맥",
  "jun": "준",
  "Jun": "준",
  "rikoming": "리코밍",
  "Rikoming": "리코밍",
  "desphara": "데스파라",
  "Desphara": "데스파라",
  "tara": "타라",
  "Tara": "타라",
  "angelina": "안젤리나",
  "Angelina": "안젤리나",
  "youngchul": "영철",
  "Youngchul": "영철",
  "youngho": "영호",
  "Youngho": "영호",
  "rachel": "레이첼",
  "Rachel": "레이첼",
  "freddie": "프레디",
  "Freddie": "프레디",
  "audrey": "오드리",
  "Audrey": "오드리",
  "helga": "헬가",
  "Helga": "헬가",
  "soonja": "순자",
  "Soonja": "순자",
  "bin": "빈",
  "Bin": "빈",
  "anika": "아니카",
  "Anika": "아니카",
  "hercules": "헤라클레스",
  "Hercules": "헤라클레스",
  "mika": "미카",
  "Mika": "미카",
  "suho": "수호",
  "Suho": "수호",
  "snar": "스나르",
  "Snar": "스나르",
  "aya": "아야",
  "Aya": "아야",
  "shoto": "쇼토",
  "Shoto": "쇼토",
  "walt": "월트",
  "Walt": "월트",
  "wayne": "웨인",
  "Wayne": "웨인",
  "daeun": "다은",
  "Daeun": "다은",
  "billy": "빌리",
  "Billy": "빌리",
  "eddie": "에디",
  "Eddie": "에디",
  "lang": "랑",
  "Lang": "랑",
  "yannom": "얀놈",
  "Yannom": "얀놈",
  "amantha": "아만사",
  "Amantha": "아만사",
  "quinn": "퀸",
  "Quinn": "퀸",
  "nate": "네이트",
  "Nate": "네이트",
  "chunsik": "춘식",
  "Chunsik": "춘식",
  "siwoo": "시우",
  "Siwoo": "시우",
  "misook": "미숙",
  "Misook": "미숙",
  "jihu": "지후",
  "Jihu": "지후",
  "minwoo": "민우",
  "Minwoo": "민우",
  "satyrus": "사티루스",
  "Satyrus": "사티루스",
  "mansu": "만수",
  "Mansu": "만수",
  "juliet": "줄리엣",
  "Juliet": "줄리엣",
  "molly": "몰리",
  "Molly": "몰리",
  "kotaro": "코타로",
  "Kotaro": "코타로",
  "gautama": "가우타마",
  "Gautama": "가우타마",
  "youngsoo": "영수",
  "Youngsoo": "영수",
  "yumi": "유미",
  "Yumi": "유미",
  "steelyn": "스틸린",
  "Steelyn": "스틸린",
  "bodhi": "보디",
  "Bodhi": "보디",
  "ppang": "빵",
  "Ppang": "빵",
  "bujang": "부장",
  "BuJang": "부장",
  "serin": "세린",
  "Serin": "세린",
  "molk": "몰크",
  "Molk": "몰크",
  "tmt": "티엠티",
  "TMT": "티엠티",
  "tony": "토니",
  "Tony": "토니",
  "sion": "시온",
  "Sion": "시온",
  "nyangnyangi": "냥냥이",
  "NyangNyangi": "냥냥이",
  "gingerbread": "진저브레드",
  "Gingerbread": "진저브레드",
  "mok-sensei": "목센세",
  "Mok-Sensei": "목센세",
  "genzzz": "젠지지지",
  "GenZZZ": "젠지지지",
  "father": "아버지",
  "Father": "아버지",
  "jacob": "야콥",
  "Jacob": "야콥",
};

/**
 * 음성 ID를 한글 이름으로 변환
 * @param voiceId - 음성 ID (예: "Agatha", "alice", "jiyun")
 * @param fallback - 매핑이 없을 때 사용할 기본값 (기본값: voiceId)
 * @returns 한글 이름 (예: "아가사", "앨리스", "지윤")
 */
export function getVoiceNameKo(voiceId: string | null | undefined, fallback?: string): string {
  if (!voiceId) return fallback || "알 수 없음";
  
  // 정확한 매핑 확인
  if (voiceNameMap[voiceId]) {
    return voiceNameMap[voiceId];
  }
  
  // 대소문자 무시 매핑
  const normalizedId = voiceId.trim();
  const lowerId = normalizedId.toLowerCase();
  const upperId = normalizedId.toUpperCase();
  const titleCaseId = normalizedId.charAt(0).toUpperCase() + normalizedId.slice(1).toLowerCase();
  
  // 여러 형태로 시도
  if (voiceNameMap[lowerId]) return voiceNameMap[lowerId];
  if (voiceNameMap[upperId]) return voiceNameMap[upperId];
  if (voiceNameMap[titleCaseId]) return voiceNameMap[titleCaseId];
  
  // 이미 한글이 포함되어 있으면 그대로 반환
  if (/[가-힣]/.test(normalizedId)) {
    return normalizedId;
  }
  
  // 매핑이 없으면 기본값 반환 (영어 이름이면 그대로 반환)
  return fallback || normalizedId;
}

/**
 * 음성 이름을 표시용으로 변환 (DB 우선, 폴백으로 로컬 매핑)
 * voiceName이 있으면 우선 사용, 없으면 voiceId를 한글로 변환
 * @param voiceName - 음성 이름 (이미 한글이거나 영어)
 * @param voiceId - 음성 ID
 * @param nameKo - DB에서 가져온 한글 이름 (선택사항)
 * @returns 표시용 한글 이름
 */
export async function getVoiceDisplayNameKoAsync(
  voiceName?: string | null,
  voiceId?: string | null,
  nameKo?: string | null
): Promise<string> {
  // DB에서 가져온 한글 이름이 있으면 우선 사용
  if (nameKo) {
    return nameKo;
  }

  // voiceName이 있고 한글이 포함되어 있으면 그대로 사용
  if (voiceName && /[가-힣]/.test(voiceName)) {
    return voiceName;
  }
  
  // voiceName이 있으면 우선 사용
  if (voiceName) {
    // 영어 이름이면 한글로 변환 시도
    const koName = getVoiceNameKo(voiceName);
    if (koName !== voiceName) {
      return koName;
    }
    return voiceName;
  }
  
  // voiceId로 한글 이름 찾기
  if (voiceId) {
    return getVoiceNameKo(voiceId, voiceId);
  }
  
  return "알 수 없음";
}

/**
 * 음성 이름을 표시용으로 변환 (동기 버전, DB 조회 없이 로컬 매핑만 사용)
 * voiceName이 있으면 우선 사용, 없으면 voiceId를 한글로 변환
 * @param voiceName - 음성 이름 (이미 한글이거나 영어)
 * @param voiceId - 음성 ID
 * @param nameKo - DB에서 가져온 한글 이름 (선택사항)
 * @returns 표시용 한글 이름
 */
// 접두사 영어 → 한글 변환 함수
function translatePrefix(prefix: string): string {
  if (!prefix) return prefix;
  
  // 접두사 패턴: [Choice], [New], [Meme] 등
  const prefixMap: Record<string, string> = {
    '[New]': '[신규]',
    '[NEW]': '[신규]',
    '[new]': '[신규]',
    '[Meme]': '[밈]',
    '[MEME]': '[밈]',
    '[meme]': '[밈]',
    '[Choice]': '[선택]',
    '[CHOICE]': '[선택]',
    '[choice]': '[선택]',
  };
  
  // 정확한 매칭 시도
  if (prefixMap[prefix.trim()]) {
    return prefixMap[prefix.trim()];
  }
  
  // 부분 매칭 (공백 제거 후)
  const trimmedPrefix = prefix.trim();
  if (prefixMap[trimmedPrefix]) {
    return prefixMap[trimmedPrefix];
  }
  
  return prefix;
}

export function getVoiceDisplayNameKo(
  voiceName?: string | null,
  voiceId?: string | null,
  nameKo?: string | null
): string {
  // DB에서 가져온 name_ko가 있으면 확인
  if (nameKo) {
    // name_ko가 한글이 포함되어 있으면 접두사 확인 후 반환
    if (/[가-힣]/.test(nameKo)) {
      // 한글이 있지만 접두사가 영어일 수 있음 (예: "[New] 상철")
      const prefixMatch = nameKo.match(/^(\[[^\]]+\]\s*)?(.+)$/);
      if (prefixMatch && prefixMatch[1]) {
        const translatedPrefix = translatePrefix(prefixMatch[1]);
        const baseName = prefixMatch[2];
        // 접두사가 변경되면 업데이트된 접두사 + 기본 이름 반환
        if (translatedPrefix !== prefixMatch[1]) {
          return translatedPrefix + baseName;
        }
      }
      return nameKo;
    }
    
    // name_ko가 영어이면 한글로 변환 시도
    // "[Choice] Kevin", "[New] Takumi" 같은 형식 처리
    const nameKoTrimmed = nameKo.trim();
    
    // 접두사 패턴: [Choice], [New], [Meme] 등
    const prefixMatch = nameKoTrimmed.match(/^(\[[^\]]+\]\s*)?(.+)$/);
    const prefix = prefixMatch?.[1] || "";
    const translatedPrefix = translatePrefix(prefix); // 접두사 한글 변환
    let baseName = (prefixMatch?.[2] || nameKoTrimmed).trim();
    
    // 여러 단어가 있을 수 있음 (예: "Ppang BuJang", "Quinn George")
    // 공백으로 분리하여 각각 변환 시도
    const nameParts = baseName.split(/\s+/);
    const translatedParts = nameParts.map(part => {
      const koPart = getVoiceNameKo(part.trim());
      // 변환 성공했으면 한글 이름, 아니면 원본 유지
      return koPart !== part.trim() ? koPart : part.trim();
    });
    
    const translatedName = translatedParts.join(" ");
    
    // 접두사와 이름을 모두 변환하여 반환
    return translatedPrefix + translatedName;
  }

  // voiceName이 있고 한글이 포함되어 있으면 그대로 사용
  if (voiceName && /[가-힣]/.test(voiceName)) {
    return voiceName;
  }
  
  // voiceName이 있으면 우선 사용
  if (voiceName) {
    // 영어 이름이면 한글로 변환 시도
    const koName = getVoiceNameKo(voiceName);
    if (koName !== voiceName) {
      return koName;
    }
    return voiceName;
  }
  
  // voiceId로 한글 이름 찾기
  if (voiceId) {
    return getVoiceNameKo(voiceId, voiceId);
  }
  
  return "알 수 없음";
}

