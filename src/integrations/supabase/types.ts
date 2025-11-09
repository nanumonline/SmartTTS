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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          organization: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          organization?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          organization?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tts_clone_requests: {
        Row: {
          base_voice_id: string
          base_voice_name: string | null
          completed_at: string | null
          created_at: string | null
          gender: string | null
          id: string
          language: string | null
          memo: string | null
          sample_file: string | null
          sample_name: string | null
          sample_type: string | null
          status: string | null
          target_name: string
          user_id: string
          voice_id: string | null
          voice_name: string | null
          youtube_url: string | null
        }
        Insert: {
          base_voice_id: string
          base_voice_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          language?: string | null
          memo?: string | null
          sample_file?: string | null
          sample_name?: string | null
          sample_type?: string | null
          status?: string | null
          target_name: string
          user_id: string
          voice_id?: string | null
          voice_name?: string | null
          youtube_url?: string | null
        }
        Update: {
          base_voice_id?: string
          base_voice_name?: string | null
          completed_at?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          language?: string | null
          memo?: string | null
          sample_file?: string | null
          sample_name?: string | null
          sample_type?: string | null
          status?: string | null
          target_name?: string
          user_id?: string
          voice_id?: string | null
          voice_name?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      tts_favorites: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          voice_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          voice_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: []
      }
      tts_generations: {
        Row: {
          audio_blob: string | null
          audio_url: string | null
          cache_key: string | null
          created_at: string | null
          duration: number | null
          has_audio: boolean | null
          id: string
          language: string | null
          mime_type: string | null
          model: string | null
          pitch_shift: number | null
          purpose: string
          purpose_label: string | null
          saved_name: string | null
          speed: number | null
          status: string | null
          style: string | null
          text_length: number | null
          text_preview: string | null
          updated_at: string | null
          user_id: string
          voice_id: string
          voice_name: string | null
        }
        Insert: {
          audio_blob?: string | null
          audio_url?: string | null
          cache_key?: string | null
          created_at?: string | null
          duration?: number | null
          has_audio?: boolean | null
          id?: string
          language?: string | null
          mime_type?: string | null
          model?: string | null
          pitch_shift?: number | null
          purpose?: string
          purpose_label?: string | null
          saved_name?: string | null
          speed?: number | null
          status?: string | null
          style?: string | null
          text_length?: number | null
          text_preview?: string | null
          updated_at?: string | null
          user_id: string
          voice_id: string
          voice_name?: string | null
        }
        Update: {
          audio_blob?: string | null
          audio_url?: string | null
          cache_key?: string | null
          created_at?: string | null
          duration?: number | null
          has_audio?: boolean | null
          id?: string
          language?: string | null
          mime_type?: string | null
          model?: string | null
          pitch_shift?: number | null
          purpose?: string
          purpose_label?: string | null
          saved_name?: string | null
          speed?: number | null
          status?: string | null
          style?: string | null
          text_length?: number | null
          text_preview?: string | null
          updated_at?: string | null
          user_id?: string
          voice_id?: string
          voice_name?: string | null
        }
        Relationships: []
      }
      tts_message_history: {
        Row: {
          created_at: string | null
          id: string
          is_template: boolean | null
          purpose: string
          template_category: string | null
          template_name: string | null
          text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_template?: boolean | null
          purpose: string
          template_category?: string | null
          template_name?: string | null
          text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_template?: boolean | null
          purpose?: string
          template_category?: string | null
          template_name?: string | null
          text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tts_mixing_states: {
        Row: {
          created_at: string | null
          generation_id: string | null
          id: string
          mixed_audio_blob: string | null
          mixed_audio_url: string | null
          settings: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          generation_id?: string | null
          id?: string
          mixed_audio_blob?: string | null
          mixed_audio_url?: string | null
          settings?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          generation_id?: string | null
          id?: string
          mixed_audio_blob?: string | null
          mixed_audio_url?: string | null
          settings?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tts_mixing_states_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "tts_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_review_states: {
        Row: {
          comments: string | null
          created_at: string | null
          generation_id: string
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string | null
          generation_id: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string | null
          generation_id?: string
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tts_review_states_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "tts_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_schedule_requests: {
        Row: {
          created_at: string | null
          fail_reason: string | null
          generation_id: string | null
          id: string
          mixing_state: Json | null
          repeat_option: string | null
          scheduled_time: string
          sent_at: string | null
          status: string | null
          target_channel: string
          target_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fail_reason?: string | null
          generation_id?: string | null
          id?: string
          mixing_state?: Json | null
          repeat_option?: string | null
          scheduled_time: string
          sent_at?: string | null
          status?: string | null
          target_channel: string
          target_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fail_reason?: string | null
          generation_id?: string | null
          id?: string
          mixing_state?: Json | null
          repeat_option?: string | null
          scheduled_time?: string
          sent_at?: string | null
          status?: string | null
          target_channel?: string
          target_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tts_schedule_requests_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "tts_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      tts_user_settings: {
        Row: {
          created_at: string | null
          id: string
          preferences: Json | null
          selected_purpose: string | null
          storage_path: string | null
          updated_at: string | null
          user_id: string
          voice_settings: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          preferences?: Json | null
          selected_purpose?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id: string
          voice_settings?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          preferences?: Json | null
          selected_purpose?: string | null
          storage_path?: string | null
          updated_at?: string | null
          user_id?: string
          voice_settings?: Json | null
        }
        Relationships: []
      }
      tts_voice_catalog: {
        Row: {
          created_at: string | null
          id: string
          synced_at: string | null
          updated_at: string | null
          voice_data: Json
          voice_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          synced_at?: string | null
          updated_at?: string | null
          voice_data: Json
          voice_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          synced_at?: string | null
          updated_at?: string | null
          voice_data?: Json
          voice_id?: string
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
