import * as React from "react"
import { format } from "date-fns"
import { es, enUS } from "date-fns/locale"
import { Calendar as CalendarIcon, X, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date: Date | undefined
  onDateChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  iconOnly?: boolean
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Pick a date",
  className,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  iconOnly = false,
}: DatePickerProps) {
  const { i18n } = useTranslation()
  const locale = i18n.language === "es" ? es : enUS
  const [internalOpen, setInternalOpen] = React.useState(false)

  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOnOpenChange || setInternalOpen

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
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
              <span className="truncate">{date ? format(date, "PPP", { locale }) : placeholder}</span>
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
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            onDateChange(newDate)
            setOpen(false)
          }}
          locale={locale}
          weekStartsOn={1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
