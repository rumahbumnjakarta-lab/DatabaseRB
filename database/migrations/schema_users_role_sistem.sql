-- ==============================================================================
-- RUMAH BUMN JAKARTA — DATABASE SCHEMA UPDATE
-- Update Tabel: users
-- Deskripsi: Tabel users punya CHECK constraint "users_role_check" yang cuma
-- mengizinkan role 'staff'/'internship'. Tambah 'sistem' (role monitoring —
-- lihat public/pages/monitoring.html) ke daftar yang diperbolehkan.
-- Jalankan di Supabase SQL Editor.
-- ==============================================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('staff', 'internship', 'sistem'));
