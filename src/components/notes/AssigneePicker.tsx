import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Plus, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAssignees } from '@/hooks/useAssignees';
import type { AssigneeSuggestion } from '@/types/ai';

interface AssigneePickerProps {
  value: string | null;
  onChange: (assigneeId: string | null) => void;
  aiSuggestion?: AssigneeSuggestion | null;
  disabled?: boolean;
  compact?: boolean;
}

export function AssigneePicker({
  value,
  onChange,
  aiSuggestion,
  disabled = false,
  compact = false,
}: AssigneePickerProps) {
  const { t } = useTranslation();
  const { assignees, createAssignee } = useAssignees();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const selectedAssignee = assignees.find((a) => a.id === value);

  const handleSelect = (assigneeId: string) => {
    onChange(assigneeId === value ? null : assigneeId);
    setOpen(false);
  };

  const handleCreateNew = async () => {
    if (!inputValue.trim()) return;

    const newAssignee = await createAssignee(inputValue.trim());
    onChange(newAssignee.id);
    setInputValue('');
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const handleAcceptSuggestion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (aiSuggestion) {
      onChange(aiSuggestion.assigneeId);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'justify-between',
              compact ? 'h-7 px-2 text-xs' : 'h-9 px-3',
              !selectedAssignee && 'text-muted-foreground'
            )}
          >
            <div className="flex items-center gap-2">
              <User className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-4 w-4')} />
              <span className="truncate max-w-[120px]">
                {selectedAssignee?.name || t('ai.assignee.placeholder', 'Assignee')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {selectedAssignee && (
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
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder={t('ai.assignee.search', 'Search assignee...')}
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {inputValue.trim() ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={handleCreateNew}
                  >
                    <Plus className="h-4 w-4" />
                    {t('ai.assignee.create', 'Create "{{name}}"', { name: inputValue })}
                  </Button>
                ) : (
                  <span className="text-muted-foreground">
                    {t('ai.assignee.noResults', 'No assignees found')}
                  </span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {assignees.map((assignee) => (
                  <CommandItem
                    key={assignee.id}
                    value={assignee.name}
                    onSelect={() => handleSelect(assignee.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === assignee.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    {assignee.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {inputValue.trim() && !assignees.some((a) => a.name.toLowerCase() === inputValue.toLowerCase()) && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={handleCreateNew}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('ai.assignee.create', 'Create "{{name}}"', { name: inputValue })}
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* AI Suggestion indicator */}
      {aiSuggestion && !value && (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950',
            compact && 'h-6 px-2'
          )}
          onClick={handleAcceptSuggestion}
        >
          <span className="font-medium">{aiSuggestion.assigneeName}</span>
          <span className="text-muted-foreground">
            ({Math.round(aiSuggestion.confidence * 100)}%)
          </span>
        </Button>
      )}
    </div>
  );
}
