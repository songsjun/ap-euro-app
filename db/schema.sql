CREATE TABLE IF NOT EXISTS students (
  id text PRIMARY KEY,
  access_code_lookup text UNIQUE NOT NULL,
  access_code_hash text NOT NULL,
  display_name text,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS access_code_lookup text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS access_code_hash text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE students ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS students_access_code_lookup_idx ON students(access_code_lookup);

CREATE TABLE IF NOT EXISTS completions (
  user_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  resource_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'skipped')),
  score double precision,
  score_max double precision,
  completed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

ALTER TABLE completions ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS resource_id text;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS score double precision;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS score_max double precision;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE completions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS completions_user_id_idx ON completions(user_id);

CREATE TABLE IF NOT EXISTS completion_events (
  event_id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  resource_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'skipped')),
  score double precision,
  score_max double precision,
  completed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE completion_events ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE completion_events ADD COLUMN IF NOT EXISTS resource_id text;
ALTER TABLE completion_events ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE completion_events ADD COLUMN IF NOT EXISTS score double precision;
ALTER TABLE completion_events ADD COLUMN IF NOT EXISTS score_max double precision;
ALTER TABLE completion_events ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE completion_events ADD COLUMN IF NOT EXISTS recorded_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS completion_events_user_resource_idx
  ON completion_events(user_id, resource_id, recorded_at);

INSERT INTO completion_events (user_id, resource_id, status, score, score_max, completed_at)
SELECT c.user_id, c.resource_id, c.status, c.score, c.score_max, c.completed_at
FROM completions c
WHERE NOT EXISTS (
  SELECT 1
  FROM completion_events e
  WHERE e.user_id = c.user_id
    AND e.resource_id = c.resource_id
    AND e.status = c.status
    AND e.completed_at = c.completed_at
);

CREATE TABLE IF NOT EXISTS topic_unlocks (
  user_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  section_id text NOT NULL,
  unlocked_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, section_id)
);

ALTER TABLE topic_unlocks ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE topic_unlocks ADD COLUMN IF NOT EXISTS section_id text;
ALTER TABLE topic_unlocks ADD COLUMN IF NOT EXISTS unlocked_at timestamptz;
CREATE INDEX IF NOT EXISTS topic_unlocks_user_id_idx ON topic_unlocks(user_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  user_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  attempted_at timestamptz NOT NULL,
  mcq_score integer,
  mcq_total integer,
  mcq_answers jsonb,
  saq_parts jsonb,
  reflect jsonb,
  skill_parts jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS topic_id text;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS attempted_at timestamptz;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS mcq_score integer;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS mcq_total integer;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS mcq_answers jsonb;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS saq_parts jsonb;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS reflect jsonb;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS skill_parts jsonb;
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS quiz_attempts_user_id_idx ON quiz_attempts(user_id);

CREATE TABLE IF NOT EXISTS quiz_attempt_events (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  topic_id text NOT NULL,
  attempted_at timestamptz NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('patch', 'reset')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quiz_attempt_events ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE quiz_attempt_events ADD COLUMN IF NOT EXISTS topic_id text;
ALTER TABLE quiz_attempt_events ADD COLUMN IF NOT EXISTS attempted_at timestamptz;
ALTER TABLE quiz_attempt_events ADD COLUMN IF NOT EXISTS event_type text;
ALTER TABLE quiz_attempt_events ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE quiz_attempt_events ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS quiz_attempt_events_user_topic_idx
  ON quiz_attempt_events(user_id, topic_id, id);

INSERT INTO quiz_attempt_events (user_id, topic_id, attempted_at, event_type, payload, created_at)
SELECT
  qa.user_id,
  qa.topic_id,
  qa.attempted_at,
  'patch',
  jsonb_strip_nulls(jsonb_build_object(
    'mcq_score', qa.mcq_score,
    'mcq_total', qa.mcq_total,
    'mcq_answers', qa.mcq_answers,
    'saq_parts', qa.saq_parts,
    'reflect', qa.reflect,
    'skill_parts', qa.skill_parts
  )),
  qa.updated_at
FROM quiz_attempts qa
WHERE NOT EXISTS (
  SELECT 1
  FROM quiz_attempt_events event
  WHERE event.user_id = qa.user_id
    AND event.topic_id = qa.topic_id
    AND event.attempted_at = qa.attempted_at
    AND event.event_type = 'patch'
);
