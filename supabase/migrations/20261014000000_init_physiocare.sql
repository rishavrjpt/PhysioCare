-- PhysioCare: initial Postgres schema (migrated from MongoDB/Mongoose)
-- The backend connects with the service role / postgres role, which bypasses RLS.
-- RLS is enabled on every table with NO policies, so the anon and authenticated
-- keys can read and write nothing.

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────────
create type user_role          as enum ('patient', 'doctor', 'user', 'admin');
create type auth_provider      as enum ('local', 'google');
create type appointment_status as enum ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled');
create type patient_feeling    as enum ('Better', 'Same', 'Worse');
create type article_category   as enum ('Rehabilitation', 'Orthopedic', 'Sports', 'Wellness', 'Neurological', 'Nutrition');
create type article_status     as enum ('draft', 'published');

-- ── updated_at trigger function ──────────────────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── users ────────────────────────────────────────────────────────────────────
create table users (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  name text,
  email text not null,
  password text,
  role user_role not null default 'patient',
  google_id text,
  auth_provider auth_provider not null default 'local',
  is_verified boolean not null default false,
  profile_completed boolean not null default false,
  profile_photo text not null default '',
  phone text not null default '',
  city text not null default '',
  -- patient fields
  date_of_birth text not null default '',
  gender text not null default '',
  blood_group text not null default '',
  current_condition text not null default '',
  existing_conditions text not null default '',
  past_surgeries text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_number text not null default '',
  -- OTP (EmailJS flow)
  otp text,
  otp_expiry timestamptz,
  otp_attempts int not null default 0,
  otp_last_sent_at timestamptz,
  -- legacy email verification link
  verification_token text,
  verification_token_expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_lowercase check (email = lower(btrim(email)))
);
create unique index users_email_key on users (email);
create unique index users_google_id_key on users (google_id) where google_id is not null;
create index users_role_verified_city_idx on users (role, is_verified, city);

-- ── doctor_profiles (1:1 with users) ─────────────────────────────────────────
create table doctor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  experience text not null default '0 Years',
  patients_count text not null default '0+',
  rating numeric not null default 0,
  fees numeric not null default 0,
  about text not null default '',
  specialization text not null default 'Physiotherapist',
  bio text not null default '',
  licence_number text not null default '',
  hospital_name text not null default '',
  available_days text[] not null default '{}',
  available_time_start text not null default '',
  available_time_end text not null default '',
  languages text[] not null default '{}',
  is_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── programs ─────────────────────────────────────────────────────────────────
create table programs (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  doctor_id uuid not null references users(id) on delete cascade,
  title text not null,
  description text,
  program_code text not null unique,
  specialty text not null default 'General',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index programs_doctor_idx on programs (doctor_id, created_at desc);

-- replaces users.enrolledPrograms[]
create table program_enrollments (
  patient_id uuid not null references users(id) on delete cascade,
  program_id uuid not null references programs(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (patient_id, program_id)
);
create index program_enrollments_program_idx on program_enrollments (program_id);

-- ── appointments (includes completion note + patient review) ─────────────────
create table appointments (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  patient_id uuid not null references users(id) on delete cascade,
  doctor_id uuid not null references users(id) on delete cascade,
  date text not null,
  time text not null,
  status appointment_status not null default 'Pending',
  notes text not null default '',
  -- doctor's completion note
  session_number int,
  problem_description text,
  medicine text,
  suggestion text,
  follow_up_needed boolean not null default false,
  follow_up_date text,
  program_code text,
  program_title text,
  -- patient's review
  patient_rating int check (patient_rating between 1 and 5),
  patient_feeling patient_feeling,
  patient_review text,
  -- report sharing
  sent_to_patient boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_doctor_idx on appointments (doctor_id, created_at desc);
create index appointments_patient_idx on appointments (patient_id, created_at desc);
create index appointments_doctor_slot_idx on appointments (doctor_id, date, time);
-- one active booking per doctor per slot (race-free double-booking guard)
create unique index appointments_no_double_booking
  on appointments (doctor_id, date, time)
  where status in ('Pending', 'Confirmed');

-- ── videos ───────────────────────────────────────────────────────────────────
create table videos (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  doctor_id uuid not null references users(id) on delete cascade,
  program_id uuid references programs(id) on delete cascade, -- null = general library
  title text not null,
  description text,
  url text not null,
  thumbnail text,
  duration text not null default '0:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index videos_program_idx on videos (program_id, created_at desc);
create index videos_doctor_program_idx on videos (doctor_id, program_id);

-- ── session_logs ─────────────────────────────────────────────────────────────
create table session_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references users(id) on delete cascade,
  video_id uuid references videos(id) on delete set null,
  pain_level int not null check (pain_level between 1 and 10),
  date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index session_logs_patient_idx on session_logs (patient_id, date desc);

-- ── articles ─────────────────────────────────────────────────────────────────
create table articles (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  doctor_id uuid not null references users(id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  content text not null,
  category article_category not null default 'Wellness',
  tags text[] not null default '{}',
  cover_image text not null default '',
  status article_status not null default 'draft',
  read_time text not null default '1 min read',
  views int not null default 0,
  likes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index articles_status_idx on articles (status, created_at desc);
create index articles_doctor_idx on articles (doctor_id, created_at desc);

-- ── patient_notes (private doctor notes, one per doctor/patient pair) ────────
create table patient_notes (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references users(id) on delete cascade,
  patient_id uuid not null references users(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (doctor_id, patient_id)
);

-- ── team_members ─────────────────────────────────────────────────────────────
create table team_members (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  name text not null,
  roll_number text,
  year text,
  degree text,
  about_project text,
  hobbies text,
  certificate text,
  internship text,
  about_you text,
  photo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── updated_at triggers (all 9 tables) ───────────────────────────────────────
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();
create trigger doctor_profiles_set_updated_at before update on doctor_profiles
  for each row execute function set_updated_at();
create trigger programs_set_updated_at before update on programs
  for each row execute function set_updated_at();
create trigger appointments_set_updated_at before update on appointments
  for each row execute function set_updated_at();
create trigger videos_set_updated_at before update on videos
  for each row execute function set_updated_at();
create trigger session_logs_set_updated_at before update on session_logs
  for each row execute function set_updated_at();
create trigger articles_set_updated_at before update on articles
  for each row execute function set_updated_at();
create trigger patient_notes_set_updated_at before update on patient_notes
  for each row execute function set_updated_at();
create trigger team_members_set_updated_at before update on team_members
  for each row execute function set_updated_at();

-- ── Row Level Security (all tables, including the program_enrollments join table) ──
alter table users               enable row level security;
alter table doctor_profiles     enable row level security;
alter table programs            enable row level security;
alter table program_enrollments enable row level security;
alter table appointments        enable row level security;
alter table videos              enable row level security;
alter table session_logs        enable row level security;
alter table articles            enable row level security;
alter table patient_notes       enable row level security;
alter table team_members        enable row level security;
