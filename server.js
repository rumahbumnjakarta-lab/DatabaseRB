require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const session = require('cookie-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

// ─── Supabase Init ───────────────────────────────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const isInvalidUrl = !supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE') || !supabaseUrl.startsWith('http');
const isInvalidKey = !supabaseKey || supabaseKey.includes('YOUR_SUPABASE');

if (isInvalidUrl || isInvalidKey) {
  console.error('\n========================================================================');
  console.error('ERROR: SUPABASE_URL dan SUPABASE_KEY wajib dikonfigurasi di file .env');
  console.error('Buka Supabase Dashboard → Settings → API, lalu salin URL dan API key.');
  console.error('========================================================================\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function mapDbError(err, fallback) {
  if (!err) return fallback;
  const code = err.code || '';
  const message = (err.message || '').toLowerCase();

  if (code === '23505' || message.includes('duplicate') || message.includes('unique')) {
    return 'Email sudah terdaftar.';
  }
  if (code === '42P01' || message.includes('does not exist')) {
    return 'Tabel users belum dibuat di Supabase. Hubungi administrator.';
  }
  if (code === '42501' || message.includes('permission denied') || message.includes('row-level security')) {
    return 'Akses database ditolak. Tambahkan SUPABASE_SERVICE_ROLE_KEY di .env atau perbaiki RLS policy tabel users.';
  }
  if (message.includes('fetch failed') || message.includes('network') || message.includes('enotfound')) {
    return 'Koneksi ke database gagal. Periksa internet dan konfigurasi Supabase.';
  }

  return fallback;
}

async function verifySupabaseConnection() {
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    console.error('⚠️  Supabase gagal diakses:', error.message);
    if (error.code === '42P01') {
      console.error('   → Buat tabel "users" di Supabase terlebih dahulu.');
    }
    if (error.code === '42501') {
      console.error('   → Nonaktifkan RLS di tabel users, atau set SUPABASE_SERVICE_ROLE_KEY di .env.');
    }
    return false;
  }
  console.log('✅ Supabase terhubung.');
  return true;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Session (Stateless Cookie-based Session for Serverless / Vercel compatibility)
app.use(session({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'rumahbumn-super-secret-session-key-2024']
  // maxAge tidak diset, sehingga session akan hilang otomatis saat tab/browser ditutup (Session Cookie)
}));

// ─── Perpanjang Sesi (Auto-Rolling) ───────────────────────────────────────────
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    // Abaikan rute polling background agar tidak memperpanjang sesi secara tidak sengaja
    if (!req.path.includes('/api/absen/today') && !req.path.includes('/api/absen?date')) {
      req.session.lastActive = Date.now();
    }
  }
  next();
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized', redirect: '/login.html' });
  }
  res.redirect('/login.html');
}

function requireStaff(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'staff') return next();
  if (req.path.startsWith('/api/')) {
    return res.status(403).json({ error: 'Forbidden: Staff only' });
  }
  res.redirect('/index.html?error=forbidden');
}

// ─── Auth API Routes ─────────────────────────────────────────────────────────

