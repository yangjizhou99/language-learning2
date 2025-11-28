import React from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';

interface FilterLanguageSelectorProps {
  value: 'ja' | 'en' | 'zh' | 'ko';
  onChange: (lang: 'ja' | 'en' | 'zh' | 'ko') => void;
  allowedLanguages: string[];
  className?: string;
}

export default function FilterLanguageSelector({
  value,
  onChange,
  allowedLanguages,
  className = 'h-11',
}: FilterLanguageSelectorProps) {
  const { t } = useLanguage();
  const labels = t.vocabulary.language_labels;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{t.vocabulary.filters.language}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={`${className} bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-gray-200 shadow-lg">
          {allowedLanguages.includes('ja') && (
            <SelectItem value="ja" className="rounded-lg">
              {labels.ja}
            </SelectItem>
          )}
          {allowedLanguages.includes('en') && (
            <SelectItem value="en" className="rounded-lg">
              {labels.en}
            </SelectItem>
          )}
          {allowedLanguages.includes('zh') && (
            <SelectItem value="zh" className="rounded-lg">
              {labels.zh}
            </SelectItem>
          )}
          {allowedLanguages.includes('ko') && (
            <SelectItem value="ko" className="rounded-lg">
              {labels.ko}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
