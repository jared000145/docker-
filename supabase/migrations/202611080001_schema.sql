-- Reconstructed baseline. See docs/BACKEND.md for assumptions.
create type public."app_role" as enum ('admin', 'moderator', 'user', 'professor', 'super_admin', 'parent');
create type public."team_role_type" as enum ('admin_principal', 'responsable_pedagogique', 'responsable_financier', 'responsable_scolarite', 'role_personnalise', 'responsable_notes', 'responsable_presences', 'secretaire', 'assistant_pedagogique', 'responsable_vie_etudiante', 'professeur', 'directeur', 'responsable_cycle');

create table public."admin_chatbot_messages" (
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "role" text not null,
  "user_id" uuid not null
);

create table public."application_messages" (
  "application_id" uuid not null,
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "sender_id" uuid not null,
  "sender_role" text default '' not null
);

create table public."applications" (
  "created_at" timestamptz default now() not null,
  "decided_at" text,
  "decided_by" text,
  "decision_note" text,
  "dossier" jsonb default '{}'::jsonb not null,
  "dossier_version" numeric default 0 not null,
  "id" uuid default gen_random_uuid() primary key,
  "motivation" text,
  "origin_institution_id" uuid,
  "program_id" uuid,
  "status" text default '' not null,
  "target_filiere_id" uuid,
  "target_institution_id" uuid not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."attendance" (
  "academic_year" text,
  "campus_id" uuid,
  "created_at" timestamptz default now(),
  "date" text default '' not null,
  "duration_hours" numeric,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "justificatif_reason" text,
  "justificatif_reviewed_at" text,
  "justificatif_reviewed_by" text,
  "justificatif_status" text,
  "justificatif_submitted_at" text,
  "justificatif_url" text,
  "marked_by" text,
  "schedule_event_id" uuid,
  "session_id" uuid,
  "status" text default '' not null,
  "subject_id" uuid,
  "user_id" uuid not null
);

create table public."attendance_sessions" (
  "academic_year" text not null,
  "campus_id" uuid,
  "created_at" timestamptz default now() not null,
  "duration_hours" numeric default 0 not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "notes" text,
  "professor_id" uuid not null,
  "session_date" text default '' not null,
  "session_time" text default '' not null,
  "subject_id" uuid not null
);

create table public."audit_logs" (
  "action" text not null,
  "categorie" text not null,
  "created_at" timestamptz default now() not null,
  "description" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "ip_address" text,
  "module" text,
  "new_value" jsonb,
  "old_value" jsonb,
  "record_id" uuid,
  "table_name" text,
  "user_email" text,
  "user_id" uuid,
  "user_role" text
);

create table public."bac_results" (
  "academic_year" text,
  "created_at" timestamptz default now() not null,
  "file_name" text,
  "file_url" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "mention" text,
  "moyenne" numeric,
  "serie" text,
  "source" text default '' not null,
  "status" text default '' not null,
  "subject_scores" jsonb default '{}'::jsonb not null,
  "updated_at" timestamptz default now() not null,
  "uploaded_by" text,
  "user_id" uuid not null
);

create table public."backup_logs" (
  "created_at" timestamptz default now() not null,
  "details" jsonb,
  "drive_file_id" uuid,
  "drive_file_name" text,
  "establishment_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "restore_type" text default '' not null,
  "restored_at" text default '' not null,
  "restored_by" text,
  "status" text default '' not null
);

create table public."backups_history" (
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "file_name" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institutions_count" numeric default 0 not null,
  "size_bytes" numeric default 0 not null,
  "storage_path" text not null
);

create table public."bde_members" (
  "academic_year" text not null,
  "bio" text,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "photo_url" text,
  "role" text default '' not null,
  "title" text,
  "user_id" uuid not null
);

create table public."bde_posts" (
  "author_id" uuid not null,
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "image_url" text,
  "title" text
);

create table public."campus_staff" (
  "campus_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "role" text not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."campuses" (
  "address" text,
  "city" text,
  "created_at" timestamptz default now() not null,
  "cycle" text default '' not null,
  "email" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "is_active" boolean default true not null,
  "is_main" boolean default false not null,
  "name" text not null,
  "phone" text,
  "updated_at" timestamptz default now() not null
);

create table public."class_teachers" (
  "academic_year" text not null,
  "classe_id" uuid not null,
  "coefficient" numeric default 0 not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "matiere" text not null,
  "professor_user_id" uuid not null
);

create table public."classes" (
  "academic_year" text not null,
  "created_at" timestamptz default now() not null,
  "cycle" text not null,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "niveau" text not null,
  "nom" text not null,
  "serie" text,
  "updated_at" timestamptz default now() not null
);

create table public."classrooms" (
  "building" text,
  "campus_id" uuid,
  "capacity" numeric,
  "created_at" timestamptz default now(),
  "created_by" text,
  "equipment" text,
  "floor" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "is_available" boolean,
  "name" text not null,
  "updated_by" text
);

create table public."community_bookmarks" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "post_id" uuid not null,
  "user_id" uuid not null
);

create table public."community_comment_likes" (
  "comment_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "user_id" uuid not null
);

create table public."community_comments" (
  "author_id" uuid not null,
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "post_id" uuid not null
);

create table public."community_likes" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "post_id" uuid not null,
  "user_id" uuid not null
);

create table public."community_posts" (
  "author_id" uuid not null,
  "club_name" text,
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "image_url" text,
  "institution_id" uuid,
  "post_type" text default '' not null,
  "video_url" text
);

create table public."community_reactions" (
  "created_at" timestamptz default now() not null,
  "emoji" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "post_id" uuid not null,
  "user_id" uuid not null
);

create table public."course_documents" (
  "created_at" timestamptz default now() not null,
  "doc_type" text,
  "file_url" text,
  "id" uuid default gen_random_uuid() primary key,
  "subject_id" uuid not null,
  "title" text not null
);

create table public."course_validation" (
  "academic_year" text not null,
  "created_at" timestamptz default now() not null,
  "filiere_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "is_validated" boolean default false not null,
  "notes" text,
  "subject_id" uuid not null,
  "updated_at" timestamptz default now() not null,
  "validated_at" text default '' not null,
  "validated_by" text
);

