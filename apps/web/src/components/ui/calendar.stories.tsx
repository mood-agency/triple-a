import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DateRange } from 'react-day-picker'
import { Calendar } from './calendar'
import { useState } from 'react'

const meta: Meta<typeof Calendar> = {
  title: 'UI/Calendar',
  component: Calendar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Calendar>

export const Default: Story = {
  args: {},
}

export const WithSelectedDate: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date())
    return (
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
      />
    )
  },
}

export const WithDateRange: Story = {
  render: () => {
    const [range, setRange] = useState<{ from: Date; to?: Date } | undefined>({
      from: new Date(),
      to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    return (
      <Calendar
        mode="range"
        selected={range}
        onSelect={(value: DateRange | undefined) => {
          if (value?.from) {
            setRange({ from: value.from, to: value.to });
          } else {
            setRange(undefined);
          }
        }}
      />
    )
  },
}

export const WithDropdownNavigation: Story = {
  args: {
    captionLayout: 'dropdown',
    fromYear: 2020,
    toYear: 2030,
  },
}

export const MultipleMonths: Story = {
  args: {
    numberOfMonths: 2,
  },
}

export const DarkMode: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date())
    return (
      <div className="dark bg-background p-4 rounded-lg">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
        />
      </div>
    )
  },
}

export const WithDisabledDates: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date())
    const today = new Date()

    return (
      <Calendar
        mode="single"
        selected={date}
        onSelect={setDate}
        disabled={(day) => day < today}
      />
    )
  },
}