app.post('/auth/register', async (req, res) => {
  const isStaff = req.session && req.session.user && req.session.user.role === 'staff';
  try {
    const { count } = await supabase.from('users').select('id', { count: 'exact', head: true });
    if (count && count > 0 && !isStaff) {
      return res.status(403).json({ error: 'Registrasi hanya dapat dilakukan oleh akun Staff.' });
    }
  } catch (e) {
    if (!isStaff) return res.status(403).json({ error: 'Unauthorized' });
  }
  const { email, name, password, divisi } = req.body;
  const cleanName = (name || '').trim();
  const cleanDivisi = (divisi || '').trim();

  if (!email || !password || !cleanName || !cleanDivisi) {
    return res.status(400).json({ error: 'Semua kolom wajib diisi (termasuk divisi).' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  let role = '';

  // Penentuan Role otomatis berdasarkan domain
  if (cleanEmail.endsWith('@intern.rbjakarta.id')) {
    role = 'internship';
  } else if (cleanEmail.endsWith('@staff.rbjakarta.id')) {
    role = 'staff';
  } else {
    return res.status(400).json({ error: 'Domain email tidak valid. Gunakan email @intern.rbjakarta.id atau @staff.rbjakarta.id.' });
  }

  try {
    // Cek apakah email sudah terdaftar
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking user:', checkError);
      const message = mapDbError(checkError, 'Gagal memeriksa email.');
      return res.status(500).json({ error: message });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { error } = await supabase.from('users').insert({
      email: cleanEmail,
      name: cleanName,
      role,
      password_hash,
      divisi: cleanDivisi
    });

    if (error) {
      console.error('Registration insert error:', error);
      const message = mapDbError(error, 'Gagal melakukan registrasi.');
      const status = error.code === '23505' ? 400 : 500;
      return res.status(status).json({ error: message });
    }

    res.status(201).json({ message: 'Registrasi berhasil. Silakan login.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: mapDbError(err, 'Gagal melakukan registrasi.') });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', cleanEmail).single();
    if (error || !user) {
      return res.status(401).json({ error: 'Email tidak ditemukan.' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Akun ini tidak memiliki kata sandi. Silakan hubungi administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Kata sandi salah.' });
    }

    // Simpan ke session
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar_url
    };

    res.json({ message: 'Login berhasil.', redirect: '/index.html' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

app.get('/auth/logout', (req, res) => {
  req.session = null;
  res.redirect('/login.html');
});

// ─── API: Cek session user saat ini ──────────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      loggedIn: true,
      name: req.session.user.name,
      email: req.session.user.email,
      role: req.session.user.role,
      avatar: req.session.user.avatar
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// POST /api/user/profile — Update profile name & photo
app.post('/api/user/profile', requireAuth, async (req, res) => {
  const { name, avatar_base64 } = req.body;
  const user = req.session.user;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nama tidak boleh kosong.' });
  }

  try {
    let avatar_url = user.avatar || null;

    // Upload avatar to Supabase Storage if provided
    if (avatar_base64) {
      const base64Data = avatar_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `avatars/${user.id}.jpg`;

      // Upload and overwrite
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError.message);
        throw uploadError;
      }

      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('attendance-photos')
          .getPublicUrl(fileName);
        // Force refresh URL by appending timestamp to bypass browser cache
        avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;
      }
    }

    // Update user in Database
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ name: name.trim(), avatar_url })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update session
    req.session.user.name = updatedUser.name;
    req.session.user.avatar = updatedUser.avatar_url;

    res.json({
      message: 'Profil berhasil diperbarui!',
      user: {
        name: updatedUser.name,
        avatar: updatedUser.avatar_url
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Gagal memperbarui profil: ' + err.message });
  }
});


// ─── API: Users Management (Staff Only) ───────────────────────────────────────

// GET /api/users — List all user accounts
app.get('/api/users', requireAuth, requireStaff, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, avatar_url, created_at')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Gagal mengambil data akun: ' + err.message });
  }
});

// PUT /api/users/:id — Edit account details
app.put('/api/users/:id', requireAuth, requireStaff, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, divisi } = req.body;
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanDivisi = (divisi || '').trim();

  if (!cleanName || !cleanEmail || !role || !cleanDivisi) {
    return res.status(400).json({ error: 'Nama, email, role, dan divisi wajib diisi.' });
  }

  try {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ name: cleanName, email: cleanEmail, role, divisi: cleanDivisi })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If editing currently logged-in user, update session
    if (req.session.user.id === id) {
      req.session.user.name = updatedUser.name;
      req.session.user.email = updatedUser.email;
      req.session.user.role = updatedUser.role;
    }

    res.json({ message: 'Akun berhasil diperbarui!', user: updatedUser });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Gagal memperbarui akun: ' + err.message });
  }
});

// DELETE /api/users/:id — Delete account
app.delete('/api/users/:id', requireAuth, requireStaff, async (req, res) => {
  const { id } = req.params;

  if (req.session.user.id === id) {
    return res.status(400).json({ error: 'Anda tidak bisa menghapus akun Anda sendiri.' });
  }

  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Akun berhasil dihapus!' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Gagal menghapus akun: ' + err.message });
  }
});


// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/vendor/lucide', express.static(path.join(__dirname, 'node_modules/lucide/dist/umd')));
app.use('/vendor/aos', express.static(path.join(__dirname, 'node_modules/aos/dist')));
app.use('/vendor/sweetalert2', express.static(path.join(__dirname, 'node_modules/sweetalert2/dist')));
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules/gsap/dist')));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ─── Protected HTML Pages ─────────────────────────────────────────────────────
app.get('/manage', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});
app.get('/manage.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});
app.get('/manage-users', requireAuth, requireStaff, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage-users.html'));
});
app.get('/manage-users.html', requireAuth, requireStaff, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage-users.html'));
});
app.get('/agenda-hub.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'agenda-hub.html'));
});

// ─── API: Items (CRUD) — Memerlukan Login ─────────────────────────────────────
// GET /api/items — Semua user yang login bisa baca
app.get('/api/items', requireAuth, async (req, res) => {
  const { division } = req.query;
  try {
    let query = supabase.from('items').select('*').order('created_at', { ascending: true });
    if (division) query = query.eq('division', division);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ error: 'Gagal mengambil data dari database' });
  }
});

