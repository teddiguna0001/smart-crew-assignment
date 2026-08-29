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
      bus_events: {
        Row: {
          bus_id: string
          created_at: string
          detail: string | null
          event_type: string
          from_status: Database["public"]["Enums"]["bus_status"] | null
          id: string
          to_status: Database["public"]["Enums"]["bus_status"] | null
        }
        Insert: {
          bus_id: string
          created_at?: string
          detail?: string | null
          event_type: string
          from_status?: Database["public"]["Enums"]["bus_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["bus_status"] | null
        }
        Update: {
          bus_id?: string
          created_at?: string
          detail?: string | null
          event_type?: string
          from_status?: Database["public"]["Enums"]["bus_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["bus_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "bus_events_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          bus_code: string
          bus_number: string
          bus_type: string
          capacity: number
          created_at: string
          current_assignment: string | null
          depot: string
          efficiency_score: number | null
          energy_pct: number
          id: string
          last_maintenance: string | null
          model: string | null
          next_inspection_due: string | null
          notes: string | null
          odometer_km: number
          retired_at: string | null
          status: Database["public"]["Enums"]["bus_status"]
          updated_at: string
        }
        Insert: {
          bus_code: string
          bus_number: string
          bus_type?: string
          capacity?: number
          created_at?: string
          current_assignment?: string | null
          depot: string
          efficiency_score?: number | null
          energy_pct?: number
          id?: string
          last_maintenance?: string | null
          model?: string | null
          next_inspection_due?: string | null
          notes?: string | null
          odometer_km?: number
          retired_at?: string | null
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Update: {
          bus_code?: string
          bus_number?: string
          bus_type?: string
          capacity?: number
          created_at?: string
          current_assignment?: string | null
          depot?: string
          efficiency_score?: number | null
          energy_pct?: number
          id?: string
          last_maintenance?: string | null
          model?: string | null
          next_inspection_due?: string | null
          notes?: string | null
          odometer_km?: number
          retired_at?: string | null
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Relationships: []
      }
      crew: {
        Row: {
          availability: string
          consecutive_days: number
          created_at: string
          crew_code: string
          current_assignment: string | null
          daily_spreadover_hours: number
          depot: string
          id: string
          license_valid_till: string | null
          name: string
          notes: string | null
          phone: string | null
          punctuality_score: number | null
          role: string
          shift: string
          status: Database["public"]["Enums"]["crew_status"]
          updated_at: string
          weekly_hours: number
        }
        Insert: {
          availability?: string
          consecutive_days?: number
          created_at?: string
          crew_code: string
          current_assignment?: string | null
          daily_spreadover_hours?: number
          depot: string
          id?: string
          license_valid_till?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          punctuality_score?: number | null
          role?: string
          shift?: string
          status?: Database["public"]["Enums"]["crew_status"]
          updated_at?: string
          weekly_hours?: number
        }
        Update: {
          availability?: string
          consecutive_days?: number
          created_at?: string
          crew_code?: string
          current_assignment?: string | null
          daily_spreadover_hours?: number
          depot?: string
          id?: string
          license_valid_till?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          punctuality_score?: number | null
          role?: string
          shift?: string
          status?: Database["public"]["Enums"]["crew_status"]
          updated_at?: string
          weekly_hours?: number
        }
        Relationships: []
      }
      crew_events: {
        Row: {
          created_at: string
          crew_id: string
          detail: string | null
          event_type: string
          from_status: Database["public"]["Enums"]["crew_status"] | null
          id: string
          to_status: Database["public"]["Enums"]["crew_status"] | null
        }
        Insert: {
          created_at?: string
          crew_id: string
          detail?: string | null
          event_type: string
          from_status?: Database["public"]["Enums"]["crew_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["crew_status"] | null
        }
        Update: {
          created_at?: string
          crew_id?: string
          detail?: string | null
          event_type?: string
          from_status?: Database["public"]["Enums"]["crew_status"] | null
          id?: string
          to_status?: Database["public"]["Enums"]["crew_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_events_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crew"
            referencedColumns: ["id"]
          },
        ]
      }
      disruptions: {
        Row: {
          added_delay_min: number
          affected_bus_ids: string[]
          affected_crew_ids: string[]
          affected_trips: number
          created_at: string
          description: string | null
          disruption_type: string
          duration_min: number
          id: string
          impact: Json
          location: string | null
          passengers_impacted: number
          recovered_trips: number
          recovery_rate_pct: number
          reference: string
          resolved_at: string | null
          route_number: string
          severity: string
          start_min: number
          status: string
          unrecovered_trips: number
          updated_at: string
        }
        Insert: {
          added_delay_min?: number
          affected_bus_ids?: string[]
          affected_crew_ids?: string[]
          affected_trips?: number
          created_at?: string
          description?: string | null
          disruption_type: string
          duration_min: number
          id?: string
          impact?: Json
          location?: string | null
          passengers_impacted?: number
          recovered_trips?: number
          recovery_rate_pct?: number
          reference: string
          resolved_at?: string | null
          route_number: string
          severity: string
          start_min: number
          status?: string
          unrecovered_trips?: number
          updated_at?: string
        }
        Update: {
          added_delay_min?: number
          affected_bus_ids?: string[]
          affected_crew_ids?: string[]
          affected_trips?: number
          created_at?: string
          description?: string | null
          disruption_type?: string
          duration_min?: number
          id?: string
          impact?: Json
          location?: string | null
          passengers_impacted?: number
          recovered_trips?: number
          recovery_rate_pct?: number
          reference?: string
          resolved_at?: string | null
          route_number?: string
          severity?: string
          start_min?: number
          status?: string
          unrecovered_trips?: number
          updated_at?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          applied: boolean
          applied_at: string | null
          created_at: string
          id: string
          input: Json
          label: string
          result: Json
          updated_at: string
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          label: string
          result?: Json
          updated_at?: string
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          created_at?: string
          id?: string
          input?: Json
          label?: string
          result?: Json
          updated_at?: string
        }
        Relationships: []
      }
      trip_assignments: {
        Row: {
          bus_id: string | null
          bus_label: string | null
          conductor_id: string | null
          conductor_name: string | null
          created_at: string
          delay_min: number
          depot: string
          destination: string | null
          disruption_id: string | null
          driver_id: string | null
          driver_name: string | null
          end_min: number
          id: string
          origin: string | null
          route_number: string
          same_depot: boolean
          source: string
          start_min: number
          trip_code: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          bus_id?: string | null
          bus_label?: string | null
          conductor_id?: string | null
          conductor_name?: string | null
          created_at?: string
          delay_min?: number
          depot: string
          destination?: string | null
          disruption_id?: string | null
          driver_id?: string | null
          driver_name?: string | null
          end_min: number
          id?: string
          origin?: string | null
          route_number: string
          same_depot?: boolean
          source?: string
          start_min: number
          trip_code: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          bus_id?: string | null
          bus_label?: string | null
          conductor_id?: string | null
          conductor_name?: string | null
          created_at?: string
          delay_min?: number
          depot?: string
          destination?: string | null
          disruption_id?: string | null
          driver_id?: string | null
          driver_name?: string | null
          end_min?: number
          id?: string
          origin?: string | null
          route_number?: string
          same_depot?: boolean
          source?: string
          start_min?: number
          trip_code?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_assignments_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_assignments_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "crew"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "crew"
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
      bus_status:
        | "AVAILABLE"
        | "ASSIGNED"
        | "MAINTENANCE"
        | "INACTIVE"
        | "RETIRED"
      crew_status:
        | "AVAILABLE"
        | "ASSIGNED"
        | "OFF_DUTY"
        | "UNAVAILABLE"
        | "INACTIVE"
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
      bus_status: [
        "AVAILABLE",
        "ASSIGNED",
        "MAINTENANCE",
        "INACTIVE",
        "RETIRED",
      ],
      crew_status: [
        "AVAILABLE",
        "ASSIGNED",
        "OFF_DUTY",
        "UNAVAILABLE",
        "INACTIVE",
      ],
    },
  },
} as const
