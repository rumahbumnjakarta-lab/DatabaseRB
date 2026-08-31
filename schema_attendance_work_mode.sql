-- Tambah kolom work_mode ke tabel attendance (WFH / WFO)
-- Jalankan di Supabase SQL Editor
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_mode text DEFAULT 'wfo';
