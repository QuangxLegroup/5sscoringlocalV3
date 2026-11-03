-- LeGroup 5S operational schema. The data column preserves fields not projected
-- into typed columns; five_s_finding_items stores finding rows relationally.
CREATE TABLE IF NOT EXISTS app_root_values (
  root_key text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS app_collection_shapes (
  collection text PRIMARY KEY,
  shape text NOT NULL CHECK (shape IN ('array', 'object'))
);

CREATE TABLE IF NOT EXISTS app_meta (
  meta_key text PRIMARY KEY,
  value jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS app_revision (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 0
);
INSERT INTO app_revision (singleton, revision) VALUES (true, 0)
  ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_schema_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS periods (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  year smallint,
  month smallint,
  period_type text,
  label text,
  archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  settings_snapshot jsonb,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  username text,
  display_name text,
  role text,
  active boolean,
  password_hash text,
  access_types jsonb,
  roles_by_type jsonb,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_username_idx ON accounts (lower(username));
CREATE INDEX IF NOT EXISTS accounts_role_idx ON accounts (role);

CREATE TABLE IF NOT EXISTS areas (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  code text,
  template_code text,
  area_order numeric,
  department_head text,
  department_head_employee_code text,
  summary_group text,
  scorer_id text,
  assessor_id text,
  assessor_ids jsonb,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS areas_code_idx ON areas (code);
CREATE INDEX IF NOT EXISTS areas_scorer_idx ON areas (scorer_id);
CREATE INDEX IF NOT EXISTS areas_assessor_idx ON areas (assessor_id);

CREATE TABLE IF NOT EXISTS safety_areas (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  code text,
  template_code text,
  area_order numeric,
  department_head text,
  department_head_employee_code text,
  summary_group text,
  scorer_id text,
  assessor_id text,
  assessor_ids jsonb,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS safety_areas_code_idx ON safety_areas (code);
CREATE INDEX IF NOT EXISTS safety_areas_scorer_idx ON safety_areas (scorer_id);
CREATE INDEX IF NOT EXISTS safety_areas_assessor_idx ON safety_areas (assessor_id);

CREATE TABLE IF NOT EXISTS managers (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  name text,
  employee_code text,
  emails jsonb,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS assessors (LIKE managers INCLUDING ALL);
CREATE TABLE IF NOT EXISTS safety_managers (LIKE managers INCLUDING ALL);
CREATE TABLE IF NOT EXISTS safety_assessors (LIKE managers INCLUDING ALL);
CREATE TABLE IF NOT EXISTS department_head_contacts (LIKE managers INCLUDING ALL);
CREATE TABLE IF NOT EXISTS safety_department_head_contacts (LIKE managers INCLUDING ALL);
CREATE TABLE IF NOT EXISTS safety_department_groups (LIKE managers INCLUDING ALL);
CREATE TABLE IF NOT EXISTS at5s_members (LIKE managers INCLUDING ALL);

CREATE TABLE IF NOT EXISTS scores (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  period_id text,
  period_year smallint,
  period_month smallint,
  area_id text,
  item_id text,
  criterion_id text,
  score_source text,
  score numeric,
  scorer_name text,
  account_username text,
  record_status text,
  occurred_at date,
  updated_at timestamptz,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_period_zone_idx ON scores (period_year, period_month, area_id, period_id);
CREATE INDEX IF NOT EXISTS scores_item_idx ON scores (item_id, criterion_id, score_source);

CREATE TABLE IF NOT EXISTS safety_records (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  period_id text,
  period_year smallint,
  period_month smallint,
  area_id text,
  issue_date date,
  issue_level text,
  issue_type text,
  record_status text,
  note text,
  improvement_content text,
  action_owner text,
  completion_date date,
  issue_found_by text,
  account_username text,
  occurred_at date,
  created_at timestamptz,
  updated_at timestamptz,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS safety_records_period_idx ON safety_records (period_year, period_month, period_id);
CREATE INDEX IF NOT EXISTS safety_records_zone_idx ON safety_records (area_id, period_id);
CREATE INDEX IF NOT EXISTS safety_records_status_idx ON safety_records (record_status, period_id);
CREATE INDEX IF NOT EXISTS safety_records_occurred_idx ON safety_records (occurred_at DESC NULLS LAST, updated_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS five_s_findings (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  period_id text,
  period_year smallint,
  period_month smallint,
  area_id text,
  zone_label text,
  inspector text,
  inspection_date date,
  record_status text,
  row_count integer NOT NULL DEFAULT 0,
  rows_shape text NOT NULL DEFAULT 'array' CHECK (rows_shape IN ('array', 'object')),
  occurred_at date,
  created_at timestamptz,
  updated_at timestamptz,
  updated_by text,
  data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS five_s_findings_period_idx ON five_s_findings (period_year, period_month, period_id);
CREATE INDEX IF NOT EXISTS five_s_findings_zone_idx ON five_s_findings (area_id, period_id);
CREATE INDEX IF NOT EXISTS five_s_findings_status_idx ON five_s_findings (record_status, period_id);
CREATE INDEX IF NOT EXISTS five_s_findings_date_idx ON five_s_findings (occurred_at DESC NULLS LAST, updated_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS five_s_finding_items (
  finding_id text NOT NULL REFERENCES five_s_findings(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  location text,
  problem text,
  category text,
  shift text,
  countermeasure text,
  owner text,
  due_date date,
  progress smallint,
  data jsonb NOT NULL,
  PRIMARY KEY (finding_id, item_key)
);
CREATE INDEX IF NOT EXISTS five_s_finding_items_due_idx ON five_s_finding_items (due_date, progress);

CREATE TABLE IF NOT EXISTS deleted_safety_records (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  original_id text,
  period_id text,
  area_id text,
  deleted_at timestamptz,
  deleted_by text,
  reason text,
  data jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS score_history (
  id text PRIMARY KEY,
  position integer NOT NULL DEFAULT 0,
  changed_at timestamptz,
  period_id text,
  area_id text,
  username text,
  employee_code text,
  display_name text,
  item_id text,
  criterion_id text,
  score_source text,
  change_count integer,
  data jsonb NOT NULL
);
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE score_history ADD COLUMN IF NOT EXISTS display_name text;
CREATE INDEX IF NOT EXISTS score_history_changed_idx ON score_history (changed_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS score_history_period_zone_idx ON score_history (period_id, area_id);
