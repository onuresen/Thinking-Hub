-- supabase-schema.sql
-- Run this once in your Supabase project SQL editor:
-- Dashboard → SQL Editor → New query → paste → Run
--
-- This creates a single key-value table that mirrors the existing
-- localStorage schema. No schema migrations are needed if tool data
-- shapes change — just the key name changes.

-- ── Enable UUID extension (usually already enabled) ───────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Single table for all Thinking Hub workspace data ─────────────────────────
CREATE TABLE IF NOT EXISTS workspace_data (
  id           UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id TEXT        NOT NULL,
  key          TEXT        NOT NULL,
  value        TEXT        NOT NULL,   -- full JSON blob (matching localStorage value)
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, key)
);

-- ── Index for fast per-workspace key lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workspace_data_ws_key
  ON workspace_data (workspace_id, key);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The Supabase anon key is shared in the invite URL (this is fine — it's designed
-- to be public). The workspace_id acts as the access credential.
-- Add user auth + a workspace_members table later for stricter access control.
ALTER TABLE workspace_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_open_access" ON workspace_data
  USING (true)
  WITH CHECK (true);

-- ── Enable real-time for this table ──────────────────────────────────────────
-- Required for live updates to propagate between collaborators.
ALTER PUBLICATION supabase_realtime ADD TABLE workspace_data;

-- ── How to use ────────────────────────────────────────────────────────────────
-- 1. Create a free account at https://supabase.com
-- 2. Create a new project
-- 3. Open the SQL Editor and run this script
-- 4. Copy your Project URL and anon key from Settings → API
-- 5. In Thinking Hub, click "Connect" in the sidebar and paste them in
--
-- Workspace storage keys used by Thinking Hub:
--   project-hub-v1         → projects, tasks, members
--   hub-links-v1           → cross-tool links
--   decision-log-v1        → decision entries
--   ideaswipe_history_v6   → idea swipe history
--   schedule-v1            → schedule items
--   kmqt_current_v2        → KMQT board columns
--   dw-title-v1            → Decision Workspace title
--   dw-problem-v1          → Problem Lens fields
--   dw-canvas-v1           → Decision Canvas fields
--   dw-options-v1          → Option Map rows
