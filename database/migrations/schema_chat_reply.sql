-- Fitur "Balas" (reply/quote) di chat — jalankan di Supabase SQL Editor
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;
