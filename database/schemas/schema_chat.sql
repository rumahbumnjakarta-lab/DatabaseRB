-- ==============================================================================
-- RUMAH BUMN JAKARTA — SCHEMA CHAT
-- Buka Supabase Dashboard -> SQL Editor -> Tempel & Run query di bawah ini.
--
-- Model ruang obrolan (chat_rooms.type):
--   'global'   → satu ruang berisi SEMUA anggota (lintas divisi)
--   'division' → satu ruang per divisi, anggotanya user dengan divisi tsb
--   'dm'       → obrolan pribadi antara 2 orang
--
-- Keanggotaan TIDAK disimpan di tabel terpisah — ditentukan dari kolom
-- users.divisi (untuk 'division') dan dm_key (untuk 'dm'), lalu diperiksa
-- di backend Express. Ini menjaga keanggotaan selalu sinkron saat divisi
-- seorang user diubah lewat menu Kelola.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type       TEXT NOT NULL,                 -- 'global' | 'division' | 'dm'
  name       TEXT,                          -- nama tampilan (global/division)
  division   TEXT,                          -- diisi hanya untuk type='division'
  dm_key     TEXT,                          -- diisi hanya untuk type='dm'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cegah ruang ganda: hanya boleh ada 1 ruang global, 1 per divisi, 1 per pasangan DM.
-- Untuk global: semua baris yang cocok predikat pasti bernilai type='global',
-- jadi indeks unik pada kolom type membatasi jumlahnya menjadi tepat satu.
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

-- Query utama: ambil pesan sebuah ruang berurutan waktu, dan cek pesan baru.
CREATE INDEX IF NOT EXISTS chat_messages_room_time_idx
  ON public.chat_messages (room_id, created_at);

-- Penanda "sudah dibaca sampai kapan" per user per ruang (untuk badge belum dibaca).
CREATE TABLE IF NOT EXISTS public.chat_reads (
  room_id      UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- Otorisasi ditangani backend Express (memakai service role key), samakan
-- dengan tabel lain di aplikasi ini.
ALTER TABLE public.chat_rooms    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reads    DISABLE ROW LEVEL SECURITY;
