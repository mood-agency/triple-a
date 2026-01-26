import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HotkeyItem {
  keys: string[];
  action: string;
}

interface HotkeySection {
  title: string;
  items: HotkeyItem[];
}

export function HotkeysHelper() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const sections: HotkeySection[] = [
    {
      title: t('hotkeys.global'),
      items: [
        { keys: ['Ctrl', 'K'], action: t('hotkeys.openCommandPalette') },
        { keys: ['Ctrl', 'F'], action: t('hotkeys.focusSearch') },
        { keys: ['Alt', 'Q'], action: t('hotkeys.filterTodo') },
        { keys: ['Alt', 'W'], action: t('hotkeys.filterFollowup') },
        { keys: ['Alt', 'E'], action: t('hotkeys.filterMeeting') },
        { keys: ['Alt', 'R'], action: t('hotkeys.filterNotes') },
        { keys: ['Alt', 'P'], action: t('hotkeys.filterAssignee') },
        { keys: ['Alt', 'C'], action: t('hotkeys.clearFilters') },
        { keys: ['Alt', 'V'], action: t('hotkeys.toggleView') },
        { keys: ['Alt', 'F'], action: t('hotkeys.toggleCompact') },
        { keys: ['Alt', 'S'], action: t('hotkeys.toggleSidebar') },
        { keys: ['Esc'], action: t('hotkeys.deselectTask') },
      ],
    },
    {
      title: t('hotkeys.taskTitle'),
      items: [
        { keys: ['↑', '↓'], action: t('hotkeys.navigateTasks') },
        { keys: ['Enter'], action: t('hotkeys.createTask') },
        { keys: ['Tab'], action: t('hotkeys.goToDescription') },
        { keys: ['Backspace'], action: t('hotkeys.deleteEmpty') },
        { keys: ['Ctrl', 'D'], action: t('hotkeys.toggleComplete') },
        { keys: ['Ctrl', 'Backspace'], action: t('hotkeys.deleteTask') },
      ],
    },
  ];

  return (
    <>
      {/* Floating hotkeys button */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          title={t('hotkeys.title')}
        >
          <Keyboard className="h-5 w-5" />
        </Button>
      </div>

      {/* Hotkeys panel */}
      {isOpen && (
        <div className="fixed bottom-28 right-4 w-80 max-h-[70vh] overflow-y-auto rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg z-50">
          <div className="sticky top-0 flex items-center justify-between p-3 border-b bg-background/95 backdrop-blur">
            <h3 className="font-semibold text-sm">{t('hotkeys.title')}</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3 space-y-4">
            {sections.map((section) => (
              <div key={section.title}>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  {section.title}
                </h4>
                <div className="space-y-1.5">
                  {section.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{item.action}</span>
                      <div className="flex gap-1">
                        {item.keys.map((key, keyIndex) => (
                          <kbd
                            key={keyIndex}
                            className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border border-muted-foreground/20"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </>
  );
}
