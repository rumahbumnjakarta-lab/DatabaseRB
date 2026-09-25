-- Tabel penetapan izin WFH untuk intern, per tanggal.
-- Staff yang menentukan intern mana yang boleh absen WFH pada tanggal tertentu.
-- Staff sendiri tidak perlu row di sini — mereka selalu boleh memilih WFO/WFH bebas.
-- Jalankan di Supabase SQL Editor
CREATE TABLE IF NOT EXISTS wfh_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  assigned_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_wfh_assignments_date ON wfh_assignments(work_date);
