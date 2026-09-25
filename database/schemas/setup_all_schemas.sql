-- ==============================================================================
-- RUMAH BUMN JAKARTA — COMBINED DATABASE SCHEMAS (LENGKAP)
-- Buka Supabase Dashboard -> SQL Editor -> Tempel & Run seluruh file ini.
--
-- Berisi SEMUA tabel & storage bucket yang dipakai server.js, jadi bisa dipakai
-- untuk project Supabase baru maupun yang sudah berjalan. Aman dijalankan
-- berkali-kali: tabel/kolom/index pakai IF NOT EXISTS, policy di-DROP dulu
-- sebelum dibuat ulang, dan tidak ada data yang dihapus.
--
-- Kolom divisi di users adalah teks bebas — daftar divisi diatur di frontend,
-- jadi tidak perlu migrasi saat daftar divisi berubah.
--
-- Backend sebaiknya pakai SUPABASE_SERVICE_ROLE_KEY (bypass RLS). Tabel users,
-- attendance, dan items sengaja tidak diubah pengaturan RLS-nya di sini.
-- ==============================================================================


-- ==============================================================================
-- 1. USERS — akun login (password di-hash bcrypt oleh backend)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'internship',
  password_hash text NOT NULL,
  divisi text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Untuk tabel users lama yang dibuat sebelum kolom-kolom ini ada
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS divisi text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Role yang diizinkan: staff, internship, sistem (monitoring)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('staff', 'internship', 'sistem'));


