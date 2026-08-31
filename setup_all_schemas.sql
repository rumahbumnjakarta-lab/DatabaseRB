-- ==============================================================================
-- RUMAH BUMN JAKARTA — COMBINED DATABASE SCHEMAS
-- Salin seluruh isi query ini dan paste di Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Tambah Kolom Divisi di Tabel Users (Untuk Rekap Absen)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS divisi text;

-- 2. Schema Business Development (Tabel bd_partnerships)
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

-- 3. Schema Sosmed Content Planner (Tabel content_plans)
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

-- 4. Schema Design Requests (Tabel design_requests)
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
-- 5. Schema Fitur Chat Internal
-- ==============================================================================

-- Tabel Ruang Obrolan
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type       TEXT NOT NULL,                 -- 'global' | 'division' | 'dm'
  name       TEXT,                          -- nama tampilan (global/division)
  division   TEXT,                          -- diisi hanya untuk type='division'
  dm_key     TEXT,                          -- diisi hanya untuk type='dm'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Batasan Unik agar tidak ada ruang ganda
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_global_uniq
  ON public.chat_rooms (type) WHERE type = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_division_uniq
  ON public.chat_rooms (division) WHERE type = 'division';
CREATE UNIQUE INDEX IF NOT EXISTS chat_rooms_dm_uniq
  ON public.chat_rooms (dm_key) WHERE type = 'dm';

-- Tabel Pesan Chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id     UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  sender_name TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index mempercepat loading pesan
CREATE INDEX IF NOT EXISTS chat_messages_room_time_idx
  ON public.chat_messages (room_id, created_at);

-- Tabel Notifikasi/Tandai Sudah Dibaca
CREATE TABLE IF NOT EXISTS public.chat_reads (
  room_id      UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- Matikan RLS untuk chat karena diamankan dari sisi backend Express (server.js)
ALTER TABLE public.chat_rooms    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reads    DISABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 6. TAMBAHAN BARU: Chat v2 — kartu Agenda, tag/@mention, forward, edit & hapus
-- Aman dijalankan berkali-kali (semua kolom pakai IF NOT EXISTS). Kalau
-- section 5 di atas sudah pernah dijalankan sebelumnya, cukup jalankan
-- section 6 ini saja.
-- ==============================================================================

-- 'text'   → pesan teks biasa
-- 'agenda' → kartu acara yang dibagikan dari Agenda & Event Hub (detail
--            acaranya disimpan di kolom meta sebagai JSON)
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS msg_type TEXT DEFAULT 'text';

-- Payload tambahan per jenis pesan:
--   agenda   → {"event_id","title","event_date","location","category"}
--   forward  → ditambahkan ke meta pesan apa pun: {"forwarded": true}
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS meta JSONB;

-- user_id anggota yang di-tag pakai @Nama di badan pesan.
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';

-- Diisi saat pesan diedit — dipakai untuk menampilkan label "(diedit)".
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Soft delete: baris tetap ada (supaya urutan & status baca tidak berubah),
-- tapi body dikosongkan di response API dan bubble tampil sebagai
-- "Pesan ini telah dihapus".
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
