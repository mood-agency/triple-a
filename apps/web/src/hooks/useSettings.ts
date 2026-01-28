import { useState, useEffect } from 'react'
import { useUserPreferences } from './useUserPreferences'

export interface AppSettings {
  autoSync: boolean
  showSidebar: boolean
  fixedNoteId: string | null
  viewMode: 'list' | 'calendar'
  beeperToken: string | null
  compactTaskView: boolean
  activeProjectId: string | null
  autoSaveInterval: number // in seconds (0 = disabled)
}

const SETTINGS_KEY = 'app-settings'

const DEFAULT_SETTINGS: AppSettings = {
  autoSync: true,
  showSidebar: false,
  fixedNoteId: null,
  viewMode: 'list',
  beeperToken: null,
  compactTaskView: false,
  activeProjectId: null,
  autoSaveInterval: 3, // 3 seconds default
}

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
  return DEFAULT_SETTINGS
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }

  // Sync with Supabase
  useUserPreferences(settings, updateSettings)

  return {
    settings,
    updateSettings,
  }
}
