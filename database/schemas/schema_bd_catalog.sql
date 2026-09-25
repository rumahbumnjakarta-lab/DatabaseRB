-- ==============================================================================
-- RUMAH BUMN JAKARTA — DATABASE SCHEMA
-- Divisi: Business Development
-- Table: bd_catalog
-- Deskripsi: Katalog produk UMKM binaan — nama UMKM, kontak, dan link foto katalog.
-- Kategori bersifat bebas (teks) — kategori baru otomatis muncul begitu dipakai
-- di salah satu entri, tidak perlu dikelola terpisah.
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

-- Untuk tabel yang sudah dibuat sebelum kolom ini ada (aman dijalankan berkali-kali)
ALTER TABLE public.bd_catalog ADD COLUMN IF NOT EXISTS tanggal_display date;

CREATE INDEX IF NOT EXISTS idx_bd_catalog_kategori ON public.bd_catalog(kategori);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

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
