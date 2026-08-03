-- Schema SQL untuk Tabel Perizinan (permissions) di Supabase
-- Buka Supabase Dashboard -> SQL Editor -> Tempel & Run query di bawah ini:

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT DEFAULT 'internship',
  type TEXT NOT NULL, -- 'sakit', 'izin', 'cuti', 'lainnya'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  document_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  mentor_comment TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Matikan Row Level Security (RLS) jika aplikasi mengelola otorisasi via backend Express
ALTER TABLE public.permissions DISABLE ROW LEVEL SECURITY;
