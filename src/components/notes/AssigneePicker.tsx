import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, User, X } from 'lucide-react';
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
import type { Contact } from '@/types/contact';

interface AssigneePickerProps {
  contacts: Contact[];
  value: string | null;
  onChange: (contactId: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AssigneePicker({
  contacts,
  value,
  onChange,
  disabled = false,
  compact = false,
  iconOnly = false,
  className,
  open: controlledOpen,
  onOpenChange,
}: AssigneePickerProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const selectedContact = contacts.find((c) => c.id === value);
  const displayName = selectedContact
    ? `${selectedContact.name} ${selectedContact.lastname}`.trim()
    : null;

  const handleSelect = (contactId: string) => {
    onChange(contactId === value ? null : contactId);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          size={iconOnly ? 'icon' : 'default'}
          className={cn(
            iconOnly ? 'h-8 w-8 shadow-none' : 'justify-between',
            !iconOnly && compact ? 'h-7 px-2 text-xs' : !iconOnly && 'h-9 px-3',
            !selectedContact && 'text-muted-foreground',
            className
          )}
        >
          {iconOnly ? (
            <User className="h-4 w-4" />
          ) : (
            <>
              <div className="flex items-center gap-2 min-w-0">
                <User className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-4 w-4')} />
                <span className="truncate">
                  {displayName || t('assignee.placeholder')}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selectedContact && (
                  <X
                    className={cn(
                      'shrink-0 opacity-50 hover:opacity-100',
                      compact ? 'h-3 w-3' : 'h-4 w-4'
                    )}
                    onClick={handleClear}
                  />
                )}
                <ChevronsUpDown
                  className={cn('shrink-0 opacity-50', compact ? 'h-3 w-3' : 'h-4 w-4')}
                />
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('assignee.search')} />
          <CommandList>
            <CommandEmpty>
              <span className="text-muted-foreground">
                {t('assignee.noResults')}
              </span>
            </CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => {
                const fullName = `${contact.name} ${contact.lastname}`.trim();
                return (
                  <CommandItem
                    key={contact.id}
                    value={fullName}
                    onSelect={() => handleSelect(contact.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === contact.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{fullName}</span>
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
