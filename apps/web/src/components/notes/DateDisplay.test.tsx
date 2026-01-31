import { describe, it, expect } from 'vitest'
import { render, screen } from '@tests/helpers/render'
import { DateDisplay } from './DateDisplay'

describe('DateDisplay', () => {
  describe('Rendering', () => {
    it('should render day name and full date', () => {
      const date = new Date('2026-02-15T12:00:00')
      render(<DateDisplay date={date} />)

      // Should show day name (Sunday, Monday, etc.)
      expect(screen.getByText(/sunday|monday|tuesday|wednesday|thursday|friday|saturday/i)).toBeInTheDocument()

      // Should show full date with year
      expect(screen.getByText(/2026/)).toBeInTheDocument()
      expect(screen.getByText(/february/i)).toBeInTheDocument()
    })

    it('should capitalize day name', () => {
      const date = new Date('2026-02-15T12:00:00')
      render(<DateDisplay date={date} />)

      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveClass('capitalize')
    })

    it('should format date according to locale', () => {
      const date = new Date('2026-12-25T12:00:00') // Christmas
      render(<DateDisplay date={date} />)

      // Should show December 25, 2026 (or locale-specific format)
      expect(screen.getByText(/december/i)).toBeInTheDocument()
      expect(screen.getByText(/25/)).toBeInTheDocument()
      expect(screen.getByText(/2026/)).toBeInTheDocument()
    })

    it('should handle different dates correctly', () => {
      const newYearsDay = new Date('2026-01-01T00:00:00')
      render(<DateDisplay date={newYearsDay} />)

      expect(screen.getByText(/january/i)).toBeInTheDocument()
      expect(screen.getByText(/1/)).toBeInTheDocument()
      expect(screen.getByText(/2026/)).toBeInTheDocument()
    })

    it('should display date in correct visual hierarchy', () => {
      const date = new Date('2026-02-15T12:00:00')
      render(<DateDisplay date={date} />)

      // Day name should be in h1
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toBeInTheDocument()

      // Full date should be in paragraph with muted styling
      const paragraph = screen.getByText(/2026/)
      expect(paragraph.tagName).toBe('P')
      expect(paragraph).toHaveClass('text-muted-foreground')
    })
  })

  describe('Edge cases', () => {
    it('should handle leap year dates', () => {
      const leapDay = new Date('2024-02-29T12:00:00')
      render(<DateDisplay date={leapDay} />)

      expect(screen.getByText(/february/i)).toBeInTheDocument()
      expect(screen.getByText(/29/)).toBeInTheDocument()
    })

    it('should handle dates at year boundaries', () => {
      const newYearsEve = new Date('2025-12-31T23:59:59')
      render(<DateDisplay date={newYearsEve} />)

      expect(screen.getByText(/december/i)).toBeInTheDocument()
      expect(screen.getByText(/31/)).toBeInTheDocument()
      expect(screen.getByText(/2025/)).toBeInTheDocument()
    })
  })
})
