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
      attempts: {
        Row: {
          classroom_id: string | null
          constraints: Json | null
          created_at: string
          design: Json
          engine_version: string
          id: string
          mission_slug: string
          result: Json
          score_breakdown: Json
          score_total: number
          user_id: string
        }
        Insert: {
          classroom_id?: string | null
          constraints?: Json | null
          created_at?: string
          design: Json
          engine_version: string
          id?: string
          mission_slug: string
          result: Json
          score_breakdown: Json
          score_total: number
          user_id: string
        }
        Update: {
          classroom_id?: string | null
          constraints?: Json | null
          created_at?: string
          design?: Json
          engine_version?: string
          id?: string
          mission_slug?: string
          result?: Json
          score_breakdown?: Json
          score_total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_members: {
        Row: {
          classroom_id: string
          joined_at: string
          nickname: string
          user_id: string
        }
        Insert: {
          classroom_id: string
          joined_at?: string
          nickname: string
          user_id: string
        }
        Update: {
          classroom_id?: string
          joined_at?: string
          nickname?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_members_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_updates: {
        Row: {
          classroom_id: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_updates_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: true
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          budget_m: number
          created_at: string
          deadline: string | null
          id: string
          is_active: boolean
          join_code: string
          mass_kg: number
          max_attempts: number | null
          mission_slug: string
          name: string
          teacher_id: string
        }
        Insert: {
          budget_m: number
          created_at?: string
          deadline?: string | null
          id?: string
          is_active?: boolean
          join_code: string
          mass_kg: number
          max_attempts?: number | null
          mission_slug: string
          name: string
          teacher_id: string
        }
        Update: {
          budget_m?: number
          created_at?: string
          deadline?: string | null
          id?: string
          is_active?: boolean
          join_code?: string
          mass_kg?: number
          max_attempts?: number | null
          mission_slug?: string
          name?: string
          teacher_id?: string
        }
        Relationships: []
      }
      join_requests: {
        Row: {
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          count: number
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string | null
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          nickname?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_read_class: { Args: { p_id: string }; Returns: boolean }
      join_mission_classroom: {
        Args: { p_code: string; p_nickname: string; p_user: string }
        Returns: {
          budget_m: number
          created_at: string
          deadline: string | null
          id: string
          is_active: boolean
          join_code: string
          mass_kg: number
          max_attempts: number | null
          mission_slug: string
          name: string
          teacher_id: string
        }
        SetofOptions: {
          from: "*"
          to: "classrooms"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mission_ranking: {
        Args: { p_class: string; p_engine: string; p_slug: string }
        Returns: {
          achieved: string
          attempts: number
          improvement: number
          nickname: string
          score: number
          user_id: string
        }[]
      }
      save_mission_attempt: {
        Args: {
          p_budget: number
          p_class: string
          p_design: Json
          p_id: string
          p_mass: number
          p_result: Json
          p_slug: string
          p_user: string
        }
        Returns: {
          classroom_id: string | null
          constraints: Json | null
          created_at: string
          design: Json
          engine_version: string
          id: string
          mission_slug: string
          result: Json
          score_breakdown: Json
          score_total: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
