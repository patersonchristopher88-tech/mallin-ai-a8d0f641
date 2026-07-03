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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      generations: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          model: string
          prompt: string
          source_paths: Json
          storage_bucket: string
          storage_path: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          model: string
          prompt: string
          source_paths?: Json
          storage_bucket?: string
          storage_path: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          model?: string
          prompt?: string
          source_paths?: Json
          storage_bucket?: string
          storage_path?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          source_thread_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind?: string
          source_thread_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          source_thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_sdk_id: string | null
          created_at: string
          id: string
          mood: string | null
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          ai_sdk_id?: string | null
          created_at?: string
          id?: string
          mood?: string | null
          parts?: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          ai_sdk_id?: string | null
          created_at?: string
          id?: string
          mood?: string | null
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assistant_name: string
          avatar_style: string
          body_font: string
          created_at: string
          custom_personas: Json
          default_chat_model: string
          default_image_model: string
          density: string
          display_font: string
          display_name: string | null
          elevenlabs_model: string
          elevenlabs_voice_id: string | null
          email: string | null
          formality: number
          hud_widgets: Json
          id: string
          input_mode: string
          latitude: number | null
          longitude: number | null
          mono_font: string
          mood_colors: Json
          motion: string
          persona: string
          spoken_replies: boolean
          system_prompt: string | null
          theme: Json
          timezone: string | null
          tools_enabled: Json
          updated_at: string
          verbosity: number
          voice_id: string
          voice_instructions: string | null
          voice_provider: string
          voice_speed: number
          wake_word_enabled: boolean
        }
        Insert: {
          assistant_name?: string
          avatar_style?: string
          body_font?: string
          created_at?: string
          custom_personas?: Json
          default_chat_model?: string
          default_image_model?: string
          density?: string
          display_font?: string
          display_name?: string | null
          elevenlabs_model?: string
          elevenlabs_voice_id?: string | null
          email?: string | null
          formality?: number
          hud_widgets?: Json
          id: string
          input_mode?: string
          latitude?: number | null
          longitude?: number | null
          mono_font?: string
          mood_colors?: Json
          motion?: string
          persona?: string
          spoken_replies?: boolean
          system_prompt?: string | null
          theme?: Json
          timezone?: string | null
          tools_enabled?: Json
          updated_at?: string
          verbosity?: number
          voice_id?: string
          voice_instructions?: string | null
          voice_provider?: string
          voice_speed?: number
          wake_word_enabled?: boolean
        }
        Update: {
          assistant_name?: string
          avatar_style?: string
          body_font?: string
          created_at?: string
          custom_personas?: Json
          default_chat_model?: string
          default_image_model?: string
          density?: string
          display_font?: string
          display_name?: string | null
          elevenlabs_model?: string
          elevenlabs_voice_id?: string | null
          email?: string | null
          formality?: number
          hud_widgets?: Json
          id?: string
          input_mode?: string
          latitude?: number | null
          longitude?: number | null
          mono_font?: string
          mood_colors?: Json
          motion?: string
          persona?: string
          spoken_replies?: boolean
          system_prompt?: string | null
          theme?: Json
          timezone?: string | null
          tools_enabled?: Json
          updated_at?: string
          verbosity?: number
          voice_id?: string
          voice_instructions?: string | null
          voice_provider?: string
          voice_speed?: number
          wake_word_enabled?: boolean
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      spotify_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          refresh_token: string
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          folder: string | null
          id: string
          model: string | null
          persona: string | null
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder?: string | null
          id?: string
          model?: string | null
          persona?: string | null
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder?: string | null
          id?: string
          model?: string | null
          persona?: string | null
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          created_at: string
          extracted_text: string | null
          id: string
          kind: string
          metadata: Json
          mime_type: string | null
          original_name: string | null
          size_bytes: number | null
          storage_bucket: string
          storage_path: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind: string
          metadata?: Json
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          id?: string
          kind?: string
          metadata?: Json
          mime_type?: string | null
          original_name?: string | null
          size_bytes?: number | null
          storage_bucket?: string
          storage_path?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
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
