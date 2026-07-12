-- Migration: add department index + optional notes column to attendance
-- Runs safely with IF NOT EXISTS / IF NOT EXISTS checks

-- Add index for faster employee lookup by department
CREATE INDEX IF NOT EXISTS "employees_dept_idx" ON "employees" ("department");

-- Add index for faster attendance lookup by event type  
CREATE INDEX IF NOT EXISTS "attendance_event_idx" ON "attendance_logs" ("event_type");
