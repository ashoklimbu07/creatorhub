"use client"

import { CalendarIcon, X } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function SchedulePicker({
  value,
  onChange,
  disabled,
}: {
  value: Date | null
  onChange: (date: Date | null) => void
  disabled?: boolean
}) {
  function handleDaySelect(day: Date | undefined) {
    if (!day) return
    const next = new Date(day)
    if (value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0)
    } else {
      next.setHours(9, 0, 0, 0)
    }
    onChange(next)
  }

  function handleTimeChange(timeValue: string) {
    if (!timeValue) return
    const [hours, minutes] = timeValue.split(":").map(Number)
    const base = value ? new Date(value) : new Date()
    base.setHours(hours, minutes, 0, 0)
    onChange(base)
  }

  const timeValue = value
    ? `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
    : ""

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start font-normal sm:w-auto",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon />
            {value ? value.toLocaleDateString() : "Publish immediately"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            onSelect={handleDaySelect}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <>
          <Input
            type="time"
            value={timeValue}
            disabled={disabled}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-28"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label="Clear schedule"
          >
            <X />
          </Button>
        </>
      )}
    </div>
  )
}
