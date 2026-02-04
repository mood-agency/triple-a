import * as React from "react"
import { format } from "date-fns"
import { es, enUS } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronDown, Clock } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { parseNaturalDate } from "@/utils/naturalDateParser"
import { hasTimeComponent } from "@/utils/dateUtils"

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined, isAllDay?: boolean) => void
  placeholder?: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  iconOnly?: boolean
  showTime?: boolean
  hideIcon?: boolean
  /** Externally controlled all-day state. When provided, overrides internal inference. */
  isAllDay?: boolean
  /** Called when user clicks Save button (only with showTime). If provided, postpone logic should use this instead of onDateChange */
  onSave?: (date: Date) => void
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  iconOnly = false,
  showTime = false,
  hideIcon = false,
  isAllDay: externalIsAllDay,
  onSave,
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === "es" ? es : enUS
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [parsedDate, setParsedDate] = React.useState<Date | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  // All day checkbox - use external prop if available, otherwise infer from time component
  const [isAllDay, setIsAllDay] = React.useState(() => {
    if (externalIsAllDay !== undefined) return externalIsAllDay
    if (!date) return true
    return !hasTimeComponent(date.toISOString())
  })

  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const baseSetOpen = externalOnOpenChange || setInternalOpen

  // Track the original date when popover opens (for postpone detection)
  const originalDateRef = React.useRef<Date | undefined>(undefined)

  // Wrap setOpen to detect when popover closes and trigger onSave if date changed
  const setOpen = React.useCallback((newOpen: boolean) => {
    if (newOpen) {
      // Popover opening - save the original date
      originalDateRef.current = date
    } else {
      // Popover closing - check if date (day) changed and call onSave
      // Only trigger postpone dialog if the actual date changed, not just the time
      // (e.g., switching between all-day and timed events shouldn't ask for reason)
      if (onSave && date && originalDateRef.current) {
        const originalDate = originalDateRef.current
        const sameDay =
          originalDate.getFullYear() === date.getFullYear() &&
          originalDate.getMonth() === date.getMonth() &&
          originalDate.getDate() === date.getDate()
        if (!sameDay) {
          onSave(date)
        }
      }
      originalDateRef.current = undefined
    }
    baseSetOpen(newOpen)
  }, [baseSetOpen, date, onSave])

  // Update isAllDay when external prop or date changes
  React.useEffect(() => {
    if (externalIsAllDay !== undefined) {
      setIsAllDay(externalIsAllDay)
    } else if (date) {
      setIsAllDay(!hasTimeComponent(date.toISOString()))
    }
  }, [date, externalIsAllDay])

  // Get current hours and minutes from date
  const hours = date ? date.getHours() : 12
  const minutes = date ? date.getMinutes() : 0

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      setInputValue("")
      setParsedDate(null)
      // Small delay to ensure popover is rendered
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const handleTimeChange = (type: 'hours' | 'minutes', value: string) => {
    if (!date) return
    const newDate = new Date(date)
    if (type === 'hours') {
      newDate.setHours(parseInt(value, 10))
    } else {
      newDate.setMinutes(parseInt(value, 10))
    }
    onDateChange(newDate, false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setInputValue(text)

    if (!text.trim()) {
      setParsedDate(null)
      return
    }

    const parsed = parseNaturalDate(text)
    setParsedDate(parsed)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && parsedDate) {
      const finalDate = new Date(parsedDate)
      if (showTime) {
        if (date) {
          // Preserve time from existing date
          finalDate.setHours(date.getHours(), date.getMinutes())
        } else {
          // Set default time (current time) when no existing date
          const now = new Date()
          finalDate.setHours(now.getHours(), now.getMinutes())
        }
      }
      onDateChange(finalDate, isAllDay)
      setOpen(false)
    }
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  // Check if the date is overdue (past)
  const isOverdue = React.useMemo(() => {
    if (!date) return false
    const now = new Date()
    return date < now
  }, [date])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          className={cn(
            iconOnly ? "h-8 w-8 shadow-none" : "justify-start text-left font-normal gap-1.5 px-1.5",
            !date && "text-muted-foreground",
            isOverdue && "text-destructive hover:text-destructive",
            className
          )}
        >
          {iconOnly ? (
            <CalendarIcon className="h-4 w-4" />
          ) : (
            <>
              {!hideIcon && <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />}
              <span className="truncate">
                {date
                  ? showTime
                    ? format(date, "dd/MM/yyyy HH:mm", { locale })
                    : format(date, "dd/MM/yyyy", { locale })
                  : placeholder}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onInteractOutside={(e) => {
          // Prevent closing when interacting with Select dropdown (rendered in a portal)
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-select-content]') ||
              target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          // Also prevent pointer down events from closing the popover
          const target = e.target as HTMLElement;
          if (target.closest('[data-radix-select-content]') ||
              target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          // Prevent focus change from closing the popover when using Select
          if (showTime) {
            e.preventDefault();
          }
        }}
      >
        <div className="p-3 border-b">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={t('naturalDatePlaceholder')}
            className="h-8 text-sm"
          />
          {parsedDate && inputValue && (
            <p className="text-xs text-muted-foreground mt-1">
              → {format(parsedDate, "PPPP", { locale })}
            </p>
          )}
        </div>
        <Calendar
          mode="single"
          selected={parsedDate ?? date}
          onSelect={(newDate) => {
            if (newDate && showTime) {
              if (isAllDay) {
                newDate.setHours(0, 0, 0, 0)
              } else if (date) {
                // Preserve time from existing date
                newDate.setHours(date.getHours(), date.getMinutes())
              } else {
                // Set default time (current time) when no existing date
                const now = new Date()
                newDate.setHours(now.getHours(), now.getMinutes())
              }
            }
            onDateChange(newDate, isAllDay)
            if (!showTime) {
              setOpen(false)
            }
          }}
          locale={locale}
          weekStartsOn={1}
        />
        {showTime && (
          <div className="p-3 border-t space-y-3">
            {date ? (
              <>
                {/* All day checkbox */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allDay"
                    checked={isAllDay}
                    onCheckedChange={(checked) => {
                      const allDay = checked === true
                      setIsAllDay(allDay)
                      if (allDay && date) {
                        // Set time to midnight for all-day
                        const newDate = new Date(date)
                        newDate.setHours(0, 0, 0, 0)
                        onDateChange(newDate, true)
                      } else if (!allDay && date) {
                        // Switching from all-day to timed - keep current date
                        onDateChange(date, false)
                      }
                    }}
                  />
                  <label
                    htmlFor="allDay"
                    className="text-sm text-muted-foreground cursor-pointer select-none"
                  >
                    {t('allDay', 'All day')}
                  </label>
                </div>
                {/* Time selectors - only show if not all day */}
                {!isAllDay && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={hours.toString().padStart(2, '0')}
                      onValueChange={(value) => handleTimeChange('hours', value)}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">:</span>
                    <Select
                      value={minutes.toString().padStart(2, '0')}
                      onValueChange={(value) => handleTimeChange('minutes', value)}
                    >
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 60 }, (_, i) => (
                          <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                            {i.toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => {
                      onDateChange(undefined)
                      setOpen(false)
                    }}
                  >
                    {t('clear', 'Clear')}
                  </Button>
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={() => {
                      // onSave is called automatically in setOpen when date changed
                      setOpen(false)
                    }}
                  >
                    {t('save', 'OK')}
                  </Button>
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                {t('selectDateFirst', 'Select a date first')}
              </span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
