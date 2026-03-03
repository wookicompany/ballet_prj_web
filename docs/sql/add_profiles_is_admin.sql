-- Add is_admin column to profiles for admin panel access control.
-- Run this in Supabase SQL Editor. Grant admin by setting is_admin = true for a user row.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS 'true: admin panel access at /wookicompany/admin';
