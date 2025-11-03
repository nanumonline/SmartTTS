import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ScriptsTemplatesPage는 MessageTemplatePage로 리다이렉트 (중복 제거)
export default function ScriptsTemplatesPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    navigate("/scripts/templates", { replace: true });
  }, [navigate]);

  return null;
}