// GET /api/items/:id
app.get('/api/items/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('items').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Item tidak ditemukan' });
      throw error;
    }
    res.json(data);
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ error: 'Gagal mengambil data item' });
  }
});

// POST /api/items — Hanya Staff (atau Intern untuk divisi non-staff)
app.post('/api/items', requireAuth, async (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;
  if (!division || !cat || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields (division, cat, title, type)' });
  }

  // Check permission: Interns can't write to administrasi/email
  const isStaff = req.session.user.role === 'staff';
  const staffOnlyDivisions = ['administrasi', 'email'];
  if (!isStaff && staffOnlyDivisions.includes(division)) {
    return res.status(403).json({ error: 'Forbidden: Intern tidak bisa mengelola divisi ini' });
  }

  const newItem = { division, cat, title, type, note: note || '' };
  if (type === 'link') { newItem.url = url || '#'; newItem.email = null; newItem.pass = null; }
  else if (type === 'cred') { newItem.email = email || ''; newItem.pass = pass || ''; newItem.url = null; }
  try {
    const { data, error } = await supabase.from('items').insert([newItem]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error inserting item:', err);
    res.status(500).json({ error: 'Gagal menyimpan data ke database' });
  }
});

// PUT /api/items/:id — Hanya Staff (atau Intern untuk divisi non-staff)
app.put('/api/items/:id', requireAuth, async (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;
  const { id } = req.params;
  const isStaff = req.session.user.role === 'staff';
  const staffOnlyDivisions = ['administrasi', 'email'];

  try {
    const { data: currentItem, error: getError } = await supabase
      .from('items').select('*').eq('id', id).single();
    if (getError || !currentItem) return res.status(404).json({ error: 'Item tidak ditemukan' });

    // Check permission for current item division
    if (!isStaff && staffOnlyDivisions.includes(currentItem.division)) {
      return res.status(403).json({ error: 'Forbidden: Intern tidak bisa mengubah item divisi ini' });
    }

    // Check permission for target division
    if (division && !isStaff && staffOnlyDivisions.includes(division)) {
      return res.status(403).json({ error: 'Forbidden: Intern tidak bisa mengubah item ke divisi ini' });
    }

    const updates = {};
    if (division) updates.division = division;
    if (cat) updates.cat = cat;
    if (title) updates.title = title;
    if (type) updates.type = type;
    if (note !== undefined) updates.note = note;
    const currentType = type || currentItem.type;
    if (currentType === 'link') { if (url !== undefined) updates.url = url; updates.email = null; updates.pass = null; }
    else if (currentType === 'cred') { if (email !== undefined) updates.email = email; if (pass !== undefined) updates.pass = pass; updates.url = null; }
    const { data, error } = await supabase.from('items').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating item:', err);
    res.status(500).json({ error: 'Gagal memperbarui data di database' });
  }
});

// DELETE /api/items/:id — Hanya Staff (atau Intern untuk divisi non-staff)
app.delete('/api/items/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const isStaff = req.session.user.role === 'staff';
  const staffOnlyDivisions = ['administrasi', 'email'];
  try {
    const { data: currentItem, error: getError } = await supabase
      .from('items').select('*').eq('id', id).single();
    if (getError || !currentItem) return res.status(404).json({ error: 'Item tidak ditemukan' });

    // Check permission for existing item division
    if (!isStaff && staffOnlyDivisions.includes(currentItem.division)) {
      return res.status(403).json({ error: 'Forbidden: Intern tidak bisa menghapus item divisi ini' });
    }

    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Gagal menghapus data dari database' });
  }
});

// ─── API: Events (Syllabus & Agenda Hub) ────────────────────────────────────

// GET /api/events/upcoming — Mengambil daftar acara hari ini dan ke depan (Staff & Intern)
app.get('/api/events/upcoming', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });
      
    if (error) {
      if (error.code === '42P01') return res.status(200).json([]); // Tabel belum ada
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching upcoming events:', err);
    res.status(500).json({ error: 'Gagal mengambil data acara.' });
  }
});

// GET /api/events/today — Mengambil acara spesifik hari ini (Staff & Intern)
app.get('/api/events/today', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('event_date', today)
      .order('start_time', { ascending: true });
      
    if (error) {
      if (error.code === '42P01') return res.status(200).json([]); // Tabel belum ada
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching today events:', err);
    res.status(500).json({ error: 'Gagal mengambil data acara hari ini.' });
  }
});

// GET /api/events/archive — Mengambil semua riwayat acara masa lalu (Staff Only)
app.get('/api/events/archive', requireAuth, requireStaff, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .lt('event_date', today)
      .order('event_date', { ascending: false });
      
    if (error) {
      if (error.code === '42P01') return res.status(200).json([]); // Tabel belum ada
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching archived events:', err);
    res.status(500).json({ error: 'Gagal mengambil arsip acara.' });
  }
});

