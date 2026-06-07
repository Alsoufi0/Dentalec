create extension if not exists vector;

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  study_state jsonb,
  usage jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists sources (
  id text primary key,
  owner_user_id text references users(id) on delete cascade,
  title text not null,
  source_type text not null,
  external_file_id text,
  vector_store_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concepts (
  id text primary key,
  name text not null unique,
  discipline text,
  description text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists concept_edges (
  id text primary key,
  from_concept_id text not null references concepts(id) on delete cascade,
  to_concept_id text not null references concepts(id) on delete cascade,
  relation text not null,
  strength numeric,
  source_id text references sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists source_chunks (
  id text primary key,
  source_id text not null references sources(id) on delete cascade,
  chunk_index integer not null,
  citation_label text,
  text text not null,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists engine_runs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  engine_type text not null,
  source_id text references sources(id) on delete set null,
  input text,
  output text,
  safety_level text not null default 'education',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists mastery_signals (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  concept_id text references concepts(id) on delete cascade,
  signal_type text not null,
  value numeric,
  evidence jsonb,
  created_at timestamptz not null default now()
);

create table if not exists review_events (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  concept_id text references concepts(id) on delete set null,
  flashcard_id text,
  grade text not null,
  due_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists osce_stations (
  id text primary key,
  owner_user_id text references users(id) on delete cascade,
  title text not null,
  station jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id text primary key,
  user_id text references users(id) on delete set null,
  event_type text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
