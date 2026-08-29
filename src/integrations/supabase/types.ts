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
      assignments: {
        Row: {
          bus_id: string
          created_at: string
          crew_id: string
          id: string
          reasons: Json
          score: number
          trip_id: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          crew_id: string
          id?: string
          reasons?: Json
          score?: number
          trip_id: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          crew_id?: string
          id?: string
          reasons?: Json
          score?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crew"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          capacity: number
          code: string
          created_at: string
          depot_id: string
          id: string
          status: Database["public"]["Enums"]["bus_status"]
          utilization_minutes: number
        }
        Insert: {
          capacity?: number
          code: string
          created_at?: string
          depot_id: string
          id?: string
          status?: Database["public"]["Enums"]["bus_status"]
          utilization_minutes?: number
        }
        Update: {
          capacity?: number
          code?: string
          created_at?: string
          depot_id?: string
          id?: string
          status?: Database["public"]["Enums"]["bus_status"]
          utilization_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "buses_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
      crew: {
        Row: {
          created_at: string
          depot_id: string
          id: string
          is_available: boolean
          name: string
          shift_end: string
          shift_start: string
          status: Database["public"]["Enums"]["crew_status"]
          utilization_minutes: number
        }
        Insert: {
          created_at?: string
          depot_id: string
          id?: string
          is_available?: boolean
          name: string
          shift_end?: string
          shift_start?: string
          status?: Database["public"]["Enums"]["crew_status"]
          utilization_minutes?: number
        }
        Update: {
          created_at?: string
          depot_id?: string
          id?: string
          is_available?: boolean
          name?: string
          shift_end?: string
          shift_start?: string
          status?: Database["public"]["Enums"]["crew_status"]
          utilization_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "crew_depot_id_fkey"
            columns: ["depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
            referencedColumns: ["id"]
          },
        ]
      }
      depots: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          code: string
          created_at: string
          destination: string
          end_time: string
          id: string
          origin_depot_id: string
          required_capacity: number
          start_time: string
        }
        Insert: {
          code: string
          created_at?: string
          destination: string
          end_time: string
          id?: string
          origin_depot_id: string
          required_capacity?: number
          start_time: string
        }
        Update: {
          code?: string
          created_at?: string
          destination?: string
          end_time?: string
          id?: string
          origin_depot_id?: string
          required_capacity?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_origin_depot_id_fkey"
            columns: ["origin_depot_id"]
            isOneToOne: false
            referencedRelation: "depots"
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
      bus_status: "active" | "maintenance" | "retired" | "inactive"
      crew_status: "active" | "off_duty" | "inactive"
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
    Enums: {
      bus_status: ["active", "maintenance", "retired", "inactive"],
      crew_status: ["active", "off_duty", "inactive"],
    },
  },
} as const
