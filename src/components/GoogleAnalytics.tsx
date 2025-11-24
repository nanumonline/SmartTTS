import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initGoogleAnalytics, trackPageView } from "@/lib/googleAnalytics";

/**
 * Google Analytics 컴포넌트
 * 앱 전체에서 페이지 뷰를 자동으로 추적합니다.
 */
export default function GoogleAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Google Analytics 초기화
    initGoogleAnalytics();
  }, []);

  useEffect(() => {
    // 페이지 변경 시 페이지 뷰 추적
    if (location.pathname) {
      trackPageView(location.pathname);
    }
  }, [location.pathname]);

  return null; // UI 렌더링 없음
}

