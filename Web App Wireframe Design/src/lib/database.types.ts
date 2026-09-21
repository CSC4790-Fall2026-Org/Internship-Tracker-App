// Generated from the Supabase schema. Regenerate after schema changes with:
//   npx supabase gen types typescript --project-id agckhqdtazdgxpeqljcg > src/lib/database.types.ts

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
      applications: {
        Row: {
          applied_date: string | null
          company: string
          created_at: string
          deadline: string | null
          id: string
          job_url: string
          location: string
          logo_color: string
          logo_initials: string
          notes: string
          position: string
          salary: string
          status: Database["public"]["Enums"]["app_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_date?: string | null
          company: string
          created_at?: string
          deadline?: string | null
          id?: string
          job_url?: string
          location?: string
          logo_color?: string
          logo_initials?: string
          notes?: string
          position: string
          salary?: string
          status?: Database["public"]["Enums"]["app_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          applied_date?: string | null
          company?: string
          created_at?: string
          deadline?: string | null
          id?: string
          job_url?: string
          location?: string
          logo_color?: string
          logo_initials?: string
          notes?: string
          position?: string
          salary?: string
          status?: Database["public"]["Enums"]["app_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          application_id: string
          company: string
          created_at: string
          email: string
          id: string
          name: string
          role: string
          user_id: string
        }
        Insert: {
          application_id: string
          company?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          role?: string
          user_id?: string
        }
        Update: {
          application_id?: string
          company?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_stages: {
        Row: {
          application_id: string
          completed: boolean
          created_at: string
          date: string | null
          id: string
          name: string
          notes: string
          user_id: string
        }
        Insert: {
          application_id: string
          completed?: boolean
          created_at?: string
          date?: string | null
          id?: string
          name: string
          notes?: string
          user_id?: string
        }
        Update: {
          application_id?: string
          completed?: boolean
          created_at?: string
          date?: string | null
          id?: string
          name?: string
          notes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_stages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          application_id: string | null
          created_at: string
          done: boolean
          due: string | null
          id: string
          text: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          done?: boolean
          due?: string | null
          id?: string
          text: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          done?: boolean
          due?: string | null
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
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
      app_status: "wishlist" | "applied" | "interviewing" | "offer" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
