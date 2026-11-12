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
      admin_chatbot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          institution_id: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          institution_id?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          institution_id?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      application_messages: {
        Row: {
          application_id: string
          content: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          application_id: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role?: string
        }
        Update: {
          application_id?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          dossier: Json
          dossier_version: number
          id: string
          motivation: string | null
          origin_institution_id: string | null
          program_id: string | null
          status: string
          target_filiere_id: string | null
          target_institution_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          dossier?: Json
          dossier_version?: number
          id?: string
          motivation?: string | null
          origin_institution_id?: string | null
          program_id?: string | null
          status?: string
          target_filiere_id?: string | null
          target_institution_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          dossier?: Json
          dossier_version?: number
          id?: string
          motivation?: string | null
          origin_institution_id?: string | null
          program_id?: string | null
          status?: string
          target_filiere_id?: string | null
          target_institution_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "partner_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_target_filiere_id_fkey"
            columns: ["target_filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_target_institution_id_fkey"
            columns: ["target_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          academic_year: string | null
          campus_id: string | null
          created_at: string | null
          date: string
          duration_hours: number | null
          id: string
          institution_id: string | null
          justificatif_reason: string | null
          justificatif_reviewed_at: string | null
          justificatif_reviewed_by: string | null
          justificatif_status: string | null
          justificatif_submitted_at: string | null
          justificatif_url: string | null
          marked_by: string | null
          schedule_event_id: string | null
          session_id: string | null
          status: string
          subject_id: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          campus_id?: string | null
          created_at?: string | null
          date?: string
          duration_hours?: number | null
          id?: string
          institution_id?: string | null
          justificatif_reason?: string | null
          justificatif_reviewed_at?: string | null
          justificatif_reviewed_by?: string | null
          justificatif_status?: string | null
          justificatif_submitted_at?: string | null
          justificatif_url?: string | null
          marked_by?: string | null
          schedule_event_id?: string | null
          session_id?: string | null
          status?: string
          subject_id?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string | null
          campus_id?: string | null
          created_at?: string | null
          date?: string
          duration_hours?: number | null
          id?: string
          institution_id?: string | null
          justificatif_reason?: string | null
          justificatif_reviewed_at?: string | null
          justificatif_reviewed_by?: string | null
          justificatif_status?: string | null
          justificatif_submitted_at?: string | null
          justificatif_url?: string | null
          marked_by?: string | null
          schedule_event_id?: string | null
          session_id?: string | null
          status?: string
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_schedule_event_id_fkey"
            columns: ["schedule_event_id"]
            isOneToOne: false
            referencedRelation: "schedule_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          academic_year: string
          campus_id: string | null
          created_at: string
          duration_hours: number
          id: string
          institution_id: string
          notes: string | null
          professor_id: string
          session_date: string
          session_time: string
          subject_id: string
        }
        Insert: {
          academic_year: string
          campus_id?: string | null
          created_at?: string
          duration_hours?: number
          id?: string
          institution_id: string
          notes?: string | null
          professor_id: string
          session_date?: string
          session_time?: string
          subject_id: string
        }
        Update: {
          academic_year?: string
          campus_id?: string | null
          created_at?: string
          duration_hours?: number
          id?: string
          institution_id?: string
          notes?: string | null
          professor_id?: string
          session_date?: string
          session_time?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          categorie: string
          created_at: string
          description: string | null
          id: string
          institution_id: string | null
          ip_address: string | null
          module: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          categorie: string
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          ip_address?: string | null
          module?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          categorie?: string
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string | null
          ip_address?: string | null
          module?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      bac_results: {
        Row: {
          academic_year: string | null
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          institution_id: string | null
          mention: string | null
          moyenne: number | null
          serie: string | null
          source: string
          status: string
          subject_scores: Json
          updated_at: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          institution_id?: string | null
          mention?: string | null
          moyenne?: number | null
          serie?: string | null
          source?: string
          status?: string
          subject_scores?: Json
          updated_at?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          institution_id?: string | null
          mention?: string | null
          moyenne?: number | null
          serie?: string | null
          source?: string
          status?: string
          subject_scores?: Json
          updated_at?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bac_results_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_logs: {
        Row: {
          created_at: string
          details: Json | null
          drive_file_id: string | null
          drive_file_name: string | null
          establishment_id: string | null
          id: string
          restore_type: string
          restored_at: string
          restored_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          drive_file_id?: string | null
          drive_file_name?: string | null
          establishment_id?: string | null
          id?: string
          restore_type?: string
          restored_at?: string
          restored_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          drive_file_id?: string | null
          drive_file_name?: string | null
          establishment_id?: string | null
          id?: string
          restore_type?: string
          restored_at?: string
          restored_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "backup_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      backups_history: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          institutions_count: number
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          institutions_count?: number
          size_bytes?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          institutions_count?: number
          size_bytes?: number
          storage_path?: string
        }
        Relationships: []
      }
      bde_members: {
        Row: {
          institution_id: string | null
          academic_year: string
          bio: string | null
          created_at: string
          id: string
          photo_url: string | null
          role: string
          title: string | null
          user_id: string
        }
        Insert: {
          institution_id?: string | null
          academic_year: string
          bio?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          role?: string
          title?: string | null
          user_id: string
        }
        Update: {
          institution_id?: string | null
          academic_year?: string
          bio?: string | null
          created_at?: string
          id?: string
          photo_url?: string | null
          role?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bde_posts: {
        Row: {
          institution_id: string | null
          author_id: string
          content: string
          created_at: string
          id: string
          image_url: string | null
          title: string | null
        }
        Insert: {
          institution_id?: string | null
          author_id: string
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          title?: string | null
        }
        Update: {
          institution_id?: string | null
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          title?: string | null
        }
        Relationships: []
      }
      campus_staff: {
        Row: {
          campus_id: string
          created_at: string
          id: string
          institution_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          id?: string
          institution_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          id?: string
          institution_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campus_staff_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campus_staff_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          cycle: string
          email: string | null
          id: string
          institution_id: string
          is_active: boolean
          is_main: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          cycle?: string
          email?: string | null
          id?: string
          institution_id: string
          is_active?: boolean
          is_main?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          cycle?: string
          email?: string | null
          id?: string
          institution_id?: string
          is_active?: boolean
          is_main?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campuses_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          academic_year: string
          classe_id: string
          coefficient: number
          created_at: string
          id: string
          institution_id: string
          matiere: string
          professor_user_id: string
        }
        Insert: {
          academic_year: string
          classe_id: string
          coefficient?: number
          created_at?: string
          id?: string
          institution_id: string
          matiere: string
          professor_user_id: string
        }
        Update: {
          academic_year?: string
          classe_id?: string
          coefficient?: number
          created_at?: string
          id?: string
          institution_id?: string
          matiere?: string
          professor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          campus_id: string | null
          academic_year: string
          created_at: string
          cycle: string
          filiere_id: string | null
          id: string
          institution_id: string
          niveau: string
          nom: string
          serie: string | null
          updated_at: string
        }
        Insert: {
          campus_id?: string | null
          academic_year: string
          created_at?: string
          cycle: string
          filiere_id?: string | null
          id?: string
          institution_id: string
          niveau: string
          nom: string
          serie?: string | null
          updated_at?: string
        }
        Update: {
          campus_id?: string | null
          academic_year?: string
          created_at?: string
          cycle?: string
          filiere_id?: string | null
          id?: string
          institution_id?: string
          niveau?: string
          nom?: string
          serie?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          building: string | null
          campus_id: string | null
          capacity: number | null
          created_at: string | null
          created_by: string | null
          equipment: string | null
          floor: string | null
          id: string
          institution_id: string | null
          is_available: boolean | null
          name: string
          updated_by: string | null
        }
        Insert: {
          building?: string | null
          campus_id?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          equipment?: string | null
          floor?: string | null
          id?: string
          institution_id?: string | null
          is_available?: boolean | null
          name: string
          updated_by?: string | null
        }
        Update: {
          building?: string | null
          campus_id?: string | null
          capacity?: number | null
          created_at?: string | null
          created_by?: string | null
          equipment?: string | null
          floor?: string | null
          id?: string
          institution_id?: string | null
          is_available?: boolean | null
          name?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_bookmarks: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      community_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          institution_id: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          institution_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          institution_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          institution_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          institution_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          institution_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_likes: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string
          club_name: string | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          institution_id: string | null
          post_type: string
          video_url: string | null
        }
        Insert: {
          author_id: string
          club_name?: string | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          institution_id?: string | null
          post_type?: string
          video_url?: string | null
        }
        Update: {
          author_id?: string
          club_name?: string | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          institution_id?: string | null
          post_type?: string
          video_url?: string | null
        }
        Relationships: []
      }
      community_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          institution_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          institution_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          institution_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      course_documents: {
        Row: {
          created_at: string
          doc_type: string | null
          file_url: string | null
          id: string
          subject_id: string
          title: string
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          file_url?: string | null
          id?: string
          subject_id: string
          title: string
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          file_url?: string | null
          id?: string
          subject_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      course_validation: {
        Row: {
          academic_year: string
          created_at: string
          filiere_id: string
          id: string
          institution_id: string
          is_validated: boolean
          notes: string | null
          subject_id: string
          updated_at: string
          validated_at: string
          validated_by: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string
          filiere_id: string
          id?: string
          institution_id: string
          is_validated?: boolean
          notes?: string | null
          subject_id: string
          updated_at?: string
          validated_at?: string
          validated_by?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string
          filiere_id?: string
          id?: string
          institution_id?: string
          is_validated?: boolean
          notes?: string | null
          subject_id?: string
          updated_at?: string
          validated_at?: string
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_validation_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_validation_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_validation_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_secrets: {
        Row: {
          created_at: string
          name: string
          value: string
        }
        Insert: {
          created_at?: string
          name: string
          value: string
        }
        Update: {
          created_at?: string
          name?: string
          value?: string
        }
        Relationships: []
      }
      director_signatures: {
        Row: {
          activated_at: string | null
          created_at: string
          director_name: string
          id: string
          institution_id: string
          is_active: boolean
          role_scope: string
          signature_url: string | null
          stamp_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          director_name: string
          id?: string
          institution_id: string
          is_active?: boolean
          role_scope?: string
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          director_name?: string
          id?: string
          institution_id?: string
          is_active?: boolean
          role_scope?: string
          signature_url?: string | null
          stamp_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_validations: {
        Row: {
          academic_year: string | null
          created_at: string
          created_by: string | null
          cycle_rejection_reason: string | null
          cycle_signature_id: string | null
          cycle_signed_at: string | null
          cycle_signed_by: string | null
          cycle_status: string
          document_ref: string | null
          document_type: string
          id: string
          institution_id: string
          payload: Json
          pdf_url: string | null
          pedagogique_rejection_reason: string | null
          pedagogique_signature_id: string | null
          pedagogique_signed_at: string | null
          pedagogique_signed_by: string | null
          pedagogique_status: string
          rejection_reason: string | null
          signature_id: string | null
          status: string
          student_user_id: string | null
          title: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          cycle_rejection_reason?: string | null
          cycle_signature_id?: string | null
          cycle_signed_at?: string | null
          cycle_signed_by?: string | null
          cycle_status?: string
          document_ref?: string | null
          document_type: string
          id?: string
          institution_id: string
          payload?: Json
          pdf_url?: string | null
          pedagogique_rejection_reason?: string | null
          pedagogique_signature_id?: string | null
          pedagogique_signed_at?: string | null
          pedagogique_signed_by?: string | null
          pedagogique_status?: string
          rejection_reason?: string | null
          signature_id?: string | null
          status?: string
          student_user_id?: string | null
          title?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          cycle_rejection_reason?: string | null
          cycle_signature_id?: string | null
          cycle_signed_at?: string | null
          cycle_signed_by?: string | null
          cycle_status?: string
          document_ref?: string | null
          document_type?: string
          id?: string
          institution_id?: string
          payload?: Json
          pdf_url?: string | null
          pedagogique_rejection_reason?: string | null
          pedagogique_signature_id?: string | null
          pedagogique_signed_at?: string | null
          pedagogique_signed_by?: string | null
          pedagogique_status?: string
          rejection_reason?: string | null
          signature_id?: string | null
          status?: string
          student_user_id?: string | null
          title?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_validations_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "director_signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      election_candidates: {
        Row: {
          created_at: string
          election_id: string
          group_logo_url: string | null
          group_name: string | null
          id: string
          photo_url: string | null
          program: string | null
          user_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          election_id: string
          group_logo_url?: string | null
          group_name?: string | null
          id?: string
          photo_url?: string | null
          program?: string | null
          user_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          election_id?: string
          group_logo_url?: string | null
          group_name?: string | null
          id?: string
          photo_url?: string | null
          program?: string | null
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "election_candidates_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      election_group_members: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          member_name: string
          member_role: string
          photo_url: string | null
          user_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          member_name: string
          member_role: string
          photo_url?: string | null
          user_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          member_name?: string
          member_role?: string
          photo_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_group_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "election_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      election_votes: {
        Row: {
          candidate_id: string
          created_at: string
          election_id: string
          id: string
          voter_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_id: string
          id?: string
          voter_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_id?: string
          id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "election_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          academic_year: string
          created_at: string
          description: string | null
          end_date: string
          id: string
          institution_id: string | null
          start_date: string
          status: string
          title: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          institution_id?: string | null
          start_date: string
          status?: string
          title: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          institution_id?: string | null
          start_date?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "elections_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          campus_id: string | null
          enrolled_at: string
          id: string
          progress: number
          subject_id: string
          user_id: string
        }
        Insert: {
          campus_id?: string | null
          enrolled_at?: string
          id?: string
          progress?: number
          subject_id: string
          user_id: string
        }
        Update: {
          campus_id?: string | null
          enrolled_at?: string
          id?: string
          progress?: number
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      event_comments: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_likes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_media: {
        Row: {
          created_at: string
          event_id: string
          id: string
          media_type: string
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          media_type?: string
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          media_type?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          event_date: string
          event_type: string
          filiere_id: string | null
          id: string
          image_url: string | null
          institution_id: string | null
          level: string | null
          location: string | null
          title: string
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          event_date: string
          event_type?: string
          filiere_id?: string | null
          id?: string
          image_url?: string | null
          institution_id?: string | null
          level?: string | null
          location?: string | null
          title: string
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          event_date?: string
          event_type?: string
          filiere_id?: string | null
          id?: string
          image_url?: string | null
          institution_id?: string | null
          level?: string | null
          location?: string | null
          title?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_blanc_candidats: {
        Row: {
          academic_year: string
          created_at: string
          id: string
          institution_id: string
          numero_candidat: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          id?: string
          institution_id: string
          numero_candidat: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          id?: string
          institution_id?: string
          numero_candidat?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_blanc_candidats_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          amount: number
          created_at: string
          cycle_scope: string
          fee_kind: string
          id: string
          institution_id: string
          is_active: boolean
          label: string
          monthly_count: number
          niveau: string | null
          orientation_scope: string
          serie: string | null
          unlocks_new_year: boolean
          updated_at: string
          validity_years: number
        }
        Insert: {
          amount?: number
          created_at?: string
          cycle_scope?: string
          fee_kind?: string
          id?: string
          institution_id: string
          is_active?: boolean
          label: string
          monthly_count?: number
          niveau?: string | null
          orientation_scope?: string
          serie?: string | null
          unlocks_new_year?: boolean
          updated_at?: string
          validity_years?: number
        }
        Update: {
          amount?: number
          created_at?: string
          cycle_scope?: string
          fee_kind?: string
          id?: string
          institution_id?: string
          is_active?: boolean
          label?: string
          monthly_count?: number
          niveau?: string | null
          orientation_scope?: string
          serie?: string | null
          unlocks_new_year?: boolean
          updated_at?: string
          validity_years?: number
        }
        Relationships: []
      }
      filiere_closures: {
        Row: {
          academic_year: string
          closed_at: string
          closed_by: string | null
          filiere_id: string
          id: string
          institution_id: string
        }
        Insert: {
          academic_year: string
          closed_at?: string
          closed_by?: string | null
          filiere_id: string
          id?: string
          institution_id: string
        }
        Update: {
          academic_year?: string
          closed_at?: string
          closed_by?: string | null
          filiere_id?: string
          id?: string
          institution_id?: string
        }
        Relationships: []
      }
      filieres: {
        Row: {
          admission_info: string | null
          admission_level: string | null
          campus_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          institution_id: string | null
          name: string
          open_for_applications: boolean
          updated_by: string | null
        }
        Insert: {
          admission_info?: string | null
          admission_level?: string | null
          campus_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          institution_id?: string | null
          name: string
          open_for_applications?: boolean
          updated_by?: string | null
        }
        Update: {
          admission_info?: string | null
          admission_level?: string | null
          campus_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          institution_id?: string | null
          name?: string
          open_for_applications?: boolean
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filieres_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filieres_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      google_link_requests: {
        Row: {
          created_at: string
          expires_at: string
          google_email: string | null
          id: string
          institution_id: string | null
          state_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          google_email?: string | null
          id?: string
          institution_id?: string | null
          state_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          google_email?: string | null
          id?: string
          institution_id?: string | null
          state_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          academic_year: string
          approved_at: string | null
          approved_by_student: boolean
          average: number | null
          campus_id: string | null
          cc_grade: number | null
          created_at: string
          created_by: string | null
          exam_grade: number | null
          id: string
          institution_id: string | null
          is_locked: boolean
          semester: string
          student_signature_url: string | null
          subject_id: string
          submission_batch_id: string | null
          submission_status: string
          submitted_to_admin_at: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string
          approved_at?: string | null
          approved_by_student?: boolean
          average?: number | null
          campus_id?: string | null
          cc_grade?: number | null
          created_at?: string
          created_by?: string | null
          exam_grade?: number | null
          id?: string
          institution_id?: string | null
          is_locked?: boolean
          semester?: string
          student_signature_url?: string | null
          subject_id: string
          submission_batch_id?: string | null
          submission_status?: string
          submitted_to_admin_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string
          approved_at?: string | null
          approved_by_student?: boolean
          average?: number | null
          campus_id?: string | null
          cc_grade?: number | null
          created_at?: string
          created_by?: string | null
          exam_grade?: number | null
          id?: string
          institution_id?: string | null
          is_locked?: boolean
          semester?: string
          student_signature_url?: string | null
          subject_id?: string
          submission_batch_id?: string | null
          submission_status?: string
          submitted_to_admin_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      grades_trimestre: {
        Row: {
          academic_year: string
          bareme1: number
          bareme2: number
          bareme3: number
          classe_id: string
          coefficient: number
          created_at: string
          id: string
          institution_id: string
          matiere: string
          note1: number | null
          note2: number | null
          note3: number | null
          professor_user_id: string | null
          trimestre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          bareme1?: number
          bareme2?: number
          bareme3?: number
          classe_id: string
          coefficient?: number
          created_at?: string
          id?: string
          institution_id: string
          matiere: string
          note1?: number | null
          note2?: number | null
          note3?: number | null
          professor_user_id?: string | null
          trimestre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          bareme1?: number
          bareme2?: number
          bareme3?: number
          classe_id?: string
          coefficient?: number
          created_at?: string
          id?: string
          institution_id?: string
          matiere?: string
          note1?: number | null
          note2?: number | null
          note3?: number | null
          professor_user_id?: string | null
          trimestre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_trimestre_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_trimestre_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      imports_history: {
        Row: {
          academic_year: string | null
          created_at: string
          created_by: string | null
          created_count: number
          errors_count: number
          errors_sample: Json | null
          file_name: string | null
          id: string
          institution_id: string | null
          institution_name: string | null
          module: string
          rows_count: number
          updated_count: number
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          errors_count?: number
          errors_sample?: Json | null
          file_name?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          module: string
          rows_count?: number
          updated_count?: number
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          created_count?: number
          errors_count?: number
          errors_sample?: Json | null
          file_name?: string | null
          id?: string
          institution_id?: string | null
          institution_name?: string | null
          module?: string
          rows_count?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "imports_history_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_preregistrations: {
        Row: {
          address: string | null
          agrement_url: string | null
          created_at: string
          created_institution_id: string | null
          custom_domain: string | null
          cycle: string | null
          desired_slug: string | null
          director_id_url: string | null
          director_name: string
          domain_mode: string
          enabled_cycles: string[] | null
          id: string
          institution_name: string
          institution_type: string | null
          logo_url: string | null
          nif_url: string | null
          notes: string | null
          official_email: string
          phone: string | null
          rccm_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          agrement_url?: string | null
          created_at?: string
          created_institution_id?: string | null
          custom_domain?: string | null
          cycle?: string | null
          desired_slug?: string | null
          director_id_url?: string | null
          director_name: string
          domain_mode?: string
          enabled_cycles?: string[] | null
          id?: string
          institution_name: string
          institution_type?: string | null
          logo_url?: string | null
          nif_url?: string | null
          notes?: string | null
          official_email: string
          phone?: string | null
          rccm_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          agrement_url?: string | null
          created_at?: string
          created_institution_id?: string | null
          custom_domain?: string | null
          cycle?: string | null
          desired_slug?: string | null
          director_id_url?: string | null
          director_name?: string
          domain_mode?: string
          enabled_cycles?: string[] | null
          id?: string
          institution_name?: string
          institution_type?: string | null
          logo_url?: string | null
          nif_url?: string | null
          notes?: string | null
          official_email?: string
          phone?: string | null
          rccm_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_preregistrations_created_institution_id_fkey"
            columns: ["created_institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          currency: string
          ends_at: string
          id: string
          institution_id: string
          notes: string | null
          plan_name: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          ends_at?: string
          id?: string
          institution_id: string
          notes?: string | null
          plan_name?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          ends_at?: string
          id?: string
          institution_id?: string
          notes?: string | null
          plan_name?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "institution_subscriptions_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      institutions: {
        Row: {
          academic_year: string | null
          accent_color: string | null
          accepts_applications: boolean
          access_key: string | null
          address: string | null
          admission_contact: string | null
          bde_logo_url: string | null
          code: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          credits_max_passage: number
          credits_min_passage: number
          credits_total_annee: number
          custom_domain: string | null
          cycle: string
          description: string | null
          domain: string | null
          email: string | null
          enabled_cycles: string[]
          end_of_year_completed: boolean | null
          exam_blanc_enabled: boolean
          exam_blanc_types: string[]
          id: string
          institution_type: string
          is_active: boolean | null
          is_multi_campus: boolean
          login_button_color: string | null
          login_layout: string | null
          login_overlay: number | null
          login_subtitle: string | null
          login_title: string | null
          logo_url: string | null
          name: string
          non_reinscription_days: number
          pass_threshold: number
          payment_config: Json | null
          phone: string | null
          primary_color: string | null
          quota_absence_hours_annuel: number
          secondary_color: string | null
          slogan: string | null
          slug: string | null
          trimestre_third_note: boolean
        }
        Insert: {
          academic_year?: string | null
          accent_color?: string | null
          accepts_applications?: boolean
          access_key?: string | null
          address?: string | null
          admission_contact?: string | null
          bde_logo_url?: string | null
          code?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          credits_max_passage?: number
          credits_min_passage?: number
          credits_total_annee?: number
          custom_domain?: string | null
          cycle?: string
          description?: string | null
          domain?: string | null
          email?: string | null
          enabled_cycles?: string[]
          end_of_year_completed?: boolean | null
          exam_blanc_enabled?: boolean
          exam_blanc_types?: string[]
          id?: string
          institution_type?: string
          is_active?: boolean | null
          is_multi_campus?: boolean
          login_button_color?: string | null
          login_layout?: string | null
          login_overlay?: number | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_url?: string | null
          name: string
          non_reinscription_days?: number
          pass_threshold?: number
          payment_config?: Json | null
          phone?: string | null
          primary_color?: string | null
          quota_absence_hours_annuel?: number
          secondary_color?: string | null
          slogan?: string | null
          slug?: string | null
          trimestre_third_note?: boolean
        }
        Update: {
          academic_year?: string | null
          accent_color?: string | null
          accepts_applications?: boolean
          access_key?: string | null
          address?: string | null
          admission_contact?: string | null
          bde_logo_url?: string | null
          code?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          credits_max_passage?: number
          credits_min_passage?: number
          credits_total_annee?: number
          custom_domain?: string | null
          cycle?: string
          description?: string | null
          domain?: string | null
          email?: string | null
          enabled_cycles?: string[]
          end_of_year_completed?: boolean | null
          exam_blanc_enabled?: boolean
          exam_blanc_types?: string[]
          id?: string
          institution_type?: string
          is_active?: boolean | null
          is_multi_campus?: boolean
          login_button_color?: string | null
          login_layout?: string | null
          login_overlay?: number | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_url?: string | null
          name?: string
          non_reinscription_days?: number
          pass_threshold?: number
          payment_config?: Json | null
          phone?: string | null
          primary_color?: string | null
          quota_absence_hours_annuel?: number
          secondary_color?: string | null
          slogan?: string | null
          slug?: string | null
          trimestre_third_note?: boolean
        }
        Relationships: []
      }
      library_annotations: {
        Row: {
          book_id: string
          color: string | null
          created_at: string
          id: string
          page: number
          position: Json | null
          text: string | null
          type: string
          user_id: string
        }
        Insert: {
          book_id: string
          color?: string | null
          created_at?: string
          id?: string
          page: number
          position?: Json | null
          text?: string | null
          type: string
          user_id: string
        }
        Update: {
          book_id?: string
          color?: string | null
          created_at?: string
          id?: string
          page?: number
          position?: Json | null
          text?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_annotations_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_bookmarks: {
        Row: {
          book_id: string
          created_at: string
          id: string
          label: string | null
          page: number
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          label?: string | null
          page: number
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          label?: string | null
          page?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_bookmarks_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          category: string | null
          cover_image: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          download_allowed: boolean
          external_id: string | null
          external_link: string | null
          file_url: string | null
          filiere_id: string | null
          id: string
          institution_id: string | null
          isbn: string | null
          niveau: string | null
          source: string
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          cover_image?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          download_allowed?: boolean
          external_id?: string | null
          external_link?: string | null
          file_url?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          isbn?: string | null
          niveau?: string | null
          source?: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          cover_image?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          download_allowed?: boolean
          external_id?: string | null
          external_link?: string | null
          file_url?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          isbn?: string | null
          niveau?: string | null
          source?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_books_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_books_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      library_favorites: {
        Row: {
          book_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_favorites_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_reading_history: {
        Row: {
          book_id: string
          id: string
          last_page: number
          last_read_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          id?: string
          last_page?: number
          last_read_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          id?: string
          last_page?: number
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_reading_history_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_settings: {
        Row: {
          api_key: string | null
          api_url: string | null
          auto_sync_enabled: boolean
          created_at: string
          detected_auth_type: string | null
          detected_data_path: string | null
          detected_response_format: string | null
          id: string
          institution_id: string
          last_sync: string | null
          mode_detected: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          auto_sync_enabled?: boolean
          created_at?: string
          detected_auth_type?: string | null
          detected_data_path?: string | null
          detected_response_format?: string | null
          id?: string
          institution_id: string
          last_sync?: string | null
          mode_detected?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          auto_sync_enabled?: boolean
          created_at?: string
          detected_auth_type?: string | null
          detected_data_path?: string | null
          detected_response_format?: string | null
          id?: string
          institution_id?: string
          last_sync?: string | null
          mode_detected?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_settings_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: true
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      library_sync_logs: {
        Row: {
          books_imported: number
          error_details: Json | null
          errors_count: number
          finished_at: string | null
          id: string
          institution_id: string
          mode_used: string | null
          started_at: string
          status: string
        }
        Insert: {
          books_imported?: number
          error_details?: Json | null
          errors_count?: number
          finished_at?: string | null
          id?: string
          institution_id: string
          mode_used?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          books_imported?: number
          error_details?: Json | null
          errors_count?: number
          finished_at?: string | null
          id?: string
          institution_id?: string
          mode_used?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_sync_logs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      message_group_members: {
        Row: {
          added_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "message_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      message_groups: {
        Row: {
          academic_year: string | null
          created_at: string
          created_by: string | null
          filiere_id: string | null
          group_type: string
          id: string
          institution_id: string | null
          level: string | null
          name: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          filiere_id?: string | null
          group_type?: string
          id?: string
          institution_id?: string | null
          level?: string | null
          name: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          filiere_id?: string | null
          group_type?: string
          id?: string
          institution_id?: string | null
          level?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_groups_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_groups_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_url: string | null
          body: string
          created_at: string
          deleted_for: string[]
          deleted_for_everyone: boolean
          delivered_at: string | null
          edited_at: string | null
          id: string
          image_url: string | null
          institution_id: string | null
          is_read: boolean
          read_at: string | null
          recipient_id: string
          sender_id: string
          subject: string
          view_once: boolean
          viewed_at: string | null
        }
        Insert: {
          audio_url?: string | null
          body: string
          created_at?: string
          deleted_for?: string[]
          deleted_for_everyone?: boolean
          delivered_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          institution_id?: string | null
          is_read?: boolean
          read_at?: string | null
          recipient_id: string
          sender_id: string
          subject?: string
          view_once?: boolean
          viewed_at?: string | null
        }
        Update: {
          audio_url?: string | null
          body?: string
          created_at?: string
          deleted_for?: string[]
          deleted_for_everyone?: boolean
          delivered_at?: string | null
          edited_at?: string | null
          id?: string
          image_url?: string | null
          institution_id?: string | null
          is_read?: boolean
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          subject?: string
          view_once?: boolean
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          allow_email: boolean
          allow_push: boolean
          allow_sms: boolean
          allow_sound: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_email?: boolean
          allow_push?: boolean
          allow_sms?: boolean
          allow_sound?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_email?: boolean
          allow_push?: boolean
          allow_sms?: boolean
          allow_sound?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          institution_id: string | null
          is_read: boolean
          link: string | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id?: string | null
          is_read?: boolean
          link?: string | null
          message: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string | null
          is_read?: boolean
          link?: string | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      orientation_profiles: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          strengths: Json
          suggestions: Json
          summary: string | null
          updated_at: string
          user_id: string
          weaknesses: Json
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          strengths?: Json
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id: string
          weaknesses?: Json
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          strengths?: Json
          suggestions?: Json
          summary?: string | null
          updated_at?: string
          user_id?: string
          weaknesses?: Json
        }
        Relationships: []
      }
      parametres_etablissement: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          mode_calcul_moyenne_semestre: string
          mode_validation_ue: string
          note_min_validation: number
          quota_absence_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          mode_calcul_moyenne_semestre?: string
          mode_validation_ue?: string
          note_min_validation?: number
          quota_absence_hours?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          mode_calcul_moyenne_semestre?: string
          mode_validation_ue?: string
          note_min_validation?: number
          quota_absence_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      parent_students: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          relation: string | null
          student_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          relation?: string | null
          student_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          relation?: string | null
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          institution_id: string
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          institution_id: string
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          institution_id?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partner_programs: {
        Row: {
          city: string | null
          created_at: string
          description: string | null
          domain: string
          duration_years: number | null
          id: string
          institution_id: string
          is_active: boolean
          level: string
          min_average: number | null
          name: string
          seats: number | null
          series_accepted: string[]
          tuition: number | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          description?: string | null
          domain: string
          duration_years?: number | null
          id?: string
          institution_id: string
          is_active?: boolean
          level?: string
          min_average?: number | null
          name: string
          seats?: number | null
          series_accepted?: string[]
          tuition?: number | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          description?: string | null
          domain?: string
          duration_years?: number | null
          id?: string
          institution_id?: string
          is_active?: boolean
          level?: string
          min_average?: number | null
          name?: string
          seats?: number | null
          series_accepted?: string[]
          tuition?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_programs_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          installment_number: number
          institution_id: string | null
          paid_amount: number
          payment_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          installment_number: number
          institution_id?: string | null
          paid_amount?: number
          payment_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          installment_number?: number
          institution_id?: string | null
          paid_amount?: number
          payment_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          academic_year: string
          amount: number
          campus_id: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          institution_id: string | null
          paid_amount: number
          payment_date: string | null
          payment_method: string | null
          receipt_number: string | null
          receipt_url: string | null
          status: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string
          amount: number
          campus_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          institution_id?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          status?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string
          amount?: number
          campus_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          institution_id?: string | null
          paid_amount?: number
          payment_date?: string | null
          payment_method?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          status?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      professor_documents: {
        Row: {
          created_at: string
          diploma_field: string | null
          diploma_level: string | null
          diploma_year: number | null
          doc_type: string
          file_url: string
          grade: string | null
          id: string
          institution_id: string | null
          issuing_institution: string | null
          professor_user_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          diploma_field?: string | null
          diploma_level?: string | null
          diploma_year?: number | null
          doc_type?: string
          file_url: string
          grade?: string | null
          id?: string
          institution_id?: string | null
          issuing_institution?: string | null
          professor_user_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          diploma_field?: string | null
          diploma_level?: string | null
          diploma_year?: number | null
          doc_type?: string
          file_url?: string
          grade?: string | null
          id?: string
          institution_id?: string | null
          issuing_institution?: string | null
          professor_user_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_documents_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_experiences: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          institution_id: string | null
          organization: string | null
          position: string
          professor_user_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          institution_id?: string | null
          organization?: string | null
          position: string
          professor_user_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          institution_id?: string | null
          organization?: string | null
          position?: string
          professor_user_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_experiences_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      professor_history: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          details: Json | null
          id: string
          institution_id: string | null
          professor_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          institution_id?: string | null
          professor_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          details?: Json | null
          id?: string
          institution_id?: string | null
          professor_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professor_history_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_title: string | null
          academic_year: string | null
          address: string | null
          avatar_url: string | null
          birth_place: string | null
          campus_id: string | null
          classe_id: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          email: string | null
          filiere_id: string | null
          first_name: string
          google_email: string | null
          id: string
          institution_id: string | null
          last_name: string
          level: string | null
          nationality: string | null
          oriente_etat: boolean
          parent_contact: string | null
          phone: string | null
          post_bac: boolean
          recovery_email: string | null
          serie: string | null
          sexe: string | null
          signature_url: string | null
          statut_boursier: boolean
          student_number: string | null
          tuteur_email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_title?: string | null
          academic_year?: string | null
          address?: string | null
          avatar_url?: string | null
          birth_place?: string | null
          campus_id?: string | null
          classe_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          filiere_id?: string | null
          first_name?: string
          google_email?: string | null
          id?: string
          institution_id?: string | null
          last_name?: string
          level?: string | null
          nationality?: string | null
          oriente_etat?: boolean
          parent_contact?: string | null
          phone?: string | null
          post_bac?: boolean
          recovery_email?: string | null
          serie?: string | null
          sexe?: string | null
          signature_url?: string | null
          statut_boursier?: boolean
          student_number?: string | null
          tuteur_email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_title?: string | null
          academic_year?: string | null
          address?: string | null
          avatar_url?: string | null
          birth_place?: string | null
          campus_id?: string | null
          classe_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          filiere_id?: string | null
          first_name?: string
          google_email?: string | null
          id?: string
          institution_id?: string | null
          last_name?: string
          level?: string | null
          nationality?: string | null
          oriente_etat?: boolean
          parent_contact?: string | null
          phone?: string | null
          post_bac?: boolean
          recovery_email?: string | null
          serie?: string | null
          sexe?: string | null
          signature_url?: string | null
          statut_boursier?: boolean
          student_number?: string | null
          tuteur_email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rattrapages: {
        Row: {
          academic_year: string | null
          campus_id: string | null
          created_at: string | null
          exam_date: string | null
          filiere_id: string | null
          final_grade: number | null
          id: string
          level: string | null
          location: string | null
          original_average: number | null
          rattrapage_grade: number | null
          status: string | null
          subject_id: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          campus_id?: string | null
          created_at?: string | null
          exam_date?: string | null
          filiere_id?: string | null
          final_grade?: number | null
          id?: string
          level?: string | null
          location?: string | null
          original_average?: number | null
          rattrapage_grade?: number | null
          status?: string | null
          subject_id?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string | null
          campus_id?: string | null
          created_at?: string | null
          exam_date?: string | null
          filiere_id?: string | null
          final_grade?: number | null
          id?: string
          level?: string | null
          location?: string | null
          original_average?: number | null
          rattrapage_grade?: number | null
          status?: string | null
          subject_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rattrapages_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rattrapages_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rattrapages_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      releves_trimestre: {
        Row: {
          academic_year: string
          appreciation: string | null
          classe_id: string
          created_at: string
          id: string
          institution_id: string
          moyenne_annuelle: number | null
          moyenne_trimestre: number | null
          pdf_url: string | null
          qr_token: string
          rang: number | null
          trimestre: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          appreciation?: string | null
          classe_id: string
          created_at?: string
          id?: string
          institution_id: string
          moyenne_annuelle?: number | null
          moyenne_trimestre?: number | null
          pdf_url?: string | null
          qr_token?: string
          rang?: number | null
          trimestre: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          appreciation?: string | null
          classe_id?: string
          created_at?: string
          id?: string
          institution_id?: string
          moyenne_annuelle?: number | null
          moyenne_trimestre?: number | null
          pdf_url?: string | null
          qr_token?: string
          rang?: number | null
          trimestre?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "releves_trimestre_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releves_trimestre_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          institution_id: string
          is_system: boolean
          name: string
          system_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          institution_id: string
          is_system?: boolean
          name: string
          system_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          institution_id?: string
          is_system?: boolean
          name?: string
          system_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_events: {
        Row: {
          academic_year: string | null
          campus_id: string | null
          classe_id: string | null
          classroom_id: string | null
          created_at: string
          created_by: string | null
          end_time: string
          event_type: string
          exam_kind: string | null
          filiere_id: string | null
          id: string
          institution_id: string | null
          level: string | null
          location: string | null
          recurrence_group_id: string | null
          start_time: string
          subject_id: string | null
          title: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          academic_year?: string | null
          campus_id?: string | null
          classe_id?: string | null
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          event_type?: string
          exam_kind?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          level?: string | null
          location?: string | null
          recurrence_group_id?: string | null
          start_time: string
          subject_id?: string | null
          title: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          academic_year?: string | null
          campus_id?: string | null
          classe_id?: string | null
          classroom_id?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          event_type?: string
          exam_kind?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          level?: string | null
          location?: string | null
          recurrence_group_id?: string | null
          start_time?: string
          subject_id?: string | null
          title?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      semester_progress: {
        Row: {
          academic_year: string
          created_at: string
          id: string
          semester_name: string
          status: string
          total_credits: number
          user_id: string
          validated_credits: number
        }
        Insert: {
          academic_year: string
          created_at?: string
          id?: string
          semester_name: string
          status?: string
          total_credits?: number
          user_id: string
          validated_credits?: number
        }
        Update: {
          academic_year?: string
          created_at?: string
          id?: string
          semester_name?: string
          status?: string
          total_credits?: number
          user_id?: string
          validated_credits?: number
        }
        Relationships: []
      }
      soutenance_jury: {
        Row: {
          created_at: string
          grade: number | null
          id: string
          professor_name: string
          role: string
          soutenance_id: string
        }
        Insert: {
          created_at?: string
          grade?: number | null
          id?: string
          professor_name: string
          role?: string
          soutenance_id: string
        }
        Update: {
          created_at?: string
          grade?: number | null
          id?: string
          professor_name?: string
          role?: string
          soutenance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soutenance_jury_soutenance_id_fkey"
            columns: ["soutenance_id"]
            isOneToOne: false
            referencedRelation: "soutenances"
            referencedColumns: ["id"]
          },
        ]
      }
      soutenances: {
        Row: {
          academic_year: string
          created_at: string
          filiere_id: string | null
          final_grade: number | null
          id: string
          institution_id: string | null
          level: string | null
          location: string | null
          pv_url: string | null
          soutenance_date: string
          status: string
          student_id: string
          subject: string | null
          title: string
          video_url: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string
          filiere_id?: string | null
          final_grade?: number | null
          id?: string
          institution_id?: string | null
          level?: string | null
          location?: string | null
          pv_url?: string | null
          soutenance_date: string
          status?: string
          student_id: string
          subject?: string | null
          title: string
          video_url?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string
          filiere_id?: string | null
          final_grade?: number | null
          id?: string
          institution_id?: string | null
          level?: string | null
          location?: string | null
          pv_url?: string | null
          soutenance_date?: string
          status?: string
          student_id?: string
          subject?: string | null
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "soutenances_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soutenances_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      state_reimbursements: {
        Row: {
          academic_year: string
          amount_received: number
          amount_refunded: number | null
          created_at: string
          id: string
          institution_id: string
          notes: string | null
          receipt_number: string | null
          received_at: string | null
          refunded_at: string | null
          retention_amount: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          amount_received?: number
          amount_refunded?: number | null
          created_at?: string
          id?: string
          institution_id: string
          notes?: string | null
          receipt_number?: string | null
          received_at?: string | null
          refunded_at?: string | null
          retention_amount?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          amount_received?: number
          amount_refunded?: number | null
          created_at?: string
          id?: string
          institution_id?: string
          notes?: string | null
          receipt_number?: string | null
          received_at?: string | null
          refunded_at?: string | null
          retention_amount?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string
          id: string
          institution_id: string | null
          media_type: string
          media_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          institution_id?: string | null
          media_type: string
          media_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          institution_id?: string | null
          media_type?: string
          media_url?: string
          user_id?: string
        }
        Relationships: []
      }
      story_likes: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_replies: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          story_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          story_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_replies_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          badge_description: string | null
          badge_icon: string | null
          badge_name: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_description?: string | null
          badge_icon?: string | null
          badge_name: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_description?: string | null
          badge_icon?: string | null
          badge_name?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      student_documents: {
        Row: {
          academic_year: string | null
          campus_id: string | null
          created_at: string
          doc_type: string
          file_size: number | null
          file_url: string
          id: string
          institution_id: string | null
          mime_type: string | null
          title: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          academic_year?: string | null
          campus_id?: string | null
          created_at?: string
          doc_type?: string
          file_size?: number | null
          file_url: string
          id?: string
          institution_id?: string | null
          mime_type?: string | null
          title: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          academic_year?: string | null
          campus_id?: string | null
          created_at?: string
          doc_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          institution_id?: string | null
          mime_type?: string | null
          title?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      student_points: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          points: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          points?: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      student_year_history: {
        Row: {
          academic_year: string
          created_at: string
          credits_acquired: number
          credits_total: number
          decision: string
          filiere_id: string | null
          id: string
          level: string
          status: string
          ue_to_retake_ids: string[] | null
          ue_validated_ids: string[] | null
          user_id: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          credits_acquired?: number
          credits_total?: number
          decision?: string
          filiere_id?: string | null
          id?: string
          level: string
          status?: string
          ue_to_retake_ids?: string[] | null
          ue_validated_ids?: string[] | null
          user_id: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          credits_acquired?: number
          credits_total?: number
          decision?: string
          filiere_id?: string | null
          id?: string
          level?: string
          status?: string
          ue_to_retake_ids?: string[] | null
          ue_validated_ids?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_year_history_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
        ]
      }
      student_years: {
        Row: {
          academic_year: string
          block_reason: string | null
          blocked_at: string | null
          can_access: boolean
          created_at: string
          debt_cancelled: boolean
          debt_frozen: boolean
          enrollment_status: string
          exit_date: string | null
          exit_decided_by: string | null
          exit_type: string | null
          filiere_id: string | null
          id: string
          institution_id: string
          niveau: string
          status: string
          unblocked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_year: string
          block_reason?: string | null
          blocked_at?: string | null
          can_access?: boolean
          created_at?: string
          debt_cancelled?: boolean
          debt_frozen?: boolean
          enrollment_status?: string
          exit_date?: string | null
          exit_decided_by?: string | null
          exit_type?: string | null
          filiere_id?: string | null
          id?: string
          institution_id: string
          niveau: string
          status?: string
          unblocked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_year?: string
          block_reason?: string | null
          blocked_at?: string | null
          can_access?: boolean
          created_at?: string
          debt_cancelled?: boolean
          debt_frozen?: boolean
          enrollment_status?: string
          exit_date?: string | null
          exit_decided_by?: string | null
          exit_type?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string
          niveau?: string
          status?: string
          unblocked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          filiere_id: string | null
          id: string
          institution_id: string | null
          matricule: string
          niveau: string
          nom: string
          oriente_etat: boolean
          prenom: string
          statut_boursier: boolean
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          matricule: string
          niveau: string
          nom: string
          oriente_etat?: boolean
          prenom: string
          statut_boursier?: boolean
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          matricule?: string
          niveau?: string
          nom?: string
          oriente_etat?: boolean
          prenom?: string
          statut_boursier?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "students_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_classes: {
        Row: {
          classe_id: string
          coefficient: number
          created_at: string
          id: string
          institution_id: string
          professor_name: string | null
          professor_user_id: string | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          classe_id: string
          coefficient?: number
          created_at?: string
          id?: string
          institution_id: string
          professor_name?: string | null
          professor_user_id?: string | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          classe_id?: string
          coefficient?: number
          created_at?: string
          id?: string
          institution_id?: string
          professor_name?: string | null
          professor_user_id?: string | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_classes_classe_id_fkey"
            columns: ["classe_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_classes_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_classes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          professor_user_id: string | null
          academic_year: string
          campus_id: string | null
          code: string | null
          coefficient: number
          created_at: string
          created_by: string | null
          credits: number
          description: string | null
          duree_cours_minutes: number
          evaluation_mode: string
          filiere_id: string | null
          id: string
          institution_id: string | null
          level: string
          levels: string[] | null
          name: string
          professor: string | null
          pv_academic_year: string | null
          pv_semester: string | null
          pv_uploaded_at: string | null
          pv_uploaded_by: string | null
          pv_url: string | null
          quota_absence_hours: number
          semester: string
          syllabus: string | null
          updated_by: string | null
          volume_horaire_cm: number | null
          volume_horaire_td: number | null
          volume_horaire_tp: number | null
        }
        Insert: {
          professor_user_id?: string | null
          academic_year?: string
          campus_id?: string | null
          code?: string | null
          coefficient?: number
          created_at?: string
          created_by?: string | null
          credits?: number
          description?: string | null
          duree_cours_minutes?: number
          evaluation_mode?: string
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          level?: string
          levels?: string[] | null
          name: string
          professor?: string | null
          pv_academic_year?: string | null
          pv_semester?: string | null
          pv_uploaded_at?: string | null
          pv_uploaded_by?: string | null
          pv_url?: string | null
          quota_absence_hours?: number
          semester?: string
          syllabus?: string | null
          updated_by?: string | null
          volume_horaire_cm?: number | null
          volume_horaire_td?: number | null
          volume_horaire_tp?: number | null
        }
        Update: {
          professor_user_id?: string | null
          academic_year?: string
          campus_id?: string | null
          code?: string | null
          coefficient?: number
          created_at?: string
          created_by?: string | null
          credits?: number
          description?: string | null
          duree_cours_minutes?: number
          evaluation_mode?: string
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          level?: string
          levels?: string[] | null
          name?: string
          professor?: string | null
          pv_academic_year?: string | null
          pv_semester?: string | null
          pv_uploaded_at?: string | null
          pv_uploaded_by?: string | null
          pv_url?: string | null
          quota_absence_hours?: number
          semester?: string
          syllabus?: string | null
          updated_by?: string | null
          volume_horaire_cm?: number | null
          volume_horaire_td?: number | null
          volume_horaire_tp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "subjects_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          academic_scope: string
          allowed_modules: string[]
          created_at: string
          created_by: string | null
          custom_role_label: string | null
          email: string
          first_name: string
          id: string
          institution_id: string
          is_principal: boolean
          last_name: string
          phone: string | null
          team_role: Database["public"]["Enums"]["team_role_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_scope?: string
          allowed_modules?: string[]
          created_at?: string
          created_by?: string | null
          custom_role_label?: string | null
          email: string
          first_name: string
          id?: string
          institution_id: string
          is_principal?: boolean
          last_name: string
          phone?: string | null
          team_role?: Database["public"]["Enums"]["team_role_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_scope?: string
          allowed_modules?: string[]
          created_at?: string
          created_by?: string | null
          custom_role_label?: string | null
          email?: string
          first_name?: string
          id?: string
          institution_id?: string
          is_principal?: boolean
          last_name?: string
          phone?: string | null
          team_role?: Database["public"]["Enums"]["team_role_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trimestre_closures: {
        Row: {
          academic_year: string
          closed_at: string
          closed_by: string | null
          created_at: string
          id: string
          institution_id: string
          trimestre: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          id?: string
          institution_id: string
          trimestre: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          id?: string
          institution_id?: string
          trimestre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trimestre_closures_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      ue_matieres: {
        Row: {
          created_at: string
          id: string
          subject_id: string
          ue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_id: string
          ue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_id?: string
          ue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ue_matieres_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ue_matieres_ue_id_fkey"
            columns: ["ue_id"]
            isOneToOne: false
            referencedRelation: "ues"
            referencedColumns: ["id"]
          },
        ]
      }
      ues: {
        Row: {
          academic_year: string
          code: string | null
          created_at: string
          created_by: string | null
          credits: number
          description: string | null
          filiere_id: string | null
          id: string
          institution_id: string
          niveau: string
          nom: string
          semester: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          description?: string | null
          filiere_id?: string | null
          id?: string
          institution_id: string
          niveau: string
          nom: string
          semester?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          credits?: number
          description?: string | null
          filiere_id?: string | null
          id?: string
          institution_id?: string
          niveau?: string
          nom?: string
          semester?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles_v2: {
        Row: {
          created_at: string
          id: string
          institution_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_id: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_v2_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_v2_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_conferences: {
        Row: {
          created_at: string
          filiere_id: string | null
          id: string
          institution_id: string | null
          level: string | null
          meeting_url: string
          professor_id: string
          scheduled_at: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          level?: string | null
          meeting_url: string
          professor_id: string
          scheduled_at?: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          filiere_id?: string | null
          id?: string
          institution_id?: string | null
          level?: string | null
          meeting_url?: string
          professor_id?: string
          scheduled_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_conferences_filiere_id_fkey"
            columns: ["filiere_id"]
            isOneToOne: false
            referencedRelation: "filieres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_conferences_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reject_preregistration: {
        Args: { _request_id: string; _reason: string }
        Returns: undefined
      }
      manage_institution_subscription: {
        Args: { _institution_id: string; _action: string; _patch?: Json }
        Returns: Json
      }
      admin_global_search: {
        Args: { _query: string }
        Returns: {
          avatar_url: string
          email: string
          filiere_id: string
          first_name: string
          kind: string
          last_name: string
          level: string
          phone: string
          student_number: string
          user_id: string
        }[]
      }
      apply_annual_decision_scolaire: {
        Args: { _academic_year: string; _institution_id: string }
        Returns: number
      }
      backfill_student_years: {
        Args: { _academic_year: string; _institution_id: string }
        Returns: number
      }
      build_student_parcours: { Args: { _student_id: string }; Returns: Json }
      can_review_student_dossier: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_audit: {
        Args: { _categorie?: string; _user_id: string }
        Returns: boolean
      }
      compute_scolaire_debt: {
        Args: {
          _cycle: string
          _institution_id: string
          _niveau: string
          _oriente: boolean
          _serie: string
        }
        Returns: {
          amount: number
          description: string
          fee_kind: string
        }[]
      }
      exclude_student: {
        Args: {
          _academic_year?: string
          _exit_type?: string
          _reason: string
          _user_id: string
        }
        Returns: Json
      }
      freeze_student_debt: {
        Args: {
          _academic_year?: string
          _exit_type?: string
          _reason: string
          _user_id: string
        }
        Returns: Json
      }
      generate_exam_blanc_candidats: {
        Args: { _academic_year: string; _institution_id: string }
        Returns: number
      }
      get_active_students_for_subject: {
        Args: { _academic_year: string; _subject_id: string }
        Returns: {
          first_name: string
          last_name: string
          student_number: string
          user_id: string
        }[]
      }
      get_application_dossier: {
        Args: { _application_id: string }
        Returns: Json
      }
      get_institution_by_domain: {
        Args: { _domain: string }
        Returns: {
          accent_color: string
          cover_image_url: string
          id: string
          institution_type: string
          is_active: boolean
          login_button_color: string
          login_layout: string
          login_overlay: number
          login_subtitle: string
          login_title: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          slogan: string
          slug: string
        }[]
      }
      get_institution_by_slug: {
        Args: { _slug: string }
        Returns: {
          accent_color: string
          cover_image_url: string
          id: string
          institution_type: string
          is_active: boolean
          login_button_color: string
          login_layout: string
          login_overlay: number
          login_subtitle: string
          login_title: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          slogan: string
          slug: string
        }[]
      }
      get_my_parcours: { Args: never; Returns: Json }
      get_parent_student_ids: {
        Args: { _parent_user_id: string }
        Returns: {
          student_user_id: string
        }[]
      }
      get_student_access: { Args: { _user_id: string }; Returns: Json }
      get_trimestre_class_stats: {
        Args: {
          _academic_year: string
          _classe_id: string
          _trimestre: string
          _user_id: string
        }
        Returns: {
          effectif: number
          moyenne_classe: number
          moyenne_eleve: number
          rang: number
        }[]
      }
      get_user_allowed_modules: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_campus_id: { Args: { _user_id: string }; Returns: string }
      get_user_institution_id: { Args: { _user_id: string }; Returns: string }
      get_user_permissions: { Args: { _user_id: string }; Returns: string[] }
      has_new_year_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_application_reviewer: {
        Args: { _application_id: string; _user_id: string }
        Returns: boolean
      }
      is_bde_member: { Args: { _user_id: string }; Returns: boolean }
      is_filiere_closed: {
        Args: { _academic_year: string; _filiere_id: string }
        Returns: boolean
      }
      is_institution_owner_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_parent: { Args: { _user_id: string }; Returns: boolean }
      is_team_principal: { Args: { _user_id: string }; Returns: boolean }
      is_trimestre_closed: {
        Args: {
          _academic_year: string
          _institution_id: string
          _trimestre: string
        }
        Returns: boolean
      }
      list_open_programs: {
        Args: never
        Returns: {
          admission_contact: string
          admission_info: string
          admission_level: string
          city: string
          cycle: string
          filiere_description: string
          filiere_id: string
          filiere_name: string
          institution_id: string
          institution_name: string
          logo_url: string
        }[]
      }
      mark_non_reinscribed_students: { Args: never; Returns: number }
      professor_set_pv: {
        Args: {
          _academic_year?: string
          _pv_url: string
          _semester?: number
          _subject_id: string
        }
        Returns: undefined
      }
      professor_teaches_matiere: {
        Args: { _classe_id: string; _matiere: string; _user_id: string }
        Returns: boolean
      }
      purge_old_chatbot_messages: { Args: never; Returns: number }
      reactivate_student: { Args: { _student_year_id: string }; Returns: Json }
      slugify: { Args: { _input: string }; Returns: string }
      storage_path_owner_institution: {
        Args: { _name: string }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_can_access_campus: {
        Args: { _campus_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_module: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      verify_access_key: {
        Args: { _key: string }
        Returns: {
          accent_color: string
          cover_image_url: string
          id: string
          institution_type: string
          is_active: boolean
          login_button_color: string
          login_layout: string
          login_overlay: number
          login_subtitle: string
          login_title: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          slogan: string
          slug: string
        }[]
      }
      verify_bulletin: {
        Args: { _token: string }
        Returns: {
          academic_year: string
          annual_average: number
          avatar_url: string
          credits_acquired: number
          credits_total: number
          date_of_birth: string
          decision: string
          filiere_name: string
          first_name: string
          institution_logo: string
          institution_name: string
          institution_primary_color: string
          institution_slogan: string
          last_name: string
          level: string
          sem1_average: number
          sem1_label: string
          sem2_average: number
          sem2_label: string
          semester: string
          semester_average: number
          student_number: string
          user_id: string
        }[]
      }
      verify_institution_access_key: {
        Args: { _key: string; _slug: string }
        Returns: {
          accent_color: string
          cover_image_url: string
          id: string
          institution_type: string
          is_active: boolean
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          slogan: string
          slug: string
        }[]
      }
      verify_payment_by_id: {
        Args: { _id: string }
        Returns: {
          amount: number
          description: string
          filiere_name: string
          id: string
          institution_logo: string
          institution_name: string
          paid_amount: number
          payment_date: string
          payment_method: string
          receipt_number: string
          status: string
          student_first_name: string
          student_last_name: string
          student_level: string
          student_number: string
        }[]
      }
      verify_payment_by_receipt: {
        Args: { _receipt_number: string }
        Returns: {
          amount: number
          description: string
          filiere_name: string
          id: string
          institution_logo: string
          institution_name: string
          paid_amount: number
          payment_date: string
          payment_method: string
          receipt_number: string
          status: string
          student_first_name: string
          student_last_name: string
          student_level: string
          student_number: string
        }[]
      }
      verify_releve_lycee: {
        Args: { _token: string }
        Returns: {
          academic_year: string
          appreciation: string
          classe_cycle: string
          classe_niveau: string
          classe_nom: string
          classe_serie: string
          decision: string
          effectif: number
          institution_logo: string
          institution_name: string
          matieres: Json
          mention: string
          moyenne_annuelle: number
          moyenne_trimestre: number
          rang: number
          releve_id: string
          student_avatar: string
          student_first_name: string
          student_last_name: string
          student_number: string
          trimestre: string
        }[]
      }
      verify_student_document: {
        Args: { _id: string }
        Returns: {
          academic_year: string
          created_at: string
          doc_type: string
          file_url: string
          filiere_name: string
          id: string
          institution_logo: string
          institution_name: string
          student_first_name: string
          student_last_name: string
          student_level: string
          student_number: string
          title: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "professor"
        | "super_admin"
        | "parent"
      team_role_type:
        | "admin_principal"
        | "responsable_pedagogique"
        | "responsable_financier"
        | "responsable_scolarite"
        | "role_personnalise"
        | "responsable_notes"
        | "responsable_presences"
        | "secretaire"
        | "assistant_pedagogique"
        | "responsable_vie_etudiante"
        | "professeur"
        | "directeur"
        | "responsable_cycle"
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
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "professor",
        "super_admin",
        "parent",
      ],
      team_role_type: [
        "admin_principal",
        "responsable_pedagogique",
        "responsable_financier",
        "responsable_scolarite",
        "role_personnalise",
        "responsable_notes",
        "responsable_presences",
        "secretaire",
        "assistant_pedagogique",
        "responsable_vie_etudiante",
        "professeur",
        "directeur",
        "responsable_cycle",
      ],
    },
  },
} as const
