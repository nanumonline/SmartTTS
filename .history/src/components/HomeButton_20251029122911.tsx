import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";
import { Link } from "react-router-dom";

interface HomeButtonProps {
  variant?: "default" | "outline" | "ghost" | "gradient";
  size?: "sm" | "default" | "lg";
  className?: string;
}

const HomeButton = ({ variant = "outline", size = "sm", className = "" }: HomeButtonProps) => {
  return (
    <Link to="/">
      <Button variant={variant} size={size} className={`flex items-center gap-2 ${className}`}>
        <Home className="w-4 h-4" />
        홈으로
      </Button>
    </Link>
  );
};

export default HomeButton;
