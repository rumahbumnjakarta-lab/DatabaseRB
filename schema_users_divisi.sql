-- ==============================================================================
-- RUMAH BUMN JAKARTA — DATABASE SCHEMA UPDATE
-- Update Tabel: users
-- Deskripsi: Menambahkan kolom divisi pada tabel users untuk kebutuhan Rekap Absensi
-- ==============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS divisi text;
