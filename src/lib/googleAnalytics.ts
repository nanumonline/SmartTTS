/**
 * Google Analytics 통합
 * 환경 변수 VITE_GA_MEASUREMENT_ID를 통해 GA ID를 설정합니다.
 */

declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string | Date,
      config?: Record<string, any>
    ) => void;
    dataLayer?: any[];
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/**
 * Google Analytics 초기화
 */
export function initGoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) {
    console.warn("[GA] Google Analytics ID가 설정되지 않았습니다.");
    return;
  }

  // 이미 초기화되었는지 확인
  if (window.gtag) {
    return;
  }

  // gtag 스크립트 추가
  const script1 = document.createElement("script");
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script1);

  // dataLayer 초기화
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };

  // gtag 설정
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
  });

  console.log(`[GA] Google Analytics 초기화 완료: ${GA_MEASUREMENT_ID}`);
}

/**
 * 페이지 뷰 추적
 */
export function trackPageView(path: string, title?: string) {
  if (!GA_MEASUREMENT_ID || !window.gtag) {
    return;
  }

  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: path,
    page_title: title || document.title,
  });

  console.log(`[GA] Page view: ${path}`);
}

/**
 * 이벤트 추적
 */
export function trackEvent(
  eventName: string,
  eventParams?: {
    category?: string;
    label?: string;
    value?: number;
    [key: string]: any;
  }
) {
  if (!GA_MEASUREMENT_ID || !window.gtag) {
    return;
  }

  window.gtag("event", eventName, eventParams);
  console.log(`[GA] Event: ${eventName}`, eventParams);
}

/**
 * 사용자 액션 추적 (예: 버튼 클릭, 음원 생성 등)
 */
export function trackUserAction(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  trackEvent(action, {
    event_category: category,
    event_label: label,
    value: value,
  });
}

/**
 * 음원 생성 추적
 */
export function trackAudioGeneration(voiceId?: string, duration?: number) {
  trackEvent("audio_generation", {
    event_category: "audio",
    event_label: voiceId || "unknown",
    value: duration || 0,
  });
}

/**
 * 방송 송출 추적
 */
export function trackBroadcast(channelId?: string, scheduleType?: string) {
  trackEvent("broadcast", {
    event_category: "broadcast",
    event_label: channelId || "unknown",
    schedule_type: scheduleType || "unknown",
  });
}

/**
 * 에러 추적
 */
export function trackError(error: Error | string, fatal: boolean = false) {
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack = typeof error === "string" ? undefined : error.stack;

  trackEvent("exception", {
    description: errorMessage,
    fatal: fatal,
    stack: errorStack,
  });
}