create table public."cron_secrets" (
  "created_at" timestamptz default now() not null,
  "name" text not null,
  "value" text not null
);

create table public."director_signatures" (
  "activated_at" text,
  "created_at" timestamptz default now() not null,
  "director_name" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "is_active" boolean default true not null,
  "role_scope" text default '' not null,
  "signature_url" text,
  "stamp_url" text,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."document_validations" (
  "academic_year" text,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "cycle_rejection_reason" text,
  "cycle_signature_id" uuid,
  "cycle_signed_at" text,
  "cycle_signed_by" text,
  "cycle_status" text default '' not null,
  "document_ref" text,
  "document_type" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "payload" jsonb default '{}'::jsonb not null,
  "pdf_url" text,
  "pedagogique_rejection_reason" text,
  "pedagogique_signature_id" uuid,
  "pedagogique_signed_at" text,
  "pedagogique_signed_by" text,
  "pedagogique_status" text default '' not null,
  "rejection_reason" text,
  "signature_id" uuid,
  "status" text default '' not null,
  "student_user_id" uuid,
  "title" text,
  "updated_at" timestamptz default now() not null,
  "validated_at" text,
  "validated_by" text
);

create table public."election_candidates" (
  "created_at" timestamptz default now() not null,
  "election_id" uuid not null,
  "group_logo_url" text,
  "group_name" text,
  "id" uuid default gen_random_uuid() primary key,
  "photo_url" text,
  "program" text,
  "user_id" uuid not null,
  "video_url" text
);

create table public."election_group_members" (
  "candidate_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "member_name" text not null,
  "member_role" text not null,
  "photo_url" text,
  "user_id" uuid not null
);

create table public."election_votes" (
  "candidate_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "election_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "voter_id" uuid not null
);

create table public."elections" (
  "academic_year" text not null,
  "created_at" timestamptz default now() not null,
  "description" text,
  "end_date" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "start_date" text not null,
  "status" text default '' not null,
  "title" text not null
);

create table public."email_send_log" (
  "created_at" timestamptz default now() not null,
  "error_message" text,
  "id" uuid default gen_random_uuid() primary key,
  "message_id" uuid,
  "metadata" jsonb,
  "recipient_email" text not null,
  "status" text not null,
  "template_name" text not null
);

create table public."email_send_state" (
  "auth_email_ttl_minutes" numeric default 0 not null,
  "batch_size" numeric default 0 not null,
  "id" numeric default 0 primary key,
  "retry_after_until" text,
  "send_delay_ms" numeric default 0 not null,
  "transactional_email_ttl_minutes" numeric default 0 not null,
  "updated_at" timestamptz default now() not null
);

create table public."email_unsubscribe_tokens" (
  "created_at" timestamptz default now() not null,
  "email" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "token" text not null,
  "used_at" text
);

create table public."enrollments" (
  "campus_id" uuid,
  "enrolled_at" text default '' not null,
  "id" uuid default gen_random_uuid() primary key,
  "progress" numeric default 0 not null,
  "subject_id" uuid not null,
  "user_id" uuid not null
);

create table public."event_comments" (
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "event_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "user_id" uuid not null
);

create table public."event_likes" (
  "created_at" timestamptz default now() not null,
  "event_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "user_id" uuid not null
);

create table public."event_media" (
  "created_at" timestamptz default now() not null,
  "event_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "media_type" text default '' not null,
  "title" text,
  "url" text not null
);

create table public."event_registrations" (
  "created_at" timestamptz default now() not null,
  "event_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "user_id" uuid not null
);

create table public."events" (
  "created_at" timestamptz default now() not null,
  "created_by" text not null,
  "description" text,
  "end_date" text,
  "event_date" text not null,
  "event_type" text default '' not null,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "image_url" text,
  "institution_id" uuid,
  "level" text,
  "location" text,
  "title" text not null,
  "updated_by" text,
  "video_url" text
);

create table public."exam_blanc_candidats" (
  "academic_year" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "numero_candidat" text not null,
  "type" text not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."fee_types" (
  "amount" numeric default 0 not null,
  "created_at" timestamptz default now() not null,
  "cycle_scope" text default '' not null,
  "fee_kind" text default '' not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "is_active" boolean default true not null,
  "label" text not null,
  "monthly_count" numeric default 0 not null,
  "niveau" text,
  "orientation_scope" text default '' not null,
  "serie" text,
  "unlocks_new_year" boolean default false not null,
  "updated_at" timestamptz default now() not null,
  "validity_years" numeric default 0 not null
);

create table public."filiere_closures" (
  "academic_year" text not null,
  "closed_at" text default '' not null,
  "closed_by" text,
  "filiere_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null
);

create table public."filieres" (
  "admission_info" text,
  "admission_level" text,
  "campus_id" uuid,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "description" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "name" text not null,
  "open_for_applications" boolean default false not null,
  "updated_by" text
);

create table public."google_link_requests" (
  "created_at" timestamptz default now() not null,
  "expires_at" timestamptz not null,
  "google_email" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "state_hash" text not null,
  "used_at" text,
  "user_id" uuid not null
);

create table public."grades" (
  "academic_year" text default '' not null,
  "approved_at" text,
  "approved_by_student" boolean default false not null,
  "average" numeric,
  "campus_id" uuid,
  "cc_grade" numeric,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "exam_grade" numeric,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "is_locked" boolean default false not null,
  "semester" text default '' not null,
  "student_signature_url" text,
  "subject_id" uuid not null,
  "submission_batch_id" uuid,
  "submission_status" text default '' not null,
  "submitted_to_admin_at" text,
  "updated_at" timestamptz default now() not null,
  "updated_by" text,
  "user_id" uuid not null
);

create table public."grades_trimestre" (
  "academic_year" text not null,
  "bareme1" numeric default 0 not null,
  "bareme2" numeric default 0 not null,
  "bareme3" numeric default 0 not null,
  "classe_id" uuid not null,
  "coefficient" numeric default 0 not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "matiere" text not null,
  "note1" numeric,
  "note2" numeric,
  "note3" numeric,
  "professor_user_id" uuid,
  "trimestre" text not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."imports_history" (
  "academic_year" text,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "created_count" numeric default 0 not null,
  "errors_count" numeric default 0 not null,
  "errors_sample" jsonb,
  "file_name" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "institution_name" text,
  "module" text not null,
  "rows_count" numeric default 0 not null,
  "updated_count" numeric default 0 not null
);

create table public."institution_preregistrations" (
  "address" text,
  "agrement_url" text,
  "created_at" timestamptz default now() not null,
  "created_institution_id" uuid,
  "custom_domain" text,
  "cycle" text,
  "desired_slug" text,
  "director_id_url" text,
  "director_name" text not null,
  "domain_mode" text default '' not null,
  "enabled_cycles" text[],
  "id" uuid default gen_random_uuid() primary key,
  "institution_name" text not null,
  "institution_type" text,
  "logo_url" text,
  "nif_url" text,
  "notes" text,
  "official_email" text not null,
  "phone" text,
  "rccm_url" text,
  "rejection_reason" text,
  "reviewed_at" text,
  "reviewed_by" text,
  "status" text default '' not null,
  "updated_at" timestamptz default now() not null
);

create table public."institution_subscriptions" (
  "amount" numeric default 0 not null,
  "billing_cycle" text default '' not null,
  "created_at" timestamptz default now() not null,
  "currency" text default '' not null,
  "ends_at" text default '' not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "notes" text,
  "plan_name" text default '' not null,
  "starts_at" text default '' not null,
  "status" text default '' not null,
  "updated_at" timestamptz default now() not null
);

create table public."institutions" (
  "academic_year" text,
  "accent_color" text,
  "accepts_applications" boolean default true not null,
  "access_key" text,
  "address" text,
  "admission_contact" text,
  "bde_logo_url" text,
  "code" text,
  "cover_image_url" text,
  "created_at" timestamptz default now(),
  "created_by" text,
  "credits_max_passage" numeric default 0 not null,
  "credits_min_passage" numeric default 0 not null,
  "credits_total_annee" numeric default 0 not null,
  "custom_domain" text,
  "cycle" text default '' not null,
  "description" text,
  "domain" text,
  "email" text,
  "enabled_cycles" text[] default '{}' not null,
  "end_of_year_completed" boolean,
  "exam_blanc_enabled" boolean default false not null,
  "exam_blanc_types" text[] default '{}' not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_type" text default '' not null,
  "is_active" boolean,
  "is_multi_campus" boolean default false not null,
  "login_button_color" text,
  "login_layout" text,
  "login_overlay" numeric,
  "login_subtitle" text,
  "login_title" text,
  "logo_url" text,
  "name" text not null,
  "non_reinscription_days" numeric default 0 not null,
  "pass_threshold" numeric default 0 not null,
  "payment_config" jsonb,
  "phone" text,
  "primary_color" text,
  "quota_absence_hours_annuel" numeric default 0 not null,
  "secondary_color" text,
  "slogan" text,
  "slug" text,
  "trimestre_third_note" boolean default false not null
);

create table public."library_annotations" (
  "book_id" uuid not null,
  "color" text,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "page" numeric not null,
  "position" jsonb,
  "text" text,
  "type" text not null,
  "user_id" uuid not null
);

create table public."library_bookmarks" (
  "book_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "label" text,
  "page" numeric not null,
  "user_id" uuid not null
);

create table public."library_books" (
  "author" text,
  "category" text,
  "cover_image" text,
  "cover_url" text,
  "created_at" timestamptz default now(),
  "description" text,
  "download_allowed" boolean default false not null,
  "external_id" uuid,
  "external_link" text,
  "file_url" text,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "isbn" text,
  "niveau" text,
  "source" text default '' not null,
  "title" text not null,
  "updated_at" timestamptz default now() not null,
  "uploaded_by" text,
  "visibility" text default '' not null
);

create table public."library_favorites" (
  "book_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "user_id" uuid not null
);

create table public."library_reading_history" (
  "book_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "last_page" numeric default 0 not null,
  "last_read_at" text default '' not null,
  "user_id" uuid not null
);

create table public."library_settings" (
  "api_key" text,
  "api_url" text,
  "auto_sync_enabled" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "detected_auth_type" text,
  "detected_data_path" text,
  "detected_response_format" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "last_sync" text,
  "mode_detected" text,
  "updated_at" timestamptz default now() not null
);

create table public."library_sync_logs" (
  "books_imported" numeric default 0 not null,
  "error_details" jsonb,
  "errors_count" numeric default 0 not null,
  "finished_at" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "mode_used" text,
  "started_at" text default '' not null,
  "status" text default '' not null
);

create table public."message_group_members" (
  "added_at" text default '' not null,
  "group_id" uuid not null,
  "id" uuid default gen_random_uuid() primary key,
  "user_id" uuid not null
);

create table public."message_groups" (
  "academic_year" text,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "filiere_id" uuid,
  "group_type" text default '' not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "level" text,
  "name" text not null
);

create table public."messages" (
  "audio_url" text,
  "body" text not null,
  "created_at" timestamptz default now() not null,
  "deleted_for" text[] default '{}' not null,
  "deleted_for_everyone" boolean default false not null,
  "delivered_at" text,
  "edited_at" text,
  "id" uuid default gen_random_uuid() primary key,
  "image_url" text,
  "institution_id" uuid,
  "is_read" boolean default false not null,
  "read_at" timestamptz,
  "recipient_id" uuid not null,
  "sender_id" uuid not null,
  "subject" text default '' not null,
  "view_once" boolean default false not null,
  "viewed_at" text
);

create table public."notification_settings" (
  "allow_email" boolean default false not null,
  "allow_push" boolean default false not null,
  "allow_sms" boolean default false not null,
  "allow_sound" boolean default false not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."notifications" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "is_read" boolean default false not null,
  "link" text,
  "message" text not null,
  "read_at" timestamptz,
  "title" text not null,
  "type" text default '' not null,
  "user_id" uuid not null
);

create table public."orientation_profiles" (
  "created_at" timestamptz default now() not null,
  "generated_at" text default '' not null,
  "id" uuid default gen_random_uuid() primary key,
  "strengths" jsonb default '{}'::jsonb not null,
  "suggestions" jsonb default '{}'::jsonb not null,
  "summary" text,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null,
  "weaknesses" jsonb default '{}'::jsonb not null
);

create table public."parametres_etablissement" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "mode_calcul_moyenne_semestre" text default '' not null,
  "mode_validation_ue" text default '' not null,
  "note_min_validation" numeric default 0 not null,
  "quota_absence_hours" numeric default 0 not null,
  "updated_at" timestamptz default now() not null
);

create table public."parent_students" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "parent_id" uuid not null,
  "relation" text,
  "student_user_id" uuid not null
);

create table public."parents" (
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "email" text not null,
  "full_name" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "phone" text,
  "user_id" uuid not null
);

create table public."partner_programs" (
  "city" text,
  "created_at" timestamptz default now() not null,
  "description" text,
  "domain" text not null,
  "duration_years" numeric,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "is_active" boolean default true not null,
  "level" text default '' not null,
  "min_average" numeric,
  "name" text not null,
  "seats" numeric,
  "series_accepted" text[] default '{}' not null,
  "tuition" numeric,
  "updated_at" timestamptz default now() not null
);

create table public."payment_installments" (
  "amount" numeric not null,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "due_date" text,
  "id" uuid default gen_random_uuid() primary key,
  "installment_number" numeric not null,
  "institution_id" uuid,
  "paid_amount" numeric default 0 not null,
  "payment_id" uuid not null,
  "status" text default '' not null,
  "updated_at" timestamptz default now() not null,
  "updated_by" text
);

create table public."payments" (
  "academic_year" text default '' not null,
  "amount" numeric not null,
  "campus_id" uuid,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "description" text not null,
  "due_date" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "paid_amount" numeric default 0 not null,
  "payment_date" text,
  "payment_method" text,
  "receipt_number" text,
  "receipt_url" text,
  "status" text default '' not null,
  "updated_by" text,
  "user_id" uuid not null
);

create table public."permissions" (
  "category" text default '' not null,
  "created_at" timestamptz default now() not null,
  "description" text,
  "id" uuid default gen_random_uuid() primary key,
  "key" text not null,
  "label" text not null
);

create table public."professor_documents" (
  "created_at" timestamptz default now() not null,
  "diploma_field" text,
  "diploma_level" text,
  "diploma_year" numeric,
  "doc_type" text default '' not null,
  "file_url" text not null,
  "grade" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "issuing_institution" text,
  "professor_user_id" uuid not null,
  "title" text not null,
  "updated_at" timestamptz default now() not null
);

create table public."professor_experiences" (
  "created_at" timestamptz default now() not null,
  "description" text,
  "end_date" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "organization" text,
  "position" text not null,
  "professor_user_id" uuid not null,
  "start_date" text,
  "updated_at" timestamptz default now() not null
);

create table public."professor_history" (
  "action" text not null,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "details" jsonb,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "professor_user_id" uuid not null
);

create table public."profiles" (
  "academic_title" text,
  "academic_year" text,
  "address" text,
  "avatar_url" text,
  "birth_place" text,
  "campus_id" uuid,
  "classe_id" uuid,
  "created_at" timestamptz default now() not null,
  "date_of_birth" text,
  "department" text,
  "email" text,
  "filiere_id" uuid,
  "first_name" text default '' not null,
  "google_email" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "last_name" text default '' not null,
  "level" text,
  "nationality" text,
  "oriente_etat" boolean default false not null,
  "parent_contact" text,
  "phone" text,
  "post_bac" boolean default false not null,
  "recovery_email" text,
  "serie" text,
  "sexe" text,
  "signature_url" text,
  "statut_boursier" boolean default false not null,
  "student_number" text,
  "tuteur_email" text,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."push_subscriptions" (
  "auth" text not null,
  "created_at" timestamptz default now() not null,
  "endpoint" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "p256dh" text not null,
  "user_agent" text,
  "user_id" uuid not null
);

create table public."rattrapages" (
  "academic_year" text,
  "campus_id" uuid,
  "created_at" timestamptz default now(),
  "exam_date" text,
  "filiere_id" uuid,
  "final_grade" numeric,
  "id" uuid default gen_random_uuid() primary key,
  "level" text,
  "location" text,
  "original_average" numeric,
  "rattrapage_grade" numeric,
  "status" text,
  "subject_id" uuid,
  "user_id" uuid not null
);

create table public."releves_trimestre" (
  "academic_year" text not null,
  "appreciation" text,
  "classe_id" uuid not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "moyenne_annuelle" numeric,
  "moyenne_trimestre" numeric,
  "pdf_url" text,
  "qr_token" text default '' not null,
  "rang" numeric,
  "trimestre" text not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."role_permissions" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "permission_id" uuid not null,
  "role_id" uuid not null
);

create table public."roles" (
  "created_at" timestamptz default now() not null,
  "description" text,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "is_system" boolean default false not null,
  "name" text not null,
  "system_key" text,
  "updated_at" timestamptz default now() not null
);

create table public."schedule_events" (
  "academic_year" text,
  "campus_id" uuid,
  "classe_id" uuid,
  "classroom_id" uuid,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "end_time" text not null,
  "event_type" text default '' not null,
  "exam_kind" text,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "level" text,
  "location" text,
  "recurrence_group_id" uuid,
  "start_time" text not null,
  "subject_id" uuid,
  "title" text not null,
  "updated_by" text,
  "user_id" uuid
);

create table public."semester_progress" (
  "academic_year" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "semester_name" text not null,
  "status" text default '' not null,
  "total_credits" numeric default 0 not null,
  "user_id" uuid not null,
  "validated_credits" numeric default 0 not null
);

create table public."soutenance_jury" (
  "created_at" timestamptz default now() not null,
  "grade" numeric,
  "id" uuid default gen_random_uuid() primary key,
  "professor_name" text not null,
  "role" text default '' not null,
  "soutenance_id" uuid not null
);

create table public."soutenances" (
  "academic_year" text not null,
  "created_at" timestamptz default now() not null,
  "filiere_id" uuid,
  "final_grade" numeric,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "level" text,
  "location" text,
  "pv_url" text,
  "soutenance_date" text not null,
  "status" text default '' not null,
  "student_id" uuid not null,
  "subject" text,
  "title" text not null,
  "video_url" text
);

create table public."state_reimbursements" (
  "academic_year" text not null,
  "amount_received" numeric default 0 not null,
  "amount_refunded" numeric,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "notes" text,
  "receipt_number" text,
  "received_at" text,
  "refunded_at" text,
  "retention_amount" numeric default 0 not null,
  "status" text default '' not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."stories" (
  "created_at" timestamptz default now() not null,
  "description" text,
  "expires_at" timestamptz not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "media_type" text not null,
  "media_url" text not null,
  "user_id" uuid not null
);

create table public."story_likes" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "story_id" uuid not null,
  "user_id" uuid not null
);

create table public."story_replies" (
  "author_id" uuid not null,
  "content" text not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "story_id" uuid not null
);

create table public."story_views" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "story_id" uuid not null,
  "user_id" uuid not null
);

create table public."student_badges" (
  "badge_description" text,
  "badge_icon" text,
  "badge_name" text not null,
  "earned_at" text,
  "id" uuid default gen_random_uuid() primary key,
  "user_id" uuid not null
);

create table public."student_documents" (
  "academic_year" text,
  "campus_id" uuid,
  "created_at" timestamptz default now() not null,
  "doc_type" text default '' not null,
  "file_size" numeric,
  "file_url" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "mime_type" text,
  "title" text not null,
  "uploaded_by" text,
  "user_id" uuid not null
);

create table public."student_points" (
  "action" text not null,
  "created_at" timestamptz default now(),
  "description" text,
  "id" uuid default gen_random_uuid() primary key,
  "points" numeric default 0 not null,
  "user_id" uuid not null
);

create table public."student_year_history" (
  "academic_year" text not null,
  "created_at" timestamptz default now() not null,
  "credits_acquired" numeric default 0 not null,
  "credits_total" numeric default 0 not null,
  "decision" text default '' not null,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "level" text not null,
  "status" text default '' not null,
  "ue_to_retake_ids" text[],
  "ue_validated_ids" text[],
  "user_id" uuid not null
);

create table public."student_years" (
  "academic_year" text not null,
  "block_reason" text,
  "blocked_at" text,
  "can_access" boolean default false not null,
  "created_at" timestamptz default now() not null,
  "debt_cancelled" boolean default false not null,
  "debt_frozen" boolean default false not null,
  "enrollment_status" text default '' not null,
  "exit_date" text,
  "exit_decided_by" text,
  "exit_type" text,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "niveau" text not null,
  "status" text default '' not null,
  "unblocked_at" text,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."students" (
  "created_at" timestamptz default now(),
  "date_of_birth" text,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "matricule" text not null,
  "niveau" text not null,
  "nom" text not null,
  "oriente_etat" boolean default false not null,
  "prenom" text not null,
  "statut_boursier" boolean default false not null
);

create table public."subject_classes" (
  "classe_id" uuid not null,
  "coefficient" numeric default 0 not null,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "professor_name" text,
  "professor_user_id" uuid,
  "subject_id" uuid not null,
  "updated_at" timestamptz default now() not null
);

create table public."subjects" (
  "academic_year" text default '' not null,
  "campus_id" uuid,
  "code" text,
  "coefficient" numeric default 0 not null,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "credits" numeric default 0 not null,
  "description" text,
  "duree_cours_minutes" numeric default 0 not null,
  "evaluation_mode" text default '' not null,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "level" text default '' not null,
  "levels" text[],
  "name" text not null,
  "professor" text,
  "pv_academic_year" text,
  "pv_semester" text,
  "pv_uploaded_at" text,
  "pv_uploaded_by" text,
  "pv_url" text,
  "quota_absence_hours" numeric default 0 not null,
  "semester" text default '' not null,
  "syllabus" text,
  "updated_by" text,
  "volume_horaire_cm" numeric,
  "volume_horaire_td" numeric,
  "volume_horaire_tp" numeric
);

create table public."suppressed_emails" (
  "created_at" timestamptz default now() not null,
  "email" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "metadata" jsonb,
  "reason" text not null
);

create table public."team_members" (
  "academic_scope" text default '' not null,
  "allowed_modules" text[] default '{}' not null,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "custom_role_label" text,
  "email" text not null,
  "first_name" text not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "is_principal" boolean default false not null,
  "last_name" text not null,
  "phone" text,
  "team_role" public."team_role_type" default 'role_personnalise' not null,
  "updated_at" timestamptz default now() not null,
  "user_id" uuid not null
);

create table public."trimestre_closures" (
  "academic_year" text not null,
  "closed_at" text default '' not null,
  "closed_by" text,
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "trimestre" text not null,
  "updated_at" timestamptz default now() not null
);

create table public."ue_matieres" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "subject_id" uuid not null,
  "ue_id" uuid not null
);

create table public."ues" (
  "academic_year" text not null,
  "code" text,
  "created_at" timestamptz default now() not null,
  "created_by" text,
  "credits" numeric default 0 not null,
  "description" text,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "niveau" text not null,
  "nom" text not null,
  "semester" text default '' not null,
  "updated_at" timestamptz default now() not null,
  "updated_by" text
);

create table public."user_roles" (
  "id" uuid default gen_random_uuid() primary key,
  "role" public."app_role" not null,
  "user_id" uuid not null
);

create table public."user_roles_v2" (
  "created_at" timestamptz default now() not null,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid not null,
  "role_id" uuid not null,
  "user_id" uuid not null
);

create table public."video_conferences" (
  "created_at" timestamptz default now() not null,
  "filiere_id" uuid,
  "id" uuid default gen_random_uuid() primary key,
  "institution_id" uuid,
  "level" text,
  "meeting_url" text not null,
  "professor_id" uuid not null,
  "scheduled_at" text default '' not null,
  "status" text default '' not null,
  "title" text not null
);
alter table public."admin_chatbot_messages" enable row level security;
create index on public."admin_chatbot_messages" (institution_id);
create index on public."admin_chatbot_messages" (user_id);
alter table public."application_messages" add constraint "application_messages_application_id_fkey" foreign key ("application_id") references public."applications" ("id");
alter table public."application_messages" enable row level security;
alter table public."applications" add constraint "applications_program_id_fkey" foreign key ("program_id") references public."partner_programs" ("id");
alter table public."applications" add constraint "applications_target_filiere_id_fkey" foreign key ("target_filiere_id") references public."filieres" ("id");
alter table public."applications" add constraint "applications_target_institution_id_fkey" foreign key ("target_institution_id") references public."institutions" ("id");
alter table public."applications" enable row level security;
create index on public."applications" (user_id);
alter table public."attendance" add constraint "attendance_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."attendance" add constraint "attendance_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."attendance" add constraint "attendance_schedule_event_id_fkey" foreign key ("schedule_event_id") references public."schedule_events" ("id");
alter table public."attendance" add constraint "attendance_session_id_fkey" foreign key ("session_id") references public."attendance_sessions" ("id");
alter table public."attendance" add constraint "attendance_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."attendance" enable row level security;
create index on public."attendance" (institution_id);
create index on public."attendance" (user_id);
alter table public."attendance_sessions" add constraint "attendance_sessions_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."attendance_sessions" add constraint "attendance_sessions_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."attendance_sessions" enable row level security;
create index on public."attendance_sessions" (institution_id);
alter table public."audit_logs" enable row level security;
create index on public."audit_logs" (institution_id);
create index on public."audit_logs" (user_id);
alter table public."bac_results" add constraint "bac_results_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."bac_results" enable row level security;
create index on public."bac_results" (institution_id);
create index on public."bac_results" (user_id);
alter table public."backup_logs" add constraint "backup_logs_establishment_id_fkey" foreign key ("establishment_id") references public."institutions" ("id");
alter table public."backup_logs" enable row level security;
alter table public."backups_history" enable row level security;
alter table public."bde_members" enable row level security;
create index on public."bde_members" (user_id);
alter table public."bde_posts" enable row level security;
alter table public."campus_staff" add constraint "campus_staff_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."campus_staff" add constraint "campus_staff_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."campus_staff" enable row level security;
create index on public."campus_staff" (institution_id);
create index on public."campus_staff" (user_id);
alter table public."campuses" add constraint "campuses_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."campuses" enable row level security;
create index on public."campuses" (institution_id);
alter table public."class_teachers" add constraint "class_teachers_classe_id_fkey" foreign key ("classe_id") references public."classes" ("id");
alter table public."class_teachers" add constraint "class_teachers_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."class_teachers" enable row level security;
create index on public."class_teachers" (institution_id);
alter table public."classes" add constraint "classes_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."classes" add constraint "classes_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."classes" enable row level security;
create index on public."classes" (institution_id);
alter table public."classrooms" add constraint "classrooms_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."classrooms" add constraint "classrooms_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."classrooms" enable row level security;
create index on public."classrooms" (institution_id);
alter table public."community_bookmarks" enable row level security;
create index on public."community_bookmarks" (institution_id);
create index on public."community_bookmarks" (user_id);
alter table public."community_comment_likes" enable row level security;
create index on public."community_comment_likes" (institution_id);
create index on public."community_comment_likes" (user_id);
alter table public."community_comments" add constraint "community_comments_post_id_fkey" foreign key ("post_id") references public."community_posts" ("id");
alter table public."community_comments" enable row level security;
create index on public."community_comments" (institution_id);
alter table public."community_likes" add constraint "community_likes_post_id_fkey" foreign key ("post_id") references public."community_posts" ("id");
alter table public."community_likes" enable row level security;
create index on public."community_likes" (institution_id);
create index on public."community_likes" (user_id);
alter table public."community_posts" enable row level security;
create index on public."community_posts" (institution_id);
alter table public."community_reactions" enable row level security;
create index on public."community_reactions" (institution_id);
create index on public."community_reactions" (user_id);
alter table public."course_documents" add constraint "course_documents_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."course_documents" enable row level security;
alter table public."course_validation" add constraint "course_validation_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."course_validation" add constraint "course_validation_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."course_validation" add constraint "course_validation_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."course_validation" enable row level security;
create index on public."course_validation" (institution_id);
alter table public."cron_secrets" enable row level security;
alter table public."director_signatures" enable row level security;
create index on public."director_signatures" (institution_id);
create index on public."director_signatures" (user_id);
alter table public."document_validations" add constraint "document_validations_signature_id_fkey" foreign key ("signature_id") references public."director_signatures" ("id");
alter table public."document_validations" enable row level security;
create index on public."document_validations" (institution_id);
alter table public."election_candidates" add constraint "election_candidates_election_id_fkey" foreign key ("election_id") references public."elections" ("id");
alter table public."election_candidates" enable row level security;
create index on public."election_candidates" (user_id);
alter table public."election_group_members" add constraint "election_group_members_candidate_id_fkey" foreign key ("candidate_id") references public."election_candidates" ("id");
alter table public."election_group_members" enable row level security;
create index on public."election_group_members" (user_id);
alter table public."election_votes" add constraint "election_votes_candidate_id_fkey" foreign key ("candidate_id") references public."election_candidates" ("id");
alter table public."election_votes" add constraint "election_votes_election_id_fkey" foreign key ("election_id") references public."elections" ("id");
alter table public."election_votes" enable row level security;
alter table public."elections" add constraint "elections_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."elections" enable row level security;
create index on public."elections" (institution_id);
alter table public."email_send_log" enable row level security;
alter table public."email_send_state" enable row level security;
alter table public."email_unsubscribe_tokens" enable row level security;
alter table public."enrollments" add constraint "enrollments_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."enrollments" add constraint "enrollments_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."enrollments" enable row level security;
create index on public."enrollments" (user_id);
alter table public."event_comments" add constraint "event_comments_event_id_fkey" foreign key ("event_id") references public."events" ("id");
alter table public."event_comments" enable row level security;
create index on public."event_comments" (user_id);
alter table public."event_likes" add constraint "event_likes_event_id_fkey" foreign key ("event_id") references public."events" ("id");
alter table public."event_likes" enable row level security;
create index on public."event_likes" (user_id);
alter table public."event_media" add constraint "event_media_event_id_fkey" foreign key ("event_id") references public."events" ("id");
alter table public."event_media" enable row level security;
alter table public."event_registrations" add constraint "event_registrations_event_id_fkey" foreign key ("event_id") references public."events" ("id");
alter table public."event_registrations" enable row level security;
create index on public."event_registrations" (user_id);
alter table public."events" add constraint "events_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."events" add constraint "events_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."events" enable row level security;
create index on public."events" (institution_id);
alter table public."exam_blanc_candidats" add constraint "exam_blanc_candidats_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."exam_blanc_candidats" enable row level security;
create index on public."exam_blanc_candidats" (institution_id);
create index on public."exam_blanc_candidats" (user_id);
alter table public."fee_types" enable row level security;
create index on public."fee_types" (institution_id);
alter table public."filiere_closures" enable row level security;
create index on public."filiere_closures" (institution_id);
alter table public."filieres" add constraint "filieres_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."filieres" add constraint "filieres_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."filieres" enable row level security;
create index on public."filieres" (institution_id);
alter table public."google_link_requests" enable row level security;
create index on public."google_link_requests" (institution_id);
create index on public."google_link_requests" (user_id);
alter table public."grades" add constraint "grades_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."grades" add constraint "grades_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."grades" add constraint "grades_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."grades" enable row level security;
create index on public."grades" (institution_id);
create index on public."grades" (user_id);
alter table public."grades_trimestre" add constraint "grades_trimestre_classe_id_fkey" foreign key ("classe_id") references public."classes" ("id");
alter table public."grades_trimestre" add constraint "grades_trimestre_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."grades_trimestre" enable row level security;
create index on public."grades_trimestre" (institution_id);
create index on public."grades_trimestre" (user_id);
alter table public."imports_history" add constraint "imports_history_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."imports_history" enable row level security;
create index on public."imports_history" (institution_id);
alter table public."institution_preregistrations" add constraint "institution_preregistrations_created_institution_id_fkey" foreign key ("created_institution_id") references public."institutions" ("id");
alter table public."institution_preregistrations" enable row level security;
alter table public."institution_subscriptions" add constraint "institution_subscriptions_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."institution_subscriptions" enable row level security;
create index on public."institution_subscriptions" (institution_id);
alter table public."institutions" enable row level security;
alter table public."library_annotations" add constraint "library_annotations_book_id_fkey" foreign key ("book_id") references public."library_books" ("id");
alter table public."library_annotations" enable row level security;
create index on public."library_annotations" (user_id);
alter table public."library_bookmarks" add constraint "library_bookmarks_book_id_fkey" foreign key ("book_id") references public."library_books" ("id");
alter table public."library_bookmarks" enable row level security;
create index on public."library_bookmarks" (user_id);
alter table public."library_books" add constraint "library_books_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."library_books" add constraint "library_books_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."library_books" enable row level security;
create index on public."library_books" (institution_id);
alter table public."library_favorites" add constraint "library_favorites_book_id_fkey" foreign key ("book_id") references public."library_books" ("id");
alter table public."library_favorites" enable row level security;
create index on public."library_favorites" (user_id);
alter table public."library_reading_history" add constraint "library_reading_history_book_id_fkey" foreign key ("book_id") references public."library_books" ("id");
alter table public."library_reading_history" enable row level security;
create index on public."library_reading_history" (user_id);
alter table public."library_settings" add constraint "library_settings_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."library_settings" enable row level security;
create index on public."library_settings" (institution_id);
alter table public."library_sync_logs" add constraint "library_sync_logs_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."library_sync_logs" enable row level security;
create index on public."library_sync_logs" (institution_id);
alter table public."message_group_members" add constraint "message_group_members_group_id_fkey" foreign key ("group_id") references public."message_groups" ("id");
alter table public."message_group_members" enable row level security;
create index on public."message_group_members" (user_id);
alter table public."message_groups" add constraint "message_groups_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."message_groups" add constraint "message_groups_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."message_groups" enable row level security;
create index on public."message_groups" (institution_id);
alter table public."messages" add constraint "messages_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."messages" enable row level security;
create index on public."messages" (institution_id);
alter table public."notification_settings" enable row level security;
create index on public."notification_settings" (user_id);
alter table public."notifications" add constraint "notifications_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."notifications" enable row level security;
create index on public."notifications" (institution_id);
create index on public."notifications" (user_id);
alter table public."orientation_profiles" enable row level security;
create index on public."orientation_profiles" (user_id);
alter table public."parametres_etablissement" enable row level security;
create index on public."parametres_etablissement" (institution_id);
alter table public."parent_students" add constraint "parent_students_parent_id_fkey" foreign key ("parent_id") references public."parents" ("id");
alter table public."parent_students" enable row level security;
alter table public."parents" enable row level security;
create index on public."parents" (institution_id);
create index on public."parents" (user_id);
alter table public."partner_programs" add constraint "partner_programs_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."partner_programs" enable row level security;
create index on public."partner_programs" (institution_id);
alter table public."payment_installments" add constraint "payment_installments_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."payment_installments" add constraint "payment_installments_payment_id_fkey" foreign key ("payment_id") references public."payments" ("id");
alter table public."payment_installments" enable row level security;
create index on public."payment_installments" (institution_id);
alter table public."payments" add constraint "payments_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."payments" add constraint "payments_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."payments" enable row level security;
create index on public."payments" (institution_id);
create index on public."payments" (user_id);
alter table public."permissions" enable row level security;
alter table public."professor_documents" add constraint "professor_documents_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."professor_documents" enable row level security;
create index on public."professor_documents" (institution_id);
alter table public."professor_experiences" add constraint "professor_experiences_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."professor_experiences" enable row level security;
create index on public."professor_experiences" (institution_id);
alter table public."professor_history" add constraint "professor_history_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."professor_history" enable row level security;
create index on public."professor_history" (institution_id);
alter table public."profiles" add constraint "profiles_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."profiles" add constraint "profiles_classe_id_fkey" foreign key ("classe_id") references public."classes" ("id");
alter table public."profiles" add constraint "profiles_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."profiles" add constraint "profiles_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."profiles" enable row level security;
create index on public."profiles" (institution_id);
create index on public."profiles" (user_id);
alter table public."push_subscriptions" enable row level security;
create index on public."push_subscriptions" (user_id);
alter table public."rattrapages" add constraint "rattrapages_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."rattrapages" add constraint "rattrapages_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."rattrapages" add constraint "rattrapages_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."rattrapages" enable row level security;
create index on public."rattrapages" (user_id);
alter table public."releves_trimestre" add constraint "releves_trimestre_classe_id_fkey" foreign key ("classe_id") references public."classes" ("id");
alter table public."releves_trimestre" add constraint "releves_trimestre_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."releves_trimestre" enable row level security;
create index on public."releves_trimestre" (institution_id);
create index on public."releves_trimestre" (user_id);
alter table public."role_permissions" add constraint "role_permissions_permission_id_fkey" foreign key ("permission_id") references public."permissions" ("id");
alter table public."role_permissions" add constraint "role_permissions_role_id_fkey" foreign key ("role_id") references public."roles" ("id");
alter table public."role_permissions" enable row level security;
alter table public."roles" add constraint "roles_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."roles" enable row level security;
create index on public."roles" (institution_id);
alter table public."schedule_events" add constraint "schedule_events_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."schedule_events" add constraint "schedule_events_classe_id_fkey" foreign key ("classe_id") references public."classes" ("id");
alter table public."schedule_events" add constraint "schedule_events_classroom_id_fkey" foreign key ("classroom_id") references public."classrooms" ("id");
alter table public."schedule_events" add constraint "schedule_events_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."schedule_events" add constraint "schedule_events_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."schedule_events" add constraint "schedule_events_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."schedule_events" enable row level security;
create index on public."schedule_events" (institution_id);
create index on public."schedule_events" (user_id);
alter table public."semester_progress" enable row level security;
create index on public."semester_progress" (user_id);
alter table public."soutenance_jury" add constraint "soutenance_jury_soutenance_id_fkey" foreign key ("soutenance_id") references public."soutenances" ("id");
alter table public."soutenance_jury" enable row level security;
alter table public."soutenances" add constraint "soutenances_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."soutenances" add constraint "soutenances_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."soutenances" enable row level security;
create index on public."soutenances" (institution_id);
alter table public."state_reimbursements" enable row level security;
create index on public."state_reimbursements" (institution_id);
create index on public."state_reimbursements" (user_id);
alter table public."stories" enable row level security;
create index on public."stories" (institution_id);
create index on public."stories" (user_id);
alter table public."story_likes" add constraint "story_likes_story_id_fkey" foreign key ("story_id") references public."stories" ("id");
alter table public."story_likes" enable row level security;
create index on public."story_likes" (user_id);
alter table public."story_replies" add constraint "story_replies_story_id_fkey" foreign key ("story_id") references public."stories" ("id");
alter table public."story_replies" enable row level security;
alter table public."story_views" add constraint "story_views_story_id_fkey" foreign key ("story_id") references public."stories" ("id");
alter table public."story_views" enable row level security;
create index on public."story_views" (user_id);
alter table public."student_badges" enable row level security;
create index on public."student_badges" (user_id);
alter table public."student_documents" add constraint "student_documents_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."student_documents" enable row level security;
create index on public."student_documents" (institution_id);
create index on public."student_documents" (user_id);
alter table public."student_points" enable row level security;
create index on public."student_points" (user_id);
alter table public."student_year_history" add constraint "student_year_history_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."student_year_history" enable row level security;
create index on public."student_year_history" (user_id);
alter table public."student_years" enable row level security;
create index on public."student_years" (institution_id);
create index on public."student_years" (user_id);
alter table public."students" add constraint "students_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."students" add constraint "students_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."students" enable row level security;
create index on public."students" (institution_id);
alter table public."subject_classes" add constraint "subject_classes_classe_id_fkey" foreign key ("classe_id") references public."classes" ("id");
alter table public."subject_classes" add constraint "subject_classes_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."subject_classes" add constraint "subject_classes_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."subject_classes" enable row level security;
create index on public."subject_classes" (institution_id);
alter table public."subjects" add constraint "subjects_campus_id_fkey" foreign key ("campus_id") references public."campuses" ("id");
alter table public."subjects" add constraint "subjects_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."subjects" add constraint "subjects_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."subjects" enable row level security;
create index on public."subjects" (institution_id);
alter table public."suppressed_emails" enable row level security;
alter table public."team_members" enable row level security;
create index on public."team_members" (institution_id);
create index on public."team_members" (user_id);
alter table public."trimestre_closures" add constraint "trimestre_closures_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."trimestre_closures" enable row level security;
create index on public."trimestre_closures" (institution_id);
alter table public."ue_matieres" add constraint "ue_matieres_subject_id_fkey" foreign key ("subject_id") references public."subjects" ("id");
alter table public."ue_matieres" add constraint "ue_matieres_ue_id_fkey" foreign key ("ue_id") references public."ues" ("id");
alter table public."ue_matieres" enable row level security;
alter table public."ues" enable row level security;
create index on public."ues" (institution_id);
alter table public."user_roles" enable row level security;
create index on public."user_roles" (user_id);
alter table public."user_roles_v2" add constraint "user_roles_v2_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."user_roles_v2" add constraint "user_roles_v2_role_id_fkey" foreign key ("role_id") references public."roles" ("id");
alter table public."user_roles_v2" enable row level security;
create index on public."user_roles_v2" (institution_id);
create index on public."user_roles_v2" (user_id);
alter table public."video_conferences" add constraint "video_conferences_filiere_id_fkey" foreign key ("filiere_id") references public."filieres" ("id");
alter table public."video_conferences" add constraint "video_conferences_institution_id_fkey" foreign key ("institution_id") references public."institutions" ("id");
alter table public."video_conferences" enable row level security;
create index on public."video_conferences" (institution_id);
