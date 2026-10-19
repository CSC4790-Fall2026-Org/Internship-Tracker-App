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
      application_contacts: {
        Row: {
          application_id: string
          contact_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          contact_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string
          contact_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_contacts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      calendar_events: {
        Row: {
          application_id: string | null
          created_at: string
          date: string
          id: string
          notes: string
          start_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          date: string
          id?: string
          notes?: string
          start_time?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string
          start_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      career_log_entries: {
        Row: {
          application_id: string | null
          category: string
          created_at: string
          date: string
          details: string
          id: string
          impact: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          category?: string
          created_at?: string
          date?: string
          details?: string
          id?: string
          impact?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          category?: string
          created_at?: string
          date?: string
          details?: string
          id?: string
          impact?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_log_entries_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string
          phone: string
          role: string
          user_id: string
        }
        Insert: {
          company?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          notes?: string
          phone?: string
          role?: string
          user_id?: string
        }
        Update: {
          company?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          role?: string
          user_id?: string
        }
        Relationships: []
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
      job_recommendations: {
        Row: {
          career_fields: string[]
          created_at: string
          generated_at: string
          id: string
          job_type: string
          jobs: Json
          searches: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          career_fields?: string[]
          created_at?: string
          generated_at?: string
          id?: string
          job_type?: string
          jobs?: Json
          searches?: Json
          updated_at?: string
          user_id?: string
        }
        Update: {
          career_fields?: string[]
          created_at?: string
          generated_at?: string
          id?: string
          job_type?: string
          jobs?: Json
          searches?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resume_profiles: {
        Row: {
          career_fields: string[]
          created_at: string
          email: string
          experience: Json
          file_name: string | null
          file_path: string | null
          full_name: string
          graduation: string
          id: string
          job_type: string
          interests: string[]
          major: string
          parsed_at: string | null
          phone: string
          preferred_locations: string[]
          school: string
          skills: string[]
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          career_fields?: string[]
          created_at?: string
          email?: string
          experience?: Json
          file_name?: string | null
          file_path?: string | null
          full_name?: string
          graduation?: string
          id?: string
          job_type?: string
          interests?: string[]
          major?: string
          parsed_at?: string | null
          phone?: string
          preferred_locations?: string[]
          school?: string
          skills?: string[]
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          career_fields?: string[]
          created_at?: string
          email?: string
          experience?: Json
          file_name?: string | null
          file_path?: string | null
          full_name?: string
          graduation?: string
          id?: string
          job_type?: string
          interests?: string[]
          major?: string
          parsed_at?: string | null
          phone?: string
          preferred_locations?: string[]
          school?: string
          skills?: string[]
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