// GET /api/events/month — Mengambil semua acara pada bulan & tahun tertentu
app.get('/api/events/month', requireAuth, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'Year and month required' });
  
  try {
    // start of month: YYYY-MM-01
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    // end of month:
    const endObj = new Date(year, month, 0); // last day of the month
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', start)
      .lte('event_date', end)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });
      
    if (error) {
      if (error.code === '42P01') return res.status(200).json([]);
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching month events:', err);
    res.status(500).json({ error: 'Gagal mengambil data acara bulan ini.' });
  }
});

// POST /api/events — Menambah acara baru (Staff Only)
app.post('/api/events', requireAuth, requireStaff, upload.single('cvNarsum'), async (req, res) => {
  const { 
    category, title, event_date, start_time, end_time, location, speaker_name, pic_name,
    kelas, jenis_pelatihan, mc, jumlah_peserta,
    link_zoom, link_umkm, caption_sosmed, link_pendaftaran_gform, spreadsheets_data_peserta
  } = req.body;
  
  if (!category || !title || !event_date) {
    return res.status(400).json({ error: 'Kategori, Judul, dan Tanggal acara wajib diisi.' });
  }
  
  let cvUrl = null;
  if (req.file) {
    try {
      const { originalname, buffer, mimetype } = req.file;
      const filename = `${Date.now()}_${originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { data, error } = await supabase.storage.from('cv_narasumber').upload(filename, buffer, { contentType: mimetype });
      if (error) {
        console.error("Storage Error:", error);
        return res.status(500).json({ error: 'Gagal mengunggah CV: ' + error.message });
      }
      const { data: publicUrlData } = supabase.storage.from('cv_narasumber').getPublicUrl(filename);
      cvUrl = publicUrlData.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: 'Terjadi kesalahan saat mengunggah CV.' });
    }
  }

  // Parse booleans
  const parseBool = (val) => val === 'true' || val === 'on' || val === true;

  const newEvent = {
    category,
    title,
    event_date,
    start_time: start_time || null,
    end_time: end_time || null,
    location: location || null,
    speaker_name: speaker_name || null,
    pic_name: pic_name || null,
    kelas: kelas || null,
    jenis_pelatihan: jenis_pelatihan || null,
    mc: mc || null,
    jumlah_peserta: jumlah_peserta ? parseInt(jumlah_peserta, 10) : null,
    cv_narasumber_url: cvUrl,
    link_zoom: link_zoom || null,
    link_umkm: link_umkm || null,
    caption_sosmed: caption_sosmed || null,
    link_pendaftaran_gform: link_pendaftaran_gform || null,
    spreadsheets_data_peserta: spreadsheets_data_peserta || null,
    poster: parseBool(req.body.poster),
    publikasi: parseBool(req.body.publikasi),
    terlaksana: parseBool(req.body.terlaksana),
    cms: parseBool(req.body.cms),
    rb_id: parseBool(req.body.rb_id),
    up_modul: parseBool(req.body.up_modul),
    cv_expert: parseBool(req.body.cv_expert),
    flyer_sg_feed: parseBool(req.body.flyer_sg_feed),
    katalog_cv_canva: parseBool(req.body.katalog_cv_canva),
    blast_share_wa: parseBool(req.body.blast_share_wa),
    data_mentor_modul: parseBool(req.body.data_mentor_modul),
    follow_up: parseBool(req.body.follow_up),
    absen_kehadiran: parseBool(req.body.absen_kehadiran),
    surat_pernyataan: parseBool(req.body.surat_pernyataan),
    status: 'upcoming'
  };
  
  try {
    const { data, error } = await supabase.from('events').insert([newEvent]).select().single();
    if (error) {
      if (error.code === '42P01') {
        return res.status(400).json({ error: 'Tabel "events" belum dibuat di database Supabase.' });
      }
      throw error;
    }
    res.status(201).json({ message: 'Acara berhasil ditambahkan!', data });
  } catch (err) {
    console.error('Error inserting event:', err);
    res.status(500).json({ error: 'Gagal menyimpan data acara.' });
  }
});

// PUT /api/events/:id/checklist — Memperbarui checklist acara (Staff Only)
app.put('/api/events/:id/checklist', requireAuth, requireStaff, async (req, res) => {
  const eventId = req.params.id;
  const parseBool = (val) => val === 'true' || val === 'on' || val === true;

  const updatedChecklist = {
    poster: parseBool(req.body.poster),
    publikasi: parseBool(req.body.publikasi),
    terlaksana: parseBool(req.body.terlaksana),
    cms: parseBool(req.body.cms),
    rb_id: parseBool(req.body.rb_id),
    up_modul: parseBool(req.body.up_modul),
    cv_expert: parseBool(req.body.cv_expert),
    flyer_sg_feed: parseBool(req.body.flyer_sg_feed),
    katalog_cv_canva: parseBool(req.body.katalog_cv_canva),
    blast_share_wa: parseBool(req.body.blast_share_wa),
    data_mentor_modul: parseBool(req.body.data_mentor_modul),
    follow_up: parseBool(req.body.follow_up),
    absen_kehadiran: parseBool(req.body.absen_kehadiran),
    surat_pernyataan: parseBool(req.body.surat_pernyataan)
  };

  try {
    const { data, error } = await supabase
      .from('events')
      .update(updatedChecklist)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return res.status(500).json({ error: error.message || 'Gagal memperbarui checklist acara.' });
    }
    res.json({ message: 'Checklist berhasil diperbarui', data });
  } catch (err) {
    console.error('Error updating checklist:', err);
    res.status(500).json({ error: err.message || 'Gagal memperbarui checklist acara.' });
  }
});

// ─── Content Planner API (Sosmed) ─────────────────────────────────────────────

// GET /api/content-plans — Ambil content plans (filter by month/year)
app.get('/api/content-plans', requireAuth, async (req, res) => {
  const { year, month } = req.query;
  try {
    let query = supabase.from('content_plans').select('*').order('publish_date', { ascending: true });
    if (year && month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const endObj = new Date(year, month, 0);
      const end = `${year}-${String(month).padStart(2, '0')}-${String(endObj.getDate()).padStart(2, '0')}`;
      query = query.gte('publish_date', start).lte('publish_date', end);
    }
    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01') return res.status(200).json([]);
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching content plans:', err);
    res.status(500).json({ error: 'Gagal mengambil data content plan.' });
  }
});

// POST /api/content-plans — Buat content plan baru
app.post('/api/content-plans', requireAuth, async (req, res) => {
  const { title, platform, content_type, publish_date, caption, notes } = req.body;
  if (!title || !platform || !publish_date) {
    return res.status(400).json({ error: 'Judul, platform, dan tanggal publish wajib diisi.' });
  }
  const newPlan = {
    title, platform, content_type: content_type || null,
    publish_date, caption: caption || null, notes: notes || null,
    status: 'draft',
    created_by: req.session.user.name || req.session.user.email
  };
  try {
    const { data, error } = await supabase.from('content_plans').insert([newPlan]).select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Content plan berhasil ditambahkan!', data });
  } catch (err) {
    console.error('Error inserting content plan:', err);
    res.status(500).json({ error: err.message || 'Gagal menyimpan content plan.' });
  }
});

// PUT /api/content-plans/:id — Update content plan
app.put('/api/content-plans/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { title, platform, content_type, publish_date, caption, notes, status } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (platform !== undefined) updates.platform = platform;
  if (content_type !== undefined) updates.content_type = content_type;
  if (publish_date !== undefined) updates.publish_date = publish_date;
  if (caption !== undefined) updates.caption = caption;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;
  try {
    const { data, error } = await supabase.from('content_plans').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ message: 'Content plan berhasil diperbarui.', data });
  } catch (err) {
    console.error('Error updating content plan:', err);
    res.status(500).json({ error: err.message || 'Gagal memperbarui content plan.' });
  }
});

// DELETE /api/content-plans/:id — Hapus content plan
app.delete('/api/content-plans/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('content_plans').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Content plan berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting content plan:', err);
    res.status(500).json({ error: 'Gagal menghapus content plan.' });
  }
});

// ─── Design Request API ──────────────────────────────────────────────────────

// GET /api/design-requests — Ambil design requests
app.get('/api/design-requests', requireAuth, async (req, res) => {
  const { status: filterStatus } = req.query;
  try {
    let query = supabase.from('design_requests').select('*').order('created_at', { ascending: false });
    if (filterStatus) query = query.eq('status', filterStatus);
    const { data, error } = await query;
    if (error) {
      if (error.code === '42P01') return res.status(200).json([]);
      throw error;
    }
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching design requests:', err);
    res.status(500).json({ error: 'Gagal mengambil data design request.' });
  }
});

// POST /api/design-requests — Submit design request baru (dari semua divisi)
app.post('/api/design-requests', requireAuth, async (req, res) => {
  const { design_type, title, description, deadline, priority, requester_division } = req.body;
  if (!design_type || !title || !requester_division) {
    return res.status(400).json({ error: 'Jenis desain, judul, dan divisi pemohon wajib diisi.' });
  }
  const newRequest = {
    requester_name: req.session.user.name || req.session.user.email,
    requester_division,
    design_type, title,
    description: description || null,
    deadline: deadline || null,
    priority: priority || 'normal',
    status: 'pending'
  };
  try {
    const { data, error } = await supabase.from('design_requests').insert([newRequest]).select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Design request berhasil diajukan!', data });
  } catch (err) {
    console.error('Error inserting design request:', err);
    res.status(500).json({ error: err.message || 'Gagal mengajukan design request.' });
  }
});

// PUT /api/design-requests/:id/status — Update status request (Staff/Design team)
app.put('/api/design-requests/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, designer_notes } = req.body;
  if (!status) return res.status(400).json({ error: 'Status wajib diisi.' });
  const updates = { status };
  if (designer_notes !== undefined) updates.designer_notes = designer_notes;
  if (status === 'done') updates.completed_at = new Date().toISOString();
  try {
    const { data, error } = await supabase.from('design_requests').update(updates).eq('id', id).select().single();
    if (error) throw error;
    res.json({ message: 'Status request berhasil diperbarui.', data });
  } catch (err) {
    console.error('Error updating design request:', err);
    res.status(500).json({ error: err.message || 'Gagal memperbarui status request.' });
  }
});

// ─── Business Development Partnerships API ──────────────────────────────────────

// GET /api/bd-partnerships — Ambil data outreach/partnership
app.get('/api/bd-partnerships', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bd_partnerships')
      .select(`
        *,
        users ( name, divisi )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedData = data.map(item => ({
      ...item,
      created_by_name: item.users ? item.users.name : 'Unknown',
      created_by_division: item.users ? item.users.divisi : ''
    }));
    res.json(formattedData);
  } catch (err) {
    console.error('Error fetching bd partnerships:', err);
    res.status(500).json({ error: 'Gagal mengambil data bd partnerships' });
  }
});

// POST /api/bd-partnerships — Buat data baru
app.post('/api/bd-partnerships', requireAuth, async (req, res) => {
  const {
    tanggal_dihubungi, tanggal_kerjasama, nama_komunitas, linkedin,
    instagram, email, kontak_komunitas, nama_cp, kontak_cp,
    jumlah_anggota, status, via, template_approach
  } = req.body;
  
  if (!tanggal_dihubungi || !nama_komunitas) {
    return res.status(400).json({ error: 'Tanggal Dihubungi dan Nama Komunitas wajib diisi' });
  }

  try {
    const { data, error } = await supabase
      .from('bd_partnerships')
      .insert([{
        tanggal_dihubungi,
        tanggal_kerjasama: tanggal_kerjasama || null,
        nama_komunitas,
        linkedin,
        instagram,
        email,
        kontak_komunitas,
        nama_cp,
        kontak_cp,
        jumlah_anggota,
        status: status || 'Approach',
        via,
        template_approach,
        created_by: req.session.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error creating bd partnership:', err);
    res.status(500).json({ error: 'Gagal membuat data bd partnership' });
  }
});

// PUT /api/bd-partnerships/:id — Update data
app.put('/api/bd-partnerships/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  if (updates.tanggal_kerjasama === "") updates.tanggal_kerjasama = null;

  try {
    const { data, error } = await supabase
      .from('bd_partnerships')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating bd partnership:', err);
    res.status(500).json({ error: 'Gagal update data bd partnership' });
  }
});

// DELETE /api/bd-partnerships/:id — Hapus data
app.delete('/api/bd-partnerships/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('bd_partnerships')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting bd partnership:', err);
    res.status(500).json({ error: 'Gagal menghapus data bd partnership' });
  }
});

