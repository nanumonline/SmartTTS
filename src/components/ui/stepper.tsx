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
    <div className={cn("flex items-center justify-between w-full", className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;

        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors flex-shrink-0",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isActive && "bg-primary border-primary text-primary-foreground",
                    isPending && "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 ml-4 mr-4 hidden md:block">
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
                    <div className="text-xs text-muted-foreground mt-1">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "hidden md:flex flex-1 h-0.5 mx-2 transition-colors",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

