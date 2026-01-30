import { useState } from 'react'
import { useUserPreferences } from './useUserPreferences'

export type AIProvider = 'groq' | 'openai' | 'anthropic'

export interface AIModel {
  id: string
  name: string
}

export const AI_MODELS: Record<AIProvider, AIModel[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.3-70b-specdec', name: 'Llama 3.3 70B SpecDec (Fast)' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B' },
    { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B' },
    { id: 'qwen-qwq-32b', name: 'Qwen QwQ 32B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fast)' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fast)' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
  ],
}

export interface AIProviderConfig {
  provider: AIProvider
  apiKey: string
  model: string
}

export interface AppSettings {
  autoSync: boolean
  showSidebar: boolean
  fixedNoteId: string | null
  viewMode: 'list' | 'calendar'
  beeperToken: string | null
  aiProvider: AIProviderConfig | null
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
  aiProvider: null,
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

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const newSettings = { ...prev, ...partial }
      // Save synchronously to ensure persistence before potential page reload
      saveSettings(newSettings)
      return newSettings
    })
  }

  // Sync with Supabase
  useUserPreferences(settings, updateSettings)

  return {
    settings,
    updateSettings,
  }
}
