import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import type { Contact } from '@/types/contact';

interface AssigneePickerProps {
  contacts: Contact[];
  value: string[];
  onChange: (contactIds: string[]) => void;
  disabled?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AssigneePicker({
  contacts,
  value,
  onChange,
  disabled = false,
  className,
  open: controlledOpen,
  onOpenChange,
}: AssigneePickerProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const handleSelect = (contactId: string) => {
    // Toggle selection for multi-select
    if (value.includes(contactId)) {
      // Remove from selection
      onChange(value.filter(id => id !== contactId));
    } else {
      // Add to selection
      onChange([...value, contactId]);
    }
    // Don't close popover for multi-select (keep it open like labels)
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              size="icon"
              className={cn('h-6 w-6', className)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <p>{t('addAssignee')}</p>
          <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>P</Kbd></span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('searchAssignees')} />
          <CommandList>
            <CommandEmpty>
              <span className="text-muted-foreground">
                {t('noAssigneesFound')}
              </span>
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => {
                const fullName = `${contact.name} ${contact.lastname}`.trim();
                const isSelected = value.includes(contact.id);
                return (
                  <CommandItem
                    key={contact.id}
                    value={fullName}
                    onSelect={() => handleSelect(contact.id)}
                    className="flex items-center justify-between"
                  >
                    <span className="truncate">{fullName}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
