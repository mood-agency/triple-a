export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_preferences: {
        Row: {
          user_id: string
          show_sidebar: boolean
          auto_sync: boolean
          fixed_note_id: string | null
          beeper_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          show_sidebar?: boolean
          auto_sync?: boolean
          fixed_note_id?: string | null
          beeper_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          show_sidebar?: boolean
          auto_sync?: boolean
          fixed_note_id?: string | null
          beeper_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          user_id: string
          date: string
          content: string
          description: string | null
          category: 'todo' | 'followup' | 'notes'
          completed: boolean
          pinned: boolean
          sort_order: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          content: string
          description?: string | null
          category?: 'todo' | 'followup' | 'notes'
          completed?: boolean
          pinned?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          content?: string
          description?: string | null
          category?: 'todo' | 'followup' | 'notes'
          completed?: boolean
          pinned?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      note_history: {
        Row: {
          id: string
          note_id: string
          user_id: string
          content: string
          description: string | null
          category: 'todo' | 'followup' | 'notes'
          completed: boolean
          changed_at: string
        }
        Insert: {
          id?: string
          note_id: string
          user_id: string
          content: string
          description?: string | null
          category: 'todo' | 'followup' | 'notes'
          completed?: boolean
          changed_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          user_id?: string
          content?: string
          description?: string | null
          category?: 'todo' | 'followup' | 'notes'
          completed?: boolean
          changed_at?: string
        }
      }
      labels: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      note_labels: {
        Row: {
          note_id: string
          label_id: string
          user_id: string
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          note_id: string
          label_id: string
          user_id: string
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          note_id?: string
          label_id?: string
          user_id?: string
          created_at?: string
          deleted_at?: string | null
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
