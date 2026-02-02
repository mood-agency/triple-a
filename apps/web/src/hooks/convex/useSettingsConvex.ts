import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type AIProvider = "groq" | "openai" | "anthropic";

export interface AIModel {
  id: string;
  name: string;
}

export const AI_MODELS: Record<AIProvider, AIModel[]> = {
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
    { id: "llama-3.3-70b-specdec", name: "Llama 3.3 70B SpecDec (Fast)" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B" },
    { id: "openai/gpt-oss-120b", name: "GPT OSS 120B" },
    { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B" },
    { id: "qwen-qwq-32b", name: "Qwen QwQ 32B" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Fast)" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
    { id: "gemma2-9b-it", name: "Gemma 2 9B" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (Fast)" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Fast)" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
  ],
};

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface AppSettings {
  autoSync: boolean;
  showSidebar: boolean;
  fixedNoteId: string | null;
  viewMode: "list" | "calendar";
  beeperToken: string | null;
  aiProvider: AIProviderConfig | null;
  compactTaskView: boolean;
  activeProjectId: string | null;
  autoSaveInterval: number;
}

const SETTINGS_KEY = "app-settings";

const DEFAULT_SETTINGS: AppSettings = {
  autoSync: true,
  showSidebar: false,
  fixedNoteId: null,
  viewMode: "list",
  beeperToken: null,
  aiProvider: null,
  compactTaskView: false,
  activeProjectId: null,
  autoSaveInterval: 3,
};

/**
 * Check if a string looks like a valid Convex ID (not a UUID)
 * Convex IDs are base64-like strings, UUIDs have dashes
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  // UUIDs have dashes, Convex IDs don't
  if (id.includes("-")) return false;
  // Convex IDs are typically alphanumeric
  return /^[a-zA-Z0-9_]+$/.test(id);
}

function loadLocalSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const settings = { ...DEFAULT_SETTINGS, ...parsed };

      // Clear invalid Supabase IDs (UUIDs with dashes)
      if (settings.activeProjectId && !isValidConvexId(settings.activeProjectId)) {
        console.log("[useSettingsConvex] Clearing invalid activeProjectId:", settings.activeProjectId);
        settings.activeProjectId = null;
      }
      if (settings.fixedNoteId && !isValidConvexId(settings.fixedNoteId)) {
        console.log("[useSettingsConvex] Clearing invalid fixedNoteId:", settings.fixedNoteId);
        settings.fixedNoteId = null;
      }

      // Save cleaned settings back
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      return settings;
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
  return DEFAULT_SETTINGS;
}

function saveLocalSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

/**
 * Convex-based settings hook
 * Syncs with Convex when authenticated, falls back to localStorage when offline
 */
export function useSettingsConvex() {
  const { isAuthenticated } = useConvexAuth();
  const [settings, setSettings] = useState<AppSettings>(loadLocalSettings);

  // Query preferences from Convex (only when authenticated)
  const convexPrefs = useQuery(
    api.userPreferences.get,
    isAuthenticated ? {} : "skip"
  );

  // Mutations
  const upsertMutation = useMutation(api.userPreferences.upsert);

  // Merge Convex preferences with local settings when they arrive
  useEffect(() => {
    if (convexPrefs && isAuthenticated) {
      setSettings((prev) => {
        const merged: AppSettings = {
          ...prev,
          showSidebar: convexPrefs.showSidebar ?? prev.showSidebar,
          autoSync: convexPrefs.autoSync ?? prev.autoSync,
          compactTaskView: convexPrefs.compactTaskView ?? prev.compactTaskView,
          viewMode: (convexPrefs.viewMode as "list" | "calendar") ?? prev.viewMode,
          beeperToken: convexPrefs.beeperToken ?? prev.beeperToken,
          fixedNoteId: convexPrefs.fixedNoteId ?? prev.fixedNoteId,
          activeProjectId: convexPrefs.activeProjectId ?? prev.activeProjectId,
          autoSaveInterval: convexPrefs.autoSaveInterval ?? prev.autoSaveInterval,
        };
        saveLocalSettings(merged);
        return merged;
      });
    }
  }, [convexPrefs, isAuthenticated]);

  /**
   * Update settings
   */
  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => {
        const newSettings = { ...prev, ...partial };
        saveLocalSettings(newSettings);
        return newSettings;
      });

      // Sync to Convex if authenticated
      if (isAuthenticated) {
        const convexUpdates: Parameters<typeof upsertMutation>[0] = {};

        if (partial.showSidebar !== undefined) {
          convexUpdates.showSidebar = partial.showSidebar;
        }
        if (partial.autoSync !== undefined) {
          convexUpdates.autoSync = partial.autoSync;
        }
        if (partial.compactTaskView !== undefined) {
          convexUpdates.compactTaskView = partial.compactTaskView;
        }
        if (partial.viewMode !== undefined) {
          convexUpdates.viewMode = partial.viewMode;
        }
        if (partial.beeperToken !== undefined) {
          convexUpdates.beeperToken = partial.beeperToken ?? undefined;
        }
        if (partial.fixedNoteId !== undefined) {
          convexUpdates.fixedNoteId = partial.fixedNoteId as Id<"notes"> | undefined;
        }
        if (partial.activeProjectId !== undefined) {
          convexUpdates.activeProjectId = partial.activeProjectId as Id<"projects"> | undefined;
        }
        if (partial.autoSaveInterval !== undefined) {
          convexUpdates.autoSaveInterval = partial.autoSaveInterval;
        }

        // Only call mutation if there's something to update
        if (Object.keys(convexUpdates).length > 0) {
          upsertMutation(convexUpdates).catch((err) => {
            console.error("[useSettingsConvex] Failed to sync settings:", err);
          });
        }
      }
    },
    [isAuthenticated, upsertMutation]
  );

  return {
    settings,
    updateSettings,
  };
}
