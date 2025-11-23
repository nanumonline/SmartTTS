// 브랜드 설정 관리 유틸리티

export interface BrandSettings {
  organizationName: string;
  logoUrl: string;
  logoDataUrl?: string; // base64 이미지 데이터
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  termsOfService: string;
  privacyPolicy: string;
  enableBranding: boolean;
}

const BRAND_SETTINGS_KEY = "brand_settings";

// 기본 브랜드 설정
const defaultBrandSettings: BrandSettings = {
  organizationName: "",
  logoUrl: "",
  logoDataUrl: undefined,
  primaryColor: "#3b82f6",
  secondaryColor: "#8b5cf6",
  footerText: "",
  termsOfService: "",
  privacyPolicy: "",
  enableBranding: true,
};

// 브랜드 설정 저장
export function saveBrandSettings(settings: BrandSettings): void {
  try {
    localStorage.setItem(BRAND_SETTINGS_KEY, JSON.stringify(settings));
    // 커스텀 이벤트 발생 (같은 탭에서도 반영되도록)
    window.dispatchEvent(new CustomEvent("brandSettingsChanged"));
  } catch (error) {
    console.error("브랜드 설정 저장 실패:", error);
  }
}

// 브랜드 설정 로드
export function loadBrandSettings(): BrandSettings {
  try {
    const saved = localStorage.getItem(BRAND_SETTINGS_KEY);
    if (saved) {
      return { ...defaultBrandSettings, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error("브랜드 설정 로드 실패:", error);
  }
  return defaultBrandSettings;
}

// 로고 URL 가져오기 (DataURL 우선, 없으면 URL)
export function getLogoUrl(settings?: BrandSettings): string | undefined {
  const brandSettings = settings || loadBrandSettings();
  if (brandSettings.logoDataUrl) {
    return brandSettings.logoDataUrl;
  }
  if (brandSettings.logoUrl) {
    return brandSettings.logoUrl;
  }
  return undefined;
}

// 파일을 DataURL로 변환
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Hex 색상을 HSL로 변환
export function hexToHsl(hex: string): string {
  // # 제거
  const cleanHex = hex.replace('#', '');
  
  // RGB 추출
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

// 브랜드 색상을 CSS 변수로 적용
export function applyBrandColors(primaryColor: string, secondaryColor: string): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  
  // Hex를 HSL로 변환
  const primaryHsl = hexToHsl(primaryColor);
  const secondaryHsl = hexToHsl(secondaryColor);

  // CSS 변수 업데이트
  root.style.setProperty('--primary', primaryHsl);
  root.style.setProperty('--accent', secondaryHsl);
  root.style.setProperty('--ring', primaryHsl);
  
  // 다크 모드에서도 동일하게 적용
  root.style.setProperty('--sidebar-ring', primaryHsl);
  root.style.setProperty('--sidebar-primary', primaryHsl);
  
  // 그라데이션도 업데이트
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${primaryHsl}), hsl(${secondaryHsl}))`);
  root.style.setProperty('--gradient-audio', `linear-gradient(90deg, hsl(${primaryHsl}), hsl(${secondaryHsl}))`);
  
  // 그림자 효과도 업데이트
  root.style.setProperty('--shadow-glow', `0 0 40px hsl(${primaryHsl} / 0.3)`);
}

// 클립보드 이미지를 DataURL로 변환
export async function clipboardToDataUrl(): Promise<string | null> {
  // 클립보드 API 지원 여부 확인
  if (!navigator.clipboard || !navigator.clipboard.read) {
    console.warn("클립보드 API를 지원하지 않습니다. HTTPS 환경에서만 사용 가능합니다.");
    return null;
  }

  try {
    // 권한 확인 (선택적, 일부 브라우저에서만 지원)
    let hasPermission = true;
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
        hasPermission = permissionStatus.state !== "denied";
      } catch {
        // 권한 API를 지원하지 않는 경우 무시
      }
    }

    if (!hasPermission) {
      console.warn("클립보드 읽기 권한이 없습니다.");
      return null;
    }

    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => {
              console.error("파일 읽기 실패:", error);
              reject(error);
            };
            reader.readAsDataURL(blob);
          });
        }
      }
    }
    return null;
  } catch (error: any) {
    // 특정 에러 타입에 대한 더 자세한 처리
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      console.warn("클립보드 접근 권한이 거부되었습니다. 사용자 제스처(클릭)가 필요합니다.");
    } else if (error.name === "NotFoundError") {
      console.warn("클립보드에 이미지가 없습니다.");
    } else {
      console.error("클립보드 읽기 실패:", error);
    }
    return null;
  }
}

