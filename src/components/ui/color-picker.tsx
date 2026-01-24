import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  presetColors?: string[];
  className?: string;
}

const DEFAULT_PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

export function ColorPicker({
  color,
  onChange,
  presetColors = DEFAULT_PRESET_COLORS,
  className,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start gap-2 font-normal',
            className
          )}
        >
          <div
            className="h-4 w-4 rounded-full border border-muted-foreground/25"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-muted-foreground uppercase">{color}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          <HexColorPicker color={color} onChange={onChange} />
          <div className="flex flex-wrap gap-1.5">
            {presetColors.map((presetColor) => (
              <button
                key={presetColor}
                type="button"
                onClick={() => onChange(presetColor)}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-all hover:scale-110',
                  color === presetColor
                    ? 'border-primary ring-2 ring-primary ring-offset-2'
                    : 'border-transparent'
                )}
                style={{ backgroundColor: presetColor }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={color}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '') {
                  onChange(value || '#');
                }
              }}
              className="flex-1 px-2 py-1 text-xs border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40 uppercase text-foreground caret-foreground"
              placeholder="#000000"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
