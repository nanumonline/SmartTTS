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

// 클립보드 이미지를 DataURL로 변환
export async function clipboardToDataUrl(): Promise<string | null> {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      }
    }
    return null;
  } catch (error) {
    console.error("클립보드 읽기 실패:", error);
    return null;
  }
}