// ─── Attendance / Absen API ───────────────────────────────────────────────────

// --- Geofencing Target ---
const TARGET_LAT = -6.185582350879704;
const TARGET_LNG = 106.79652101747172;
const MAX_RADIUS = 50; // meters

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(dp/2) * Math.sin(dp/2) +
            Math.cos(p1) * Math.cos(p2) *
            Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

// POST /api/absen — Submit absensi (semua user yang login)
app.post('/api/absen', requireAuth, async (req, res) => {
  const { type, photo_base64, latitude, longitude, address } = req.body;
  const user = req.session.user;

  if (!type || !['clock_in', 'clock_out'].includes(type)) {
    return res.status(400).json({ error: 'Tipe absen tidak valid.' });
  }
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Data GPS diperlukan untuk absensi.' });
  }

  // Validasi Geofencing
  const distance = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);
  if (distance > MAX_RADIUS) {
    return res.status(403).json({ error: `Absensi ditolak: Anda berada ${distance} meter di luar area kantor (Maksimal ${MAX_RADIUS}m).` });
  }

  try {
    let photo_url = null;

    // Upload foto ke Supabase Storage jika ada
    if (photo_base64) {
      const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `absen/${user.id}/${Date.now()}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: false });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('attendance-photos')
          .getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      } else {
        console.warn('Photo upload failed:', uploadError?.message);
        // Simpan base64 langsung jika storage gagal
        photo_url = photo_base64.substring(0, 500); // truncate for safety
      }
    }

    const { data, error } = await supabase.from('attendance').insert([{
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      user_role: user.role,
      type,
      photo_url,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || null,
    }]).select().single();

    if (error) throw error;
    res.status(201).json({ message: `Absensi ${type === 'clock_in' ? 'Clock In' : 'Clock Out'} berhasil!`, data });
  } catch (err) {
    console.error('Absen error:', err);
    res.status(500).json({ error: 'Gagal menyimpan absensi: ' + err.message });
  }
});

async function attachUserAvatars(attendanceRecords) {
  if (!attendanceRecords || !attendanceRecords.length) return attendanceRecords;
  try {
    const userIds = [...new Set(attendanceRecords.map(r => r.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, name, avatar_url, divisi').in('id', userIds);
      if (users && users.length) {
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });
        return attendanceRecords.map(r => ({
          ...r,
          user_name: userMap[r.user_id] ? userMap[r.user_id].name : 'Unknown',
          user_division: userMap[r.user_id] ? userMap[r.user_id].divisi : 'Unknown',
          user_avatar: userMap[r.user_id]?.avatar_url || r.user_avatar || null
        }));
      }
    }
  } catch (e) {
    console.warn('Could not attach user avatars:', e.message);
  }
  return attendanceRecords;
}

// GET /api/absen/today — Absensi hari ini (realtime)
app.get('/api/absen/today', requireAuth, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    let query = supabase.from('attendance')
      .select('*')
      .gte('timestamp', today.toISOString())
      .lt('timestamp', tomorrow.toISOString())
      .order('timestamp', { ascending: false });

    // Internship hanya bisa lihat punya sendiri
    if (req.session.user.role !== 'staff') {
      query = query.eq('user_id', req.session.user.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    const enrichedData = await attachUserAvatars(data || []);
    res.json(enrichedData);
  } catch (err) {
    console.error('Error fetching today absen:', err);
    res.status(500).json({ error: 'Gagal mengambil data absensi.' });
  }
});

// GET /api/absen — Rekap absensi (Staff only, filter tanggal)
app.get('/api/absen', requireAuth, requireStaff, async (req, res) => {
  const { date, user_id } = req.query;
  try {
    let query = supabase.from('attendance').select('*').order('timestamp', { ascending: false });

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query = query.gte('timestamp', start.toISOString()).lte('timestamp', end.toISOString());
    }
    if (user_id) query = query.eq('user_id', user_id);

    const { data, error } = await query.limit(200);
    if (error) throw error;
    const enrichedData = await attachUserAvatars(data || []);
    res.json(enrichedData);
  } catch (err) {
    console.error('Error fetching absen:', err);
    res.status(500).json({ error: 'Gagal mengambil data absensi.' });
  }
});

// GET /api/absen/export — Export absensi ke CSV
app.get('/api/absen/export', requireAuth, requireStaff, async (req, res) => {
  try {
    const { data, error } = await supabase.from('attendance').select('*').order('timestamp', { ascending: false });
    if (error) throw error;
    
    const enrichedData = await attachUserAvatars(data || []);
    
    // Build CSV
    const headers = ['Nama', 'Divisi', 'Tanggal & Waktu', 'Tipe', 'Status Lokasi', 'Latitude', 'Longitude'];
    const rows = enrichedData.map(d => {
      const name = d.user_name || 'Unknown';
      const div = d.user_division || 'Unknown';
      const time = new Date(d.timestamp).toLocaleString('id-ID');
      const type = d.type === 'clock_in' ? 'Clock In' : 'Clock Out';
      const loc = d.location_status || 'On-Site';
      return `"${name}","${div}","${time}","${type}","${loc}","${d.latitude}","${d.longitude}"`;
    });
    
    const csvContent = headers.join(',') + '\n' + rows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rekap_absensi.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting absen:', err);
    res.status(500).send('Gagal mengekspor data absensi.');
  }
});

// ─── Perizinan Tidak Masuk (Izin / Sakit) Endpoints ──────────────────────────

// GET /api/permissions — Ambil data perizinan
app.get('/api/permissions', requireAuth, async (req, res) => {
  const { status, user_id } = req.query;
  const isStaff = req.session.user.role === 'staff';

  try {
    let query = supabase.from('permissions').select('*').order('created_at', { ascending: false });

    if (!isStaff) {
      // Intern hanya melihat miliknya sendiri
      query = query.eq('user_id', req.session.user.id);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      const errMsg = (error.message || '').toLowerCase();
      if (error.code === '42P01' || error.code === 'PGRST205' || errMsg.includes('schema cache') || errMsg.includes('does not exist')) {
        return res.status(200).json([]); // Jika tabel permissions belum dibuat di Supabase
      }
      throw error;
    }

    const enrichedData = await attachUserAvatars(data || []);
    res.json(enrichedData);
  } catch (err) {
    console.error('Error fetching permissions:', err);
    res.status(500).json({ error: 'Gagal mengambil data perizinan: ' + err.message });
  }
});

// POST /api/permissions — Ajukan perizinan baru
app.post('/api/permissions', requireAuth, async (req, res) => {
  const { type, start_date, end_date, reason, document_base64 } = req.body;
  const user = req.session.user;

  if (!type || !start_date || !end_date || !reason) {
    return res.status(400).json({ error: 'Jenis izin, tanggal mulai, tanggal selesai, dan alasan wajib diisi.' });
  }

  let document_url = null;

  if (document_base64 && document_base64.startsWith('data:image')) {
    try {
      const mime = document_base64.split(';')[0].split(':')[1] || 'image/jpeg';
      const ext = mime.split('/')[1] || 'jpeg';
      const base64Data = document_base64.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `perm_${user.id}_${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('permission-docs')
        .upload(fileName, buffer, { contentType: mime, upsert: false });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from('permission-docs')
          .getPublicUrl(fileName);
        document_url = urlData.publicUrl;
      } else {
        console.warn('Document storage upload failed, saving base64:', uploadError?.message);
        document_url = document_base64;
      }
    } catch (e) {
      console.warn('Storage processing error:', e.message);
      document_url = document_base64;
    }
  } else if (document_base64) {
    document_url = document_base64;
  }

  const newPermission = {
    user_id: user.id,
    user_name: user.name,
    user_email: user.email,
    user_role: user.role,
    type,
    start_date,
    end_date,
    reason,
    document_url,
    status: 'pending',
    mentor_comment: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase.from('permissions').insert([newPermission]).select().single();
    if (error) {
      const errMsg = (error.message || '').toLowerCase();
      if (error.code === '42P01' || error.code === 'PGRST205' || errMsg.includes('schema cache') || errMsg.includes('does not exist')) {
        return res.status(400).json({ error: 'Tabel "permissions" belum dibuat di database Supabase. Silakan jalankan query di schema_permissions.sql pada Supabase SQL Editor.' });
      }
      throw error;
    }
    res.status(201).json({ message: 'Pengajuan perizinan berhasil dikirim!', data });
  } catch (err) {
    console.error('Error submitting permission:', err);
    res.status(500).json({ error: 'Gagal mengajukan perizinan: ' + err.message });
  }
});

