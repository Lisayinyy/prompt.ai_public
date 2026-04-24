-- Phase 3 Upgrade: add score columns to prompts table
-- Run this in Supabase SQL editor

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS score_clarity     SMALLINT,
  ADD COLUMN IF NOT EXISTS score_specificity SMALLINT,
  ADD COLUMN IF NOT EXISTS score_structure   SMALLINT;
