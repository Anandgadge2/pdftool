-- PDF Markup Extractor — PostgreSQL Schema
-- Run this once to create tables (initDb() in db.ts does this automatically)

CREATE TABLE IF NOT EXISTS markups (
    id                    SERIAL PRIMARY KEY,
    pdf_name              TEXT NOT NULL,
    pdf_url               TEXT DEFAULT '',
    page_number           INTEGER NOT NULL,
    annotation_type       TEXT NOT NULL DEFAULT 'Unknown',
    comment_text          TEXT DEFAULT '',
    author                TEXT DEFAULT '',
    created_date          TEXT DEFAULT '',
    modified_date         TEXT DEFAULT '',
    rectangle_coordinates TEXT DEFAULT '',
    selected_text         TEXT DEFAULT '',
    assigned_to           TEXT DEFAULT 'Unassigned',
    priority              TEXT DEFAULT 'Medium',
    status                TEXT DEFAULT 'Pending',
    remarks               TEXT DEFAULT '',
    created_at            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignees (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed default assignees
INSERT INTO assignees (name) VALUES
  ('Unassigned'),
  ('Admin'),
  ('Design Team'),
  ('Site Engineer'),
  ('Documentation Team'),
  ('Client Coordinator'),
  ('Developer')
ON CONFLICT (name) DO NOTHING;
