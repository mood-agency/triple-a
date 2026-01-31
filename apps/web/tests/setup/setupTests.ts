// Setup file for all tests
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Initialize i18n for tests
i18n
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    resources: {
      en: {
        translation: {
          deleteNote: 'Delete Note',
          confirmDelete: 'Are you sure?',
          cancel: 'Cancel',
          delete: 'Delete',
          activeFilters: 'Active Filters',
          clearAllFilters: 'Clear all filters',
          categoryTodo: 'To Do',
          categoryFollowUp: 'Follow Up',
          categoryNotes: 'Notes',
          categoryMeeting: 'Meeting',
          noResults: 'No results',
          onlyCompletedTasksSingular: 'Only 1 completed task',
          onlyCompletedTasks: 'Only {{count}} completed tasks',
          'sort.title': 'Sort',
          'sort.deadlineAsc': 'Deadline (earliest first)',
          'sort.deadlineDesc': 'Deadline (latest first)',
          'sort.assigneeAsc': 'Assignee (A-Z)',
          'sort.assigneeDesc': 'Assignee (Z-A)',
          'sort.categoryAsc': 'Category (ascending)',
          'sort.categoryDesc': 'Category (descending)',
          'taskStatus.active': 'Active',
          'taskStatus.completed': 'Completed',
          'taskStatus.deleted': 'Deleted',
          overdue: 'Overdue',
        },
      },
    },
    interpolation: {
      escapeValue: false,
    },
  })

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock environment variables
process.env.VITE_SUPABASE_URL = 'http://localhost:54321'
process.env.VITE_SUPABASE_ANON_KEY = 'test-key'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Suppress console errors during tests (optional)
// Uncomment if you want cleaner test output
// const originalError = console.error
// beforeAll(() => {
//   console.error = (...args: any[]) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('Not implemented: HTMLFormElement.prototype.requestSubmit')
//     ) {
//       return
//     }
//     originalError.call(console, ...args)
//   }
// })
