CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS lifeos_events (
  event_id text PRIMARY KEY,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifeos_memory_items (
  memory_id text PRIMARY KEY,
  user_id text NOT NULL,
  workspace_id text NOT NULL,
  memory_type text NOT NULL,
  stratum text NOT NULL,
  payload jsonb NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lifeos_memory_items_embedding_idx
  ON lifeos_memory_items USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS lifeos_interaction_signals (
  signal_id text PRIMARY KEY,
  user_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifeos_action_proposals (
  proposal_id text PRIMARY KEY,
  user_id text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifeos_audit_log (
  audit_id text PRIMARY KEY,
  object_type text NOT NULL,
  object_id text NOT NULL,
  verdict text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
