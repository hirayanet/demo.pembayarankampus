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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          active: boolean
          created_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_roles: {
        Row: {
          role: string
          user_id: string
        }
        Insert: {
          role: string
          user_id: string
        }
        Update: {
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      bill_categories: {
        Row: {
          active: boolean
          created_at: string | null
          default_amount: number | null
          default_due_days: number | null
          default_installment_amount: number | null
          default_installment_count: number | null
          default_type: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          default_amount?: number | null
          default_due_days?: number | null
          default_installment_amount?: number | null
          default_installment_count?: number | null
          default_type?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          default_amount?: number | null
          default_due_days?: number | null
          default_installment_amount?: number | null
          default_installment_count?: number | null
          default_type?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bills: {
        Row: {
          amount: number
          category: string | null
          category_id: string | null
          created_at: string | null
          description: string
          due_date: string
          id: string
          installment_amount: number | null
          installment_count: number | null
          paid_amount: number | null
          status: Database["public"]["Enums"]["bill_status"] | null
          student_id: string | null
          type: Database["public"]["Enums"]["bill_type"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description: string
          due_date: string
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          paid_amount?: number | null
          status?: Database["public"]["Enums"]["bill_status"] | null
          student_id?: string | null
          type: Database["public"]["Enums"]["bill_type"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string
          due_date?: string
          id?: string
          installment_amount?: number | null
          installment_count?: number | null
          paid_amount?: number | null
          status?: Database["public"]["Enums"]["bill_status"] | null
          student_id?: string | null
          type?: Database["public"]["Enums"]["bill_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "bill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string | null
          created_at: string | null
          id: string
          payment_date: string | null
          payment_method: string
          receipt_number: string
          status: Database["public"]["Enums"]["payment_status"] | null
          student_id: string | null
        }
        Insert: {
          amount: number
          bill_id?: string | null
          created_at?: string | null
          id?: string
          payment_date?: string | null
          payment_method: string
          receipt_number: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          student_id?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_at?: string | null
          id?: string
          payment_date?: string | null
          payment_method?: string
          receipt_number?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          code: string
          created_at: string
          faculty: string | null
          id: string
          level: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          faculty?: string | null
          id?: string
          level?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          faculty?: string | null
          id?: string
          level?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          id: string
          security: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          security?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          security?: Json
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          angkatan: string
          created_at: string | null
          email: string
          id: string
          name: string
          nim_dikti: string | null
          nim_kashif: string
          phone: string | null
          prodi: string
          program_id: string | null
          status: Database["public"]["Enums"]["student_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          angkatan: string
          created_at?: string | null
          email: string
          id?: string
          name: string
          nim_dikti?: string | null
          nim_kashif: string
          phone?: string | null
          prodi: string
          program_id?: string | null
          status?: Database["public"]["Enums"]["student_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          angkatan?: string
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          nim_dikti?: string | null
          nim_kashif?: string
          phone?: string | null
          prodi?: string
          program_id?: string | null
          status?: Database["public"]["Enums"]["student_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          active: boolean
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_by_email: {
        Args: { p_email: string }
        Returns: undefined
      }
      admin_disable: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_enable: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_list: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          email: string
          user_id: string
        }[]
      }
      is_admin: {
        Args: Record<PropertyKey, never> | { uid: string }
        Returns: boolean
      }
      is_staff: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      managed_users_list: {
        Args: Record<PropertyKey, never>
        Returns: {
          active: boolean
          email: string
          role: string
          user_id: string
        }[]
      }
      role_set: {
        Args: { p_active: boolean; p_role: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      bill_status: "paid" | "unpaid" | "partial"
      bill_type: "fixed" | "installment"
      payment_status: "completed" | "pending" | "failed"
      student_status: "active" | "inactive" | "graduated"
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
      bill_status: ["paid", "unpaid", "partial"],
      bill_type: ["fixed", "installment"],
      payment_status: ["completed", "pending", "failed"],
      student_status: ["active", "inactive", "graduated"],
    },
  },
} as const
