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
      containers: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          label: string
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          label: string
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          label?: string
          type?: string
        }
        Relationships: []
      }
      identify_runs: {
        Row: {
          current_index: number
          errors: Json
          finished_at: string | null
          id: string
          page_ids: string[]
          started_at: string
          status: string
        }
        Insert: {
          current_index?: number
          errors?: Json
          finished_at?: string | null
          id?: string
          page_ids?: string[]
          started_at?: string
          status?: string
        }
        Update: {
          current_index?: number
          errors?: Json
          finished_at?: string | null
          id?: string
          page_ids?: string[]
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          capture_type: string | null
          captured_at: string | null
          container_id: string
          created_at: string | null
          id: string
          identify_status: string
          label: string
          page_notes: string | null
          photo_path: string | null
          raw_model_output: Json | null
        }
        Insert: {
          capture_type?: string | null
          captured_at?: string | null
          container_id: string
          created_at?: string | null
          id?: string
          identify_status?: string
          label: string
          page_notes?: string | null
          photo_path?: string | null
          raw_model_output?: Json | null
        }
        Update: {
          capture_type?: string | null
          captured_at?: string | null
          container_id?: string
          created_at?: string | null
          id?: string
          identify_status?: string
          label?: string
          page_notes?: string | null
          photo_path?: string | null
          raw_model_output?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_container_id_fkey"
            columns: ["container_id"]
            isOneToOne: false
            referencedRelation: "containers"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_sets: {
        Row: {
          catalogue_range: string | null
          catalogue_system: string | null
          confidence: number | null
          country: string | null
          created_at: string
          forgery_risk: string
          id: string
          item_count: number | null
          market_notes: string | null
          notes: string | null
          page_id: string
          priority_reasons: string[]
          priority_score: number
          research_brief: string | null
          research_brief_generated_at: string | null
          review_status: string
          set_name: string
          significance: string | null
          significance_level: string
          updated_at: string
          variants_to_check: string | null
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          catalogue_range?: string | null
          catalogue_system?: string | null
          confidence?: number | null
          country?: string | null
          created_at?: string
          forgery_risk?: string
          id?: string
          item_count?: number | null
          market_notes?: string | null
          notes?: string | null
          page_id: string
          priority_reasons?: string[]
          priority_score?: number
          research_brief?: string | null
          research_brief_generated_at?: string | null
          review_status?: string
          set_name: string
          significance?: string | null
          significance_level?: string
          updated_at?: string
          variants_to_check?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          catalogue_range?: string | null
          catalogue_system?: string | null
          confidence?: number | null
          country?: string | null
          created_at?: string
          forgery_risk?: string
          id?: string
          item_count?: number | null
          market_notes?: string | null
          notes?: string | null
          page_id?: string
          priority_reasons?: string[]
          priority_score?: number
          research_brief?: string | null
          research_brief_generated_at?: string | null
          review_status?: string
          set_name?: string
          significance?: string | null
          significance_level?: string
          updated_at?: string
          variants_to_check?: string | null
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stamp_sets_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      stamps: {
        Row: {
          bbox: Json | null
          catalogue_confidence: number | null
          catalogue_number: string | null
          catalogue_system: string | null
          condition_notes: string | null
          confidence: number | null
          country: string | null
          country_inscription: string | null
          created_at: string | null
          crop_path: string | null
          currency: string | null
          denomination: string | null
          faults: string[] | null
          forgery_risk: string
          format: string
          gum_state: string
          hinged_guess: string | null
          id: string
          issue_name: string | null
          item_type: string
          market_notes: string | null
          mint_or_used: string | null
          notes: string | null
          page_id: string
          perforation: string | null
          position_index: number | null
          priority_reasons: string[]
          priority_score: number
          quantity: number
          research_brief: string | null
          research_brief_generated_at: string | null
          review_status: string
          set_id: string | null
          set_name: string | null
          set_position: string | null
          significance: string | null
          significance_level: string
          tags: string[] | null
          updated_at: string | null
          value_confidence: number | null
          value_high: number | null
          value_low: number | null
          value_source: string | null
          variants_to_check: string | null
          watermark: string | null
          year_confidence: number | null
          year_estimate: number | null
        }
        Insert: {
          bbox?: Json | null
          catalogue_confidence?: number | null
          catalogue_number?: string | null
          catalogue_system?: string | null
          condition_notes?: string | null
          confidence?: number | null
          country?: string | null
          country_inscription?: string | null
          created_at?: string | null
          crop_path?: string | null
          currency?: string | null
          denomination?: string | null
          faults?: string[] | null
          forgery_risk?: string
          format?: string
          gum_state?: string
          hinged_guess?: string | null
          id?: string
          issue_name?: string | null
          item_type?: string
          market_notes?: string | null
          mint_or_used?: string | null
          notes?: string | null
          page_id: string
          perforation?: string | null
          position_index?: number | null
          priority_reasons?: string[]
          priority_score?: number
          quantity?: number
          research_brief?: string | null
          research_brief_generated_at?: string | null
          review_status?: string
          set_id?: string | null
          set_name?: string | null
          set_position?: string | null
          significance?: string | null
          significance_level?: string
          tags?: string[] | null
          updated_at?: string | null
          value_confidence?: number | null
          value_high?: number | null
          value_low?: number | null
          value_source?: string | null
          variants_to_check?: string | null
          watermark?: string | null
          year_confidence?: number | null
          year_estimate?: number | null
        }
        Update: {
          bbox?: Json | null
          catalogue_confidence?: number | null
          catalogue_number?: string | null
          catalogue_system?: string | null
          condition_notes?: string | null
          confidence?: number | null
          country?: string | null
          country_inscription?: string | null
          created_at?: string | null
          crop_path?: string | null
          currency?: string | null
          denomination?: string | null
          faults?: string[] | null
          forgery_risk?: string
          format?: string
          gum_state?: string
          hinged_guess?: string | null
          id?: string
          issue_name?: string | null
          item_type?: string
          market_notes?: string | null
          mint_or_used?: string | null
          notes?: string | null
          page_id?: string
          perforation?: string | null
          position_index?: number | null
          priority_reasons?: string[]
          priority_score?: number
          quantity?: number
          research_brief?: string | null
          research_brief_generated_at?: string | null
          review_status?: string
          set_id?: string | null
          set_name?: string | null
          set_position?: string | null
          significance?: string | null
          significance_level?: string
          tags?: string[] | null
          updated_at?: string | null
          value_confidence?: number | null
          value_high?: number | null
          value_low?: number | null
          value_source?: string | null
          variants_to_check?: string | null
          watermark?: string | null
          year_confidence?: number | null
          year_estimate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stamps_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamps_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "stamp_sets"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
