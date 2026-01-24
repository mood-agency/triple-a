import * as React from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { parseNaturalDate } from '@/utils/naturalDateParser';

interface NaturalDateInputProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function NaturalDateInput({
  value,
  onChange,
  placeholder = 'e.g. tomorrow, next friday, in 3 days',
  className,
}: NaturalDateInputProps) {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'es' ? es : enUS;

  const [inputValue, setInputValue] = React.useState('');
  const [parsedDate, setParsedDate] = React.useState<Date | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  // Update input when external value changes
  React.useEffect(() => {
    if (value && !inputValue) {
      setInputValue(format(value, 'PPP', { locale }));
      setParsedDate(value);
    }
  }, [value, locale, inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);

    if (!text.trim()) {
      setParsedDate(null);
      return;
    }

    const parsed = parseNaturalDate(text);
    setParsedDate(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && parsedDate) {
      onChange(parsedDate);
      setInputValue(format(parsedDate, 'PPP', { locale }));
    }
    if (e.key === 'Escape') {
      setInputValue('');
      setParsedDate(null);
      onChange(undefined);
    }
  };

  const handleBlur = () => {
    if (parsedDate) {
      onChange(parsedDate);
      setInputValue(format(parsedDate, 'PPP', { locale }));
    } else if (!inputValue.trim()) {
      onChange(undefined);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date);
      setInputValue(format(date, 'PPP', { locale }));
      setParsedDate(date);
    }
    setCalendarOpen(false);
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="pr-8"
          />
          {parsedDate && inputValue && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              ✓
            </div>
          )}
        </div>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={parsedDate ?? value}
              onSelect={handleCalendarSelect}
              locale={locale}
              weekStartsOn={1}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {parsedDate && inputValue && (
        <p className="text-xs text-muted-foreground">
          {format(parsedDate, 'PPPP', { locale })}
        </p>
      )}
    </div>
  );
}
