import * as React from "react"
import { format } from "date-fns"
import { es, enUS } from "date-fns/locale"
import { Calendar as CalendarIcon, X, ChevronDown, Clock } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  iconOnly?: boolean
  showTime?: boolean
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
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === "es" ? es : enUS
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [parsedDate, setParsedDate] = React.useState<Date | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

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
    onDateChange(newDate)
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
      onDateChange(finalDate)
      setOpen(false)
    }
    if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={iconOnly ? "icon" : "sm"}
          className={cn(
            iconOnly ? "h-8 w-8 shadow-none" : "justify-start text-left font-normal gap-1.5",
            !date && "text-muted-foreground",
            className
          )}
        >
          {iconOnly ? (
            <CalendarIcon className="h-4 w-4" />
          ) : (
            <>
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">
                {date
                  ? showTime
                    ? format(date, "PPP p", { locale })
                    : format(date, "PPP", { locale })
                  : placeholder}
              </span>
              {date && (
                <X
                  className="ml-auto h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDateChange(undefined)
                  }}
                />
              )}
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={t('naturalDatePlaceholder', 'tomorrow, next friday, in 3 days')}
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
              if (date) {
                // Preserve time from existing date
                newDate.setHours(date.getHours(), date.getMinutes())
              } else {
                // Set default time (current time) when no existing date
                const now = new Date()
                newDate.setHours(now.getHours(), now.getMinutes())
              }
            }
            onDateChange(newDate)
            if (!showTime) {
              setOpen(false)
            }
          }}
          locale={locale}
          weekStartsOn={1}
        />
        {showTime && date && (
          <div className="flex items-center gap-2 p-3 border-t">
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
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              {t('save', 'OK')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
