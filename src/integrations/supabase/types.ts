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
      admin_decisions: {
        Row: {
          admin_id: string
          created_at: string | null
          decision_type: string
          errand_id: string | null
          id: string
          reason: string
          runner_id: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          decision_type: string
          errand_id?: string | null
          id?: string
          reason: string
          runner_id?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          decision_type?: string
          errand_id?: string | null
          id?: string
          reason?: string
          runner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_decisions_errand_id_fkey"
            columns: ["errand_id"]
            isOneToOne: false
            referencedRelation: "errands"
            referencedColumns: ["id"]
          },
        ]
      }
      errand_messages: {
        Row: {
          created_at: string | null
          errand_id: string
          id: string
          message: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          errand_id: string
          id?: string
          message: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          errand_id?: string
          id?: string
          message?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "errand_messages_errand_id_fkey"
            columns: ["errand_id"]
            isOneToOne: false
            referencedRelation: "errands"
            referencedColumns: ["id"]
          },
        ]
      }
      errand_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string
          errand_id: string
          id: string
          new_status: Database["public"]["Enums"]["errand_status"]
          notes: string | null
          previous_status: Database["public"]["Enums"]["errand_status"] | null
        }
        Insert: {
          changed_at?: string | null
          changed_by: string
          errand_id: string
          id?: string
          new_status: Database["public"]["Enums"]["errand_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["errand_status"] | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string
          errand_id?: string
          id?: string
          new_status?: Database["public"]["Enums"]["errand_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["errand_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "errand_status_history_errand_id_fkey"
            columns: ["errand_id"]
            isOneToOne: false
            referencedRelation: "errands"
            referencedColumns: ["id"]
          },
        ]
      }
      errands: {
        Row: {
          accepted_at: string | null
          admin_notes: string | null
          base_rate: number | null
          budget: number
          category: Database["public"]["Enums"]["errand_category"]
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string
          description: string
          dispute_reason: string | null
          disputed_at: string | null
          dropoff_location: string | null
          estimated_hours: number | null
          hourly_rate: number | null
          id: string
          location: string
          paid_at: string | null
          pickup_location: string | null
          runner_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["errand_status"]
          title: string
          total_price: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          admin_notes?: string | null
          base_rate?: number | null
          budget: number
          category: Database["public"]["Enums"]["errand_category"]
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id: string
          description: string
          dispute_reason?: string | null
          disputed_at?: string | null
          dropoff_location?: string | null
          estimated_hours?: number | null
          hourly_rate?: number | null
          id?: string
          location: string
          paid_at?: string | null
          pickup_location?: string | null
          runner_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["errand_status"]
          title: string
          total_price?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          admin_notes?: string | null
          base_rate?: number | null
          budget?: number
          category?: Database["public"]["Enums"]["errand_category"]
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          dispute_reason?: string | null
          disputed_at?: string | null
          dropoff_location?: string | null
          estimated_hours?: number | null
          hourly_rate?: number | null
          id?: string
          location?: string
          paid_at?: string | null
          pickup_location?: string | null
          runner_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["errand_status"]
          title?: string
          total_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          errand_id: string | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          errand_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          errand_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_errand_id_fkey"
            columns: ["errand_id"]
            isOneToOne: false
            referencedRelation: "errands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_notes: string | null
          bio: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          id_document_back_url: string | null
          id_document_url: string | null
          location: string | null
          phone: string | null
          selfie_url: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          id_document_back_url?: string | null
          id_document_url?: string | null
          location?: string | null
          phone?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          id_document_back_url?: string | null
          id_document_url?: string | null
          location?: string | null
          phone?: string | null
          selfie_url?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_id: string
          errand_id: string
          id: string
          rating: number
          runner_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_id: string
          errand_id: string
          id?: string
          rating: number
          runner_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string
          errand_id?: string
          id?: string
          rating?: number
          runner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_errand_id_fkey"
            columns: ["errand_id"]
            isOneToOne: true
            referencedRelation: "errands"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          errand_id: string | null
          id: string
          metadata: Json | null
          mpesa_reference: string | null
          phone_number: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          errand_id?: string | null
          id?: string
          metadata?: Json | null
          mpesa_reference?: string | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          errand_id?: string | null
          id?: string
          metadata?: Json | null
          mpesa_reference?: string | null
          phone_number?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_errand_id_fkey"
            columns: ["errand_id"]
            isOneToOne: false
            referencedRelation: "errands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          escrow_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          escrow_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      runner_stats: {
        Row: {
          average_rating: number | null
          completion_rate: number | null
          email: string | null
          full_name: string | null
          runner_id: string | null
          total_cancellations: number | null
          total_completed: number | null
          total_disputes: number | null
          total_ratings: number | null
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_notification: {
        Args: {
          p_errand_id?: string
          p_message: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      log_status_change: {
        Args: {
          p_changed_by: string
          p_errand_id: string
          p_new_status: Database["public"]["Enums"]["errand_status"]
          p_notes?: string
          p_previous_status: Database["public"]["Enums"]["errand_status"]
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      errand_category:
        | "groceries"
        | "delivery"
        | "cleaning"
        | "laundry"
        | "moving"
        | "other"
      errand_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "confirmed"
        | "disputed"
        | "paid"
      notification_type:
        | "job_posted"
        | "job_accepted"
        | "job_started"
        | "job_completed"
        | "confirmation_requested"
        | "job_confirmed"
        | "job_disputed"
        | "job_paid"
        | "job_reassigned"
        | "runner_suspended"
        | "runner_reinstated"
        | "admin_action"
        | "new_message"
        | "rating_received"
      transaction_status: "pending" | "completed" | "failed" | "cancelled"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "errand_payment"
        | "errand_release"
        | "refund"
        | "commission"
      user_type: "customer" | "runner"
      verification_status: "pending" | "under_review" | "verified" | "rejected"
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
      app_role: ["admin", "user"],
      errand_category: [
        "groceries",
        "delivery",
        "cleaning",
        "laundry",
        "moving",
        "other",
      ],
      errand_status: [
        "open",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "confirmed",
        "disputed",
        "paid",
      ],
      notification_type: [
        "job_posted",
        "job_accepted",
        "job_started",
        "job_completed",
        "confirmation_requested",
        "job_confirmed",
        "job_disputed",
        "job_paid",
        "job_reassigned",
        "runner_suspended",
        "runner_reinstated",
        "admin_action",
        "new_message",
        "rating_received",
      ],
      transaction_status: ["pending", "completed", "failed", "cancelled"],
      transaction_type: [
        "deposit",
        "withdrawal",
        "errand_payment",
        "errand_release",
        "refund",
        "commission",
      ],
      user_type: ["customer", "runner"],
      verification_status: ["pending", "under_review", "verified", "rejected"],
    },
  },
} as const
