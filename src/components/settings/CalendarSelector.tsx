import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { GCalCalendar } from '@/types/googleCalendar';

interface CalendarSelectorProps {
  calendars: GCalCalendar[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  loading?: boolean;
}

export function CalendarSelector({
  calendars,
  selectedIds,
  onChange,
  loading = false,
}: CalendarSelectorProps) {
  const handleToggle = (calendarId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, calendarId]);
    } else {
      onChange(selectedIds.filter((id) => id !== calendarId));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No calendars found
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {calendars.map((calendar) => (
        <div key={calendar.id} className="flex items-center gap-3">
          <Checkbox
            id={`calendar-${calendar.id}`}
            checked={selectedIds.includes(calendar.id)}
            onCheckedChange={(checked) => handleToggle(calendar.id, checked === true)}
          />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {calendar.backgroundColor && (
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: calendar.backgroundColor }}
              />
            )}
            <Label
              htmlFor={`calendar-${calendar.id}`}
              className="text-sm font-normal cursor-pointer truncate"
            >
              {calendar.summary}
              {calendar.primary && (
                <span className="text-muted-foreground ml-1">(Primary)</span>
              )}
            </Label>
          </div>
        </div>
      ))}
    </div>
  );
}
