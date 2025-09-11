"use client";
import { Button } from "@/components/ui/button";
import { Smartphone, Monitor } from "lucide-react";
import { useMobile } from "@/contexts/MobileContext";

interface MobileToggleProps {
  onToggle?: (isMobile: boolean) => void;
  className?: string;
}

export default function MobileToggle({ onToggle, className = "" }: MobileToggleProps) {
  const { actualIsMobile, screenWidth, setForceMobileMode } = useMobile();

  const handleToggle = () => {
    const newMode = !actualIsMobile;
    setForceMobileMode(newMode);
    onToggle?.(newMode);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-500 hidden sm:inline">
        {screenWidth}px
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={handleToggle}
        className="flex items-center gap-1 text-xs"
        title={actualIsMobile ? '切换到桌面端' : '切换到移动端'}
      >
        {actualIsMobile ? (
          <>
            <Monitor className="w-3 h-3" />
            <span className="hidden sm:inline">桌面</span>
          </>
        ) : (
          <>
            <Smartphone className="w-3 h-3" />
            <span className="hidden sm:inline">移动</span>
          </>
        )}
      </Button>
    </div>
  );
}