// PUT /api/permissions/:id/status — Staff/Mentor setuju / tolak & beri komentar
app.put('/api/permissions/:id/status', requireAuth, requireStaff, async (req, res) => {
  const { id } = req.params;
  const { status, mentor_comment } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status harus "approved" atau "rejected".' });
  }

  const updates = {
    status,
    mentor_comment: mentor_comment || null,
    reviewed_by: req.session.user.name || req.session.user.email,
    reviewed_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('permissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: `Status perizinan berhasil diperbarui menjadi ${status === 'approved' ? 'Disetujui' : 'Ditolak'}.`, data });
  } catch (err) {
    console.error('Error updating permission status:', err);
    res.status(500).json({ error: 'Gagal memperbarui status perizinan: ' + err.message });
  }
});

// DELETE /api/permissions/:id — Hapus perizinan
app.delete('/api/permissions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const isStaff = req.session.user.role === 'staff';

  try {
    if (!isStaff) {
      // Cek apakah data milik user dan masih pending
      const { data: item } = await supabase.from('permissions').select('user_id, status').eq('id', id).single();
      if (!item || item.user_id !== req.session.user.id) {
        return res.status(403).json({ error: 'Tidak memiliki izin untuk menghapus perizinan ini.' });
      }
      if (item.status !== 'pending') {
        return res.status(400).json({ error: 'Perizinan yang sudah diproses oleh mentor tidak dapat dihapus.' });
      }
    }

    const { error } = await supabase.from('permissions').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'Perizinan berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting permission:', err);
    res.status(500).json({ error: 'Gagal menghapus perizinan: ' + err.message });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
if (process.env.VERCEL) {
  // Untuk Vercel: Export app sebagai serverless function (tidak menggunakan app.listen)
  verifySupabaseConnection().catch(console.error);
  module.exports = app;
} else {
  // Untuk Localhost: Gunakan app.listen
  verifySupabaseConnection().finally(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Server is running at http://localhost:${PORT}`);
      console.log(`   Halaman login: http://localhost:${PORT}/login.html\n`);
    });
  });
}
