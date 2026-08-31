-- ==============================================================================
-- RUMAH BUMN JAKARTA — SCHEMA CHAT v2
-- Menambahkan: kartu Agenda, tag/@mention, forward, edit & hapus pesan.
-- Jalankan SETELAH schema_chat.sql (aman dijalankan berkali-kali — semua
-- kolom pakai IF NOT EXISTS).
-- Buka Supabase Dashboard -> SQL Editor -> Tempel & Run query di bawah ini.
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