-- ==============================================================================
-- 2. ATTENDANCE — absensi clock in / clock out (foto + GPS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  user_name text,
  user_email text,
  user_role text,
  type text NOT NULL,              -- 'clock_in' | 'clock_out'
  work_mode text DEFAULT 'wfo',    -- 'wfo' | 'wfh'
  photo_url text,
  latitude double precision,
  longitude double precision,
  address text,
  timestamp timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS work_mode text DEFAULT 'wfo';

CREATE INDEX IF NOT EXISTS idx_attendance_timestamp ON public.attendance(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.attendance(user_id);


-- ==============================================================================
-- 2b. ITEMS — Kelola Data (link & kredensial per divisi)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  division text NOT NULL,
  cat text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,              -- 'link' | 'cred'
  url text,
  email text,
  pass text,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_division ON public.items(division);


-- ==============================================================================
-- 3. WFH ASSIGNMENTS — izin WFH intern per tanggal
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.wfh_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  assigned_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_wfh_assignments_date ON public.wfh_assignments(work_date);


-- ==============================================================================
-- 4. PERMISSIONS — perizinan (sakit / izin / cuti)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT DEFAULT 'internship',
  type TEXT NOT NULL,             -- 'sakit', 'izin', 'cuti', 'lainnya'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  document_url TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  mentor_comment TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.permissions DISABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 5. BUSINESS DEVELOPMENT — bd_partnerships
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bd_partnerships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Info Outreach & Kerja Sama
  tanggal_dihubungi date NOT NULL,
  tanggal_kerjasama date,

  -- Info Komunitas
  nama_komunitas text NOT NULL,
  linkedin text,
  instagram text,
  email text,
  kontak_komunitas text,
  nama_cp text,
  kontak_cp text,
  jumlah_anggota text,

  -- Status & Tracking
  status text NOT NULL DEFAULT 'Approach',
  via text,
  template_approach text,

  -- Relasi
  created_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.bd_partnerships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable read access for all authenticated users"
  ON public.bd_partnerships FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable insert for authenticated users"
  ON public.bd_partnerships FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable update for authenticated users"
  ON public.bd_partnerships FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable delete for authenticated users"
  ON public.bd_partnerships FOR DELETE TO authenticated USING (true);


-- ==============================================================================
-- 6. BUSINESS DEVELOPMENT — bd_catalog (katalog produk UMKM binaan)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bd_catalog (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,

  kategori text NOT NULL DEFAULT 'Umum',
  nama_umkm text NOT NULL,
  no_telp text,
  link_foto_katalog text,
  tanggal_display date, -- kapan produk ini ditaro di display, diatur manual oleh staff

  created_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.bd_catalog ADD COLUMN IF NOT EXISTS tanggal_display date;

CREATE INDEX IF NOT EXISTS idx_bd_catalog_kategori ON public.bd_catalog(kategori);

ALTER TABLE public.bd_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.bd_catalog;
CREATE POLICY "Enable read access for all authenticated users"
  ON public.bd_catalog FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.bd_catalog;
CREATE POLICY "Enable insert for authenticated users"
  ON public.bd_catalog FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.bd_catalog;
CREATE POLICY "Enable update for authenticated users"
  ON public.bd_catalog FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.bd_catalog;
CREATE POLICY "Enable delete for authenticated users"
  ON public.bd_catalog FOR DELETE TO authenticated USING (true);


-- ==============================================================================
-- 7. SOSMED CONTENT PLANNER — content_plans
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.content_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_type TEXT,
  publish_date DATE NOT NULL,
  caption TEXT,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_plans_select" ON public.content_plans;
CREATE POLICY "content_plans_select" ON public.content_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "content_plans_insert" ON public.content_plans;
CREATE POLICY "content_plans_insert" ON public.content_plans FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "content_plans_update" ON public.content_plans;
CREATE POLICY "content_plans_update" ON public.content_plans FOR UPDATE USING (true);

DROP POLICY IF EXISTS "content_plans_delete" ON public.content_plans;
CREATE POLICY "content_plans_delete" ON public.content_plans FOR DELETE USING (true);


-- ==============================================================================
-- 8. DESIGN REQUESTS — design_requests
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.design_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_name TEXT NOT NULL,
  requester_division TEXT NOT NULL,
  design_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  designer_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.design_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "design_requests_select" ON public.design_requests;
CREATE POLICY "design_requests_select" ON public.design_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "design_requests_insert" ON public.design_requests;
CREATE POLICY "design_requests_insert" ON public.design_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "design_requests_update" ON public.design_requests;
CREATE POLICY "design_requests_update" ON public.design_requests FOR UPDATE USING (true);

DROP POLICY IF EXISTS "design_requests_delete" ON public.design_requests;
CREATE POLICY "design_requests_delete" ON public.design_requests FOR DELETE USING (true);


-- ==============================================================================
-- 9. EVENTS — Agenda & Event Hub (silabus, acara, audiensi)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,         -- Contoh: 'Silabus BD', 'UMIBA', 'Audiensi', 'GBKP Moria'
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,                  -- Lokasi fisik atau Link (Zoom/Gmeet)
  speaker_name TEXT,
  pic_name TEXT,
  status TEXT DEFAULT 'upcoming', -- 'upcoming', 'ongoing', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS kelas TEXT,            -- 'Offline' atau 'Online'
  ADD COLUMN IF NOT EXISTS jenis_pelatihan TEXT,
  ADD COLUMN IF NOT EXISTS mc TEXT,
  ADD COLUMN IF NOT EXISTS jumlah_peserta INTEGER,
  ADD COLUMN IF NOT EXISTS cv_narasumber_url TEXT,
  ADD COLUMN IF NOT EXISTS link_zoom TEXT,
  ADD COLUMN IF NOT EXISTS link_umkm TEXT,
  ADD COLUMN IF NOT EXISTS caption_sosmed TEXT,
  ADD COLUMN IF NOT EXISTS link_pendaftaran_gform TEXT,
  ADD COLUMN IF NOT EXISTS spreadsheets_data_peserta TEXT,
  ADD COLUMN IF NOT EXISTS poster BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS publikasi BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS terlaksana BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cms BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rb_id BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS up_modul BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cv_expert BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS flyer_sg_feed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS katalog_cv_canva BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS blast_share_wa BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_mentor_modul BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS absen_kehadiran BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS surat_pernyataan BOOLEAN DEFAULT false;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.events;
CREATE POLICY "Enable read access for authenticated users"
  ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for staff only (handled via backend)" ON public.events;
CREATE POLICY "Enable insert for staff only (handled via backend)"
  ON public.events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for staff only" ON public.events;
CREATE POLICY "Enable update for staff only"
  ON public.events FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for staff only" ON public.events;
CREATE POLICY "Enable delete for staff only"
  ON public.events FOR DELETE USING (true);



-- ==============================================================================
-- 10. CHAT — ruang global / divisi / DM
-- Keanggotaan dihitung dari users.divisi & dm_key di backend, bukan tabel
-- terpisah. Ruang divisi dibuat otomatis oleh server saat pertama dibutuhkan.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type       TEXT NOT NULL,                 -- 'global' | 'division' | 'dm'
  name       TEXT,
  division   TEXT,                          -- diisi hanya untuk type='division'
  dm_key     TEXT,                          -- diisi hanya untuk type='dm'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_global_uniq
  ON public.chat_rooms (type) WHERE type = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_division_uniq
  ON public.chat_rooms (division) WHERE type = 'division';
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_dm_uniq
  ON public.chat_rooms (dm_key) WHERE type = 'dm';

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id     UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  sender_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_room_time_idx
  ON public.chat_messages (room_id, created_at);

-- Chat v2: kartu agenda, @mention, forward, edit & hapus pesan
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS msg_type TEXT DEFAULT 'text';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS meta JSONB;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Fitur "Balas" (reply/quote)
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to UUID
  REFERENCES public.chat_messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.chat_reads (
  room_id      UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.chat_rooms    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reads    DISABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 11. PUSH SUBSCRIPTIONS — notifikasi Web Push (bisa beberapa device per user)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);


-- ==============================================================================
-- 12. ACTIVITY LOG — dashboard Monitoring (role 'sistem')
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,                 -- 'login','register','absen_in','error', dst.
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

DROP POLICY IF EXISTS "Service role full access" ON public.activity_log;
CREATE POLICY "Service role full access" ON public.activity_log
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');


-- ==============================================================================
-- 13. STORAGE BUCKETS — semua publik karena backend memakai getPublicUrl()
--   attendance-photos → foto absen & foto profil (avatar)
--   bd-catalog-photos → foto katalog produk UMKM
--   cv_narasumber     → CV narasumber di form event
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('attendance-photos', 'attendance-photos', true),
  ('bd-catalog-photos', 'bd-catalog-photos', true),
  ('cv_narasumber',     'cv_narasumber',     true)
ON CONFLICT (id) DO NOTHING;
