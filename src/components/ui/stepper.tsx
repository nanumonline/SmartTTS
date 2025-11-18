import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepperStep {
  label: string;
  description?: string;
  completed?: boolean;
  active?: boolean;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

export function Stepper({
  steps,
  currentStep,
  className,
  orientation = "horizontal",
}: StepperProps) {
  if (orientation === "vertical") {
    return (
      <div className={cn("space-y-4", className)}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div key={index} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isActive && "bg-primary border-primary text-primary-foreground",
                    isPending && "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 mt-2 transition-colors",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
              <div className="flex-1 pb-8">
                <div
                  className={cn(
                    "font-medium transition-colors",
                    isActive && "text-primary",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* 데스크톱: 가로 배치 (2단 구조) */}
      <div className="hidden md:flex items-start justify-between w-full">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;

        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center flex-1">
                {/* 번호/아이콘 */}
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full border-2 transition-colors mb-3",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isActive && "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/50",
                    isPending && "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <span className="text-base font-semibold">{index + 1}</span>
                  )}
                </div>
                {/* 텍스트 영역 (버튼 형태) */}
                <div className="w-full px-2">
                  <div
                    className={cn(
                      "px-3 py-2 rounded-lg text-center transition-all",
                      isActive && "bg-primary/10 text-primary font-semibold",
                      isCompleted && "bg-muted/50 text-foreground",
                      isPending && "bg-transparent text-muted-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "font-medium text-sm mb-1",
                        isActive && "text-primary",
                        isPending && "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </div>
                    {step.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {step.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className="flex items-center px-2 pt-6">
                  <div
                    className={cn(
                      "flex-1 h-0.5 transition-colors",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* 모바일: 세로 배치 (2단 구조) */}
      <div className="md:hidden space-y-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div key={index} className="flex flex-col items-center">
              {/* 번호/아이콘 */}
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors mb-2",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isActive && "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/50",
                  isPending && "bg-muted border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              {/* 텍스트 영역 (버튼 형태) */}
              <div className="w-full px-1">
                <div
                  className={cn(
                    "px-3 py-2 rounded-lg text-center transition-all",
                    isActive && "bg-primary/10 text-primary font-semibold",
                    isCompleted && "bg-muted/50 text-foreground",
                    isPending && "bg-transparent text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "font-medium text-sm mb-1",
                      isActive && "text-primary",
                      isPending && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </div>
                  {step.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
        );
      })}
      </div>
    </div>
  );
}

