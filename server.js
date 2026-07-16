require('dotenv').config();
const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Inisialisasi Supabase
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_KEY;

const isPlaceholderUrl = !supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE_URL') || !supabaseUrl.startsWith('http');

if (isPlaceholderUrl) {
  console.error('\n========================================================================');
  console.error('⚠️  PERINGATAN: SUPABASE_URL belum dikonfigurasi secara benar di file .env');
  console.error('Silakan buka file .env dan masukkan URL proyek Supabase Anda.');
  console.error('Contoh: SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co');
  console.error('========================================================================\n');
  // Gunakan URL placeholder yang valid agar server tidak crash saat inisialisasi awal
  supabaseUrl = 'https://placeholder-project-id.supabase.co';
}

if (!supabaseKey || supabaseKey.includes('YOUR_SUPABASE_ANON_KEY')) {
  console.error('\n========================================================================');
  console.error('⚠️  PERINGATAN: SUPABASE_KEY belum dikonfigurasi secara benar di file .env');
  console.error('Silakan buka file .env dan masukkan Anon Key proyek Supabase Anda.');
  console.error('========================================================================\n');
  supabaseKey = 'placeholder-key';
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/items - Mengambil semua item atau item per divisi
app.get('/api/items', async (req, res) => {
  const { division } = req.query;
  try {
    let query = supabase.from('items').select('*').order('created_at', { ascending: true });
    
    if (division) {
      query = query.eq('division', division);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Gagal mengambil data dari database' });
  }
});

// GET /api/items/:id - Mengambil satu item berdasarkan ID
app.get('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Item tidak ditemukan' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ error: 'Gagal mengambil data item' });
  }
});

// POST /api/items - Menambahkan item baru
app.post('/api/items', async (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;

  if (!division || !cat || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields (division, cat, title, type)' });
  }

  const newItem = {
    division,
    cat,
    title,
    type,
    note: note || ''
  };

  if (type === 'link') {
    newItem.url = url || '#';
    newItem.email = null;
    newItem.pass = null;
  } else if (type === 'cred') {
    newItem.email = email || '';
    newItem.pass = pass || '';
    newItem.url = null;
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .insert([newItem])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error inserting item:', err);
    res.status(500).json({ error: 'Gagal menyimpan data ke database' });
  }
});

// PUT /api/items/:id - Memperbarui item yang sudah ada
app.put('/api/items/:id', async (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;
  const { id } = req.params;

  try {
    // Ambil item lama untuk validasi tipe
    const { data: currentItem, error: getError } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single();

    if (getError || !currentItem) {
      return res.status(404).json({ error: 'Item tidak ditemukan' });
    }

    const updates = {};
    if (division) updates.division = division;
    if (cat) updates.cat = cat;
    if (title) updates.title = title;
    if (type) updates.type = type;
    if (note !== undefined) updates.note = note;

    const currentType = type || currentItem.type;
    if (currentType === 'link') {
      if (url !== undefined) updates.url = url;
      updates.email = null;
      updates.pass = null;
    } else if (currentType === 'cred') {
      if (email !== undefined) updates.email = email;
      if (pass !== undefined) updates.pass = pass;
      updates.url = null;
    }

    const { data, error } = await supabase
      .from('items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Gagal memperbarui data di database' });
  }
});

// DELETE /api/items/:id - Menghapus item
app.delete('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Gagal menghapus data dari database' });
  }
});

// Route khusus untuk dashboard manage
app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// Menjalankan Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
