export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            contacts: {
                Row: {
                    created_at: string | null
                    deleted_at: string | null
                    email: string | null
                    id: string
                    lastname: string | null
                    name: string
                    phone: string | null
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    created_at?: string | null
                    deleted_at?: string | null
                    email?: string | null
                    id?: string
                    lastname?: string | null
                    name: string
                    phone?: string | null
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    created_at?: string | null
                    deleted_at?: string | null
                    email?: string | null
                    id?: string
                    lastname?: string | null
                    name?: string
                    phone?: string | null
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: []
            }
            google_calendar_accounts: {
                Row: {
                    access_token: string
                    created_at: string | null
                    display_name: string | null
                    email: string
                    id: string
                    refresh_token: string
                    token_expires_at: string
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    access_token: string
                    created_at?: string | null
                    display_name?: string | null
                    email: string
                    id?: string
                    refresh_token: string
                    token_expires_at: string
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    access_token?: string
                    created_at?: string | null
                    display_name?: string | null
                    email?: string
                    id?: string
                    refresh_token?: string
                    token_expires_at?: string
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: []
            }
            google_calendar_config: {
                Row: {
                    calendars_to_sync: Json | null
                    created_at: string | null
                    default_category: string | null
                    enabled: boolean | null
                    id: string
                    last_sync_at: string | null
                    sync_interval_minutes: number | null
                    updated_at: string | null
                    user_id: string | null
                }
                Insert: {
                    calendars_to_sync?: Json | null
                    created_at?: string | null
                    default_category?: string | null
                    enabled?: boolean | null
                    id?: string
                    last_sync_at?: string | null
                    sync_interval_minutes?: number | null
                    updated_at?: string | null
                    user_id?: string | null
                }
                Update: {
                    calendars_to_sync?: Json | null
                    created_at?: string | null
                    default_category?: string | null
                    enabled?: boolean | null
                    id?: string
                    last_sync_at?: string | null
                    sync_interval_minutes?: number | null
                    updated_at?: string | null
                    user_id?: string | null
                }
                Relationships: []
            }
            google_calendar_events: {
                Row: {
                    created_at: string | null
                    etag: string | null
                    event_status: string | null
                    gcal_calendar_id: string
                    gcal_event_id: string
                    id: string
                    last_synced_at: string | null
                    local_note_id: string
                    user_id: string | null
                }
                Insert: {
                    created_at?: string | null
                    etag?: string | null
                    event_status?: string | null
                    gcal_calendar_id: string
                    gcal_event_id: string
                    id?: string
                    last_synced_at?: string | null
                    local_note_id: string
                    user_id?: string | null
                }
                Update: {
                    created_at?: string | null
                    etag?: string | null
                    event_status?: string | null
                    gcal_calendar_id?: string
                    gcal_event_id?: string
                    id?: string
                    last_synced_at?: string | null
                    local_note_id?: string
                    user_id?: string | null
                }
                Relationships: []
            }
            google_calendar_tokens: {
                Row: {
                    access_token: string
                    created_at: string | null
                    id: string
                    refresh_token: string
                    scope: string
                    token_expiry: string
                    updated_at: string | null
                    user_id: string | null
                }
                Insert: {
                    access_token: string
                    created_at?: string | null
                    id?: string
                    refresh_token: string
                    scope: string
                    token_expiry: string
                    updated_at?: string | null
                    user_id?: string | null
                }
                Update: {
                    access_token?: string
                    created_at?: string | null
                    id?: string
                    refresh_token?: string
                    scope?: string
                    token_expiry?: string
                    updated_at?: string | null
                    user_id?: string | null
                }
                Relationships: []
            }
            labels: {
                Row: {
                    color: string
                    created_at: string
                    deleted_at: string | null
                    id: string
                    name: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    color?: string
                    created_at?: string
                    deleted_at?: string | null
                    id?: string
                    name: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    color?: string
                    created_at?: string
                    deleted_at?: string | null
                    id?: string
                    name?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: []
            }
            note_actions: {
                Row: {
                    action_type: string
                    created_at: string
                    id: string
                    last_synced_at: string | null
                    new_date: string | null
                    note_id: string
                    previous_date: string | null
                    reason: string | null
                    remote_id: string | null
                    sync_status: string | null
                    user_id: string
                }
                Insert: {
                    action_type?: string
                    created_at?: string
                    id?: string
                    last_synced_at?: string | null
                    new_date?: string | null
                    note_id: string
                    previous_date?: string | null
                    reason?: string | null
                    remote_id?: string | null
                    sync_status?: string | null
                    user_id: string
                }
                Update: {
                    action_type?: string
                    created_at?: string
                    id?: string
                    last_synced_at?: string | null
                    new_date?: string | null
                    note_id?: string
                    previous_date?: string | null
                    reason?: string | null
                    remote_id?: string | null
                    sync_status?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "note_actions_note_id_fkey"
                        columns: ["note_id"]
                        isOneToOne: false
                        referencedRelation: "notes"
                        referencedColumns: ["id"]
                    },
                ]
            }
            note_assignees: {
                Row: {
                    contact_id: string
                    created_at: string
                    deleted_at: string | null
                    note_id: string
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    contact_id: string
                    created_at?: string
                    deleted_at?: string | null
                    note_id: string
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    contact_id?: string
                    created_at?: string
                    deleted_at?: string | null
                    note_id?: string
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "note_assignees_contact_id_fkey"
                        columns: ["contact_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "note_assignees_note_id_fkey"
                        columns: ["note_id"]
                        isOneToOne: false
                        referencedRelation: "notes"
                        referencedColumns: ["id"]
                    },
                ]
            }
            note_labels: {
                Row: {
                    created_at: string
                    deleted_at: string | null
                    label_id: string
                    note_id: string
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    created_at?: string
                    deleted_at?: string | null
                    label_id: string
                    note_id: string
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    created_at?: string
                    deleted_at?: string | null
                    label_id?: string
                    note_id?: string
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "note_labels_label_id_fkey"
                        columns: ["label_id"]
                        isOneToOne: false
                        referencedRelation: "labels"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "note_labels_note_id_fkey"
                        columns: ["note_id"]
                        isOneToOne: false
                        referencedRelation: "notes"
                        referencedColumns: ["id"]
                    },
                ]
            }
            note_versions: {
                Row: {
                    category: string
                    completed: boolean
                    content: string
                    created_at: string
                    description: string | null
                    id: string
                    last_synced_at: string | null
                    note_id: string
                    remote_id: string | null
                    sync_status: string | null
                    user_id: string
                    version_number: number
                }
                Insert: {
                    category: string
                    completed?: boolean
                    content: string
                    created_at?: string
                    description?: string | null
                    id?: string
                    last_synced_at?: string | null
                    note_id: string
                    remote_id?: string | null
                    sync_status?: string | null
                    user_id: string
                    version_number: number
                }
                Update: {
                    category?: string
                    completed?: boolean
                    content?: string
                    created_at?: string
                    description?: string | null
                    id?: string
                    last_synced_at?: string | null
                    note_id?: string
                    remote_id?: string | null
                    sync_status?: string | null
                    user_id?: string
                    version_number?: number
                }
                Relationships: [
                    {
                        foreignKeyName: "note_versions_note_id_fkey"
                        columns: ["note_id"]
                        isOneToOne: false
                        referencedRelation: "notes"
                        referencedColumns: ["id"]
                    },
                ]
            }
            notes: {
                Row: {
                    assignee_id: string | null
                    category: string
                    completed: boolean
                    completed_at: string | null
                    content: string
                    created_at: string
                    date: string
                    deadline: string | null
                    deleted_at: string | null
                    description: string | null
                    gcal_event_id: string | null
                    id: string
                    is_all_day: boolean
                    is_public: boolean
                    pinned: boolean
                    project_id: string | null
                    public_slug: string | null
                    sort_order: number | null
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    assignee_id?: string | null
                    category?: string
                    completed?: boolean
                    completed_at?: string | null
                    content: string
                    created_at?: string
                    date: string
                    deadline?: string | null
                    deleted_at?: string | null
                    description?: string | null
                    gcal_event_id?: string | null
                    id?: string
                    is_all_day?: boolean
                    is_public?: boolean
                    pinned?: boolean
                    project_id?: string | null
                    public_slug?: string | null
                    sort_order?: number | null
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    assignee_id?: string | null
                    category?: string
                    completed?: boolean
                    completed_at?: string | null
                    content?: string
                    created_at?: string
                    date?: string
                    deadline?: string | null
                    deleted_at?: string | null
                    description?: string | null
                    gcal_event_id?: string | null
                    id?: string
                    is_all_day?: boolean
                    is_public?: boolean
                    pinned?: boolean
                    project_id?: string | null
                    public_slug?: string | null
                    sort_order?: number | null
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "notes_assignee_id_fkey"
                        columns: ["assignee_id"]
                        isOneToOne: false
                        referencedRelation: "contacts"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "notes_project_id_fkey"
                        columns: ["project_id"]
                        isOneToOne: false
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                ]
            }
            profiles: {
                Row: {
                    avatar_url: string | null
                    created_at: string
                    display_name: string | null
                    email: string | null
                    id: string
                    updated_at: string
                }
                Insert: {
                    avatar_url?: string | null
                    created_at?: string
                    display_name?: string | null
                    email?: string | null
                    id: string
                    updated_at?: string
                }
                Update: {
                    avatar_url?: string | null
                    created_at?: string
                    display_name?: string | null
                    email?: string | null
                    id?: string
                    updated_at?: string
                }
                Relationships: []
            }
            projects: {
                Row: {
                    color: string
                    created_at: string
                    deleted_at: string | null
                    description: string | null
                    gcal_account_id: string | null
                    gcal_calendar_id: string | null
                    icon: string | null
                    id: string
                    name: string
                    sort_order: number
                    status: string
                    updated_at: string
                    user_id: string
                }
                Insert: {
                    color?: string
                    created_at?: string
                    deleted_at?: string | null
                    description?: string | null
                    gcal_account_id?: string | null
                    gcal_calendar_id?: string | null
                    icon?: string | null
                    id?: string
                    name: string
                    sort_order?: number
                    status?: string
                    updated_at?: string
                    user_id: string
                }
                Update: {
                    color?: string
                    created_at?: string
                    deleted_at?: string | null
                    description?: string | null
                    gcal_account_id?: string | null
                    gcal_calendar_id?: string | null
                    icon?: string | null
                    id?: string
                    name?: string
                    sort_order?: number
                    status?: string
                    updated_at?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "projects_gcal_account_id_fkey"
                        columns: ["gcal_account_id"]
                        isOneToOne: false
                        referencedRelation: "google_calendar_accounts"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_preferences: {
                Row: {
                    auto_sync: boolean | null
                    beeper_token: string | null
                    created_at: string | null
                    fixed_note_id: string | null
                    show_sidebar: boolean | null
                    updated_at: string | null
                    user_id: string
                }
                Insert: {
                    auto_sync?: boolean | null
                    beeper_token?: string | null
                    created_at?: string | null
                    fixed_note_id?: string | null
                    show_sidebar?: boolean | null
                    updated_at?: string | null
                    user_id: string
                }
                Update: {
                    auto_sync?: boolean | null
                    beeper_token?: string | null
                    created_at?: string | null
                    fixed_note_id?: string | null
                    show_sidebar?: boolean | null
                    updated_at?: string | null
                    user_id?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
                DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
            DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
                DefaultSchema["Views"])
        ? (DefaultSchema["Tables"] &
                DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
                Row: infer R
            }
            ? R
            : never
        : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Insert: infer I
        }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
        ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
                Insert: infer I
            }
            ? I
            : never
        : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema["Tables"]
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
            Update: infer U
        }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
        ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
                Update: infer U
            }
            ? U
            : never
        : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema["Enums"]
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
        ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
        : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema["CompositeTypes"]
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
        ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
        : never

export const Constants = {
    public: {
        Enums: {},
    },
} as const
