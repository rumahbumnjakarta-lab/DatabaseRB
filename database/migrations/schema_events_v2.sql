-- Jalankan perintah ini di Supabase SQL Editor untuk menambahkan kolom baru
-- ke tabel events yang sudah ada.

ALTER TABLE public.events
  -- Dropdown Baru
  ADD COLUMN IF NOT EXISTS kelas TEXT, -- 'Offline' atau 'Online'
  ADD COLUMN IF NOT EXISTS jenis_pelatihan TEXT, -- 'Literasi Bisnis', dsb.
  
  -- Teks & Link Baru
  ADD COLUMN IF NOT EXISTS mc TEXT,
  ADD COLUMN IF NOT EXISTS jumlah_peserta INTEGER,
  ADD COLUMN IF NOT EXISTS cv_narasumber_url TEXT,
  ADD COLUMN IF NOT EXISTS link_zoom TEXT,
  ADD COLUMN IF NOT EXISTS link_umkm TEXT,
  ADD COLUMN IF NOT EXISTS caption_sosmed TEXT,
  ADD COLUMN IF NOT EXISTS link_pendaftaran_gform TEXT,
  ADD COLUMN IF NOT EXISTS spreadsheets_data_peserta TEXT,
  
  -- Checkboxes (Boolean)
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
