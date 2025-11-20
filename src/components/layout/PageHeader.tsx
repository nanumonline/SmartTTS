import React from "react";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import BreadcrumbNav from "./BreadcrumbNav";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode | {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  showBreadcrumb?: boolean;
  className?: string;
}

export default function PageHeader({ 
  title, 
  description, 
  icon: Icon,
  action,
  showBreadcrumb = true,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6", className)}>
      {showBreadcrumb && <BreadcrumbNav />}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {Icon && <Icon className="w-6 h-6 text-primary" />}
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
          {description && (
            <p className="text-muted-foreground mt-1.5 ml-9">
              {description}
            </p>
          )}
        </div>
        {action && (
          typeof action === 'object' && 'onClick' in action ? (
            <Button onClick={action.onClick} className="flex items-center gap-2">
              {action.icon && <action.icon className="w-4 h-4" />}
              {action.label}
            </Button>
          ) : (
            action
          )
        )}
      </div>
    </div>
  );
}

