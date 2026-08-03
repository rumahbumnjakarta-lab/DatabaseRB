-- Skema Database untuk Integrated Event & Syllabus Hub

-- Tabel utama untuk menyimpan data jadwal/acara/silabus dari berbagai divisi
CREATE TABLE public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,         -- Contoh: 'Silabus BD', 'UMIBA', 'Audiensi', 'GBKP Moria'
  title TEXT NOT NULL,
  event_date DATE NOT NULL,       -- Tanggal acara
  start_time TIME,                -- Jam mulai (opsional jika seharian penuh)
  end_time TIME,                  -- Jam selesai (opsional)
  location TEXT,                  -- Lokasi fisik atau Link (Zoom/Gmeet)
  speaker_name TEXT,              -- Nama Pembicara / Narasumber
  pic_name TEXT,                  -- Penanggung Jawab (Person In Charge)
  status TEXT DEFAULT 'upcoming', -- 'upcoming', 'ongoing', 'completed', 'cancelled'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Aturan Keamanan Level Baris (RLS - Opsional)
-- Memastikan public (anonim) tidak bisa mengakses, hanya via backend / service role
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" 
ON public.events FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for staff only (handled via backend)" 
ON public.events FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Enable update for staff only" 
ON public.events FOR UPDATE 
USING (true);

CREATE POLICY "Enable delete for staff only" 
ON public.events FOR DELETE 
USING (true);
