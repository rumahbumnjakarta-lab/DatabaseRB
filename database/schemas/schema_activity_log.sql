-- Log aktivitas & error aplikasi, dipakai oleh dashboard Monitoring (role 'sistem').
-- Setiap baris = satu kejadian (login, absen, izin, error server, dst).
-- Jalankan di Supabase SQL Editor.
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,               -- 'login','login_failed','logout','register','absen_in','absen_out','izin_ajukan','izin_review','user_update','user_delete','error', dst.
  level text NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'error'
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_name text,
  user_email text,
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_level ON public.activity_log(level);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Backend selalu akses lewat SUPABASE_SERVICE_ROLE_KEY (bypass RLS), policy di
-- bawah cuma jaga-jaga kalau suatu saat diakses langsung pakai anon/public key.
DROP POLICY IF EXISTS "Service role full access" ON public.activity_log;
CREATE POLICY "Service role full access" ON public.activity_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
