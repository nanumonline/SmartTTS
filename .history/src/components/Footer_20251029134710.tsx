import { Mic2, Mail, Phone, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border py-12 px-4">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Mic2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold gradient-text">Smart TTS</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI 기반 음성 합성으로 더 스마트한 방송 관리를 경험하세요
            </p>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h4 className="font-semibold">서비스</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/voice-generator" className="hover:text-primary transition-colors">음성 생성</Link></li>
              <li><Link to="/voice-cloning" className="hover:text-primary transition-colors">보이스 클로닝</Link></li>
              <li><Link to="/schedule" className="hover:text-primary transition-colors">스케줄 관리</Link></li>
              <li><Link to="/advanced-voice" className="hover:text-primary transition-colors">고급 음성 생성</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h4 className="font-semibold">회사</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">회사 소개</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">고객 지원</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">이용 약관</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">개인정보처리방침</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold">연락처</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                june@nanumlab.com
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                033-912-1004
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                강원특별자치도 춘천시 후석로 462번길 7, 춘천ICT벤처센터 307
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Smart TTS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
