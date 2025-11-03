import React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "default" | "wide" | "full";
}

export default function PageContainer({ 
  children, 
  className,
  maxWidth = "default" 
}: PageContainerProps) {
  const maxWidthClasses = {
    default: "max-w-7xl", // 1280px
    wide: "max-w-[1920px]", // FHD 와이드
    full: "max-w-full",
  };

  return (
    <div className={cn(
      "w-full mx-auto px-4 sm:px-6 lg:px-8",
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  );
}

