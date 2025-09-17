"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Lang } from "@/types/lang";
import { languageNames } from "@/lib/i18n";
import { Globe } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  
  const languages: Lang[] = ['zh', 'en', 'ja'];

  const handleLanguageChange = (newLang: Lang) => {
    setLanguage(newLang);
    
    // 如果在shadowing页面，同步更新URL参数
    if (pathname && pathname.startsWith('/practice/shadowing')) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('lang', newLang);
      router.push(currentUrl.pathname + currentUrl.search, { scroll: false });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{languageNames[language][language]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={language === lang ? "bg-accent" : ""}
          >
            <div className="flex items-center justify-between w-full">
              <span>{languageNames[language][lang]}</span>
              {language === lang && <span className="text-xs">✓</span>}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
