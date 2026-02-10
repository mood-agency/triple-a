import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
] as const;

interface LanguageSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LanguageSelector({ open, onOpenChange }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('app-language', code);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('language', 'Language')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => selectLanguage(lang.code)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors cursor-pointer"
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.label}</span>
              {i18n.language === lang.code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
