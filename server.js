require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Supabase Init ───────────────────────────────────────────────────────────
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_KEY;

const isPlaceholderUrl = !supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE') || !supabaseUrl.startsWith('http');
if (isPlaceholderUrl) {
  console.warn('⚠️  PERINGATAN: SUPABASE_URL belum dikonfigurasi di file .env');
  supabaseUrl = 'https://placeholder-project-id.supabase.co';
}
if (!supabaseKey || supabaseKey.includes('YOUR_SUPABASE')) {
  console.warn('⚠️  PERINGATAN: SUPABASE_KEY belum dikonfigurasi di file .env');
  supabaseKey = 'placeholder-key';
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'rumahbumn-super-secret-session-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    httpOnly: true,
    sameSite: 'lax'
  }
}));

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
  const { email, name, password } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Semua kolom wajib diisi.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  let role = '';

  // Penentuan Role otomatis berdasarkan domain
  if (cleanEmail.endsWith('@intern.rbjakarta.com')) {
    role = 'internship';
  } else if (cleanEmail.endsWith('@staff.rbjakarta.com')) {
    role = 'staff';
  } else {
    return res.status(400).json({ error: 'Domain email tidak valid. Gunakan email @intern.rbjakarta.com atau @staff.rbjakarta.com.' });
  }

  try {
    // Cek apakah email sudah terdaftar
    const { data: existingUser, error: checkError } = await supabase.from('users').select('id').eq('email', cleanEmail).maybeSingle();
    
    if (checkError) {
      console.error('Error checking user:', checkError);
      throw checkError;
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user baru
    const { data: newUser, error } = await supabase.from('users').insert([{
      email: cleanEmail,
      name: name,
      role: role,
      password_hash: password_hash
    }]).select().single();

    if (error) throw error;

    res.status(201).json({ message: 'Registrasi berhasil. Silakan login.' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Gagal melakukan registrasi.' });
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
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
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


// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Protected HTML Pages ─────────────────────────────────────────────────────
app.get('/manage', requireAuth, requireStaff, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});
app.get('/manage.html', requireAuth, requireStaff, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
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

// POST /api/items — Hanya Staff
app.post('/api/items', requireAuth, requireStaff, async (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;
  if (!division || !cat || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields (division, cat, title, type)' });
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

// PUT /api/items/:id — Hanya Staff
app.put('/api/items/:id', requireAuth, requireStaff, async (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;
  const { id } = req.params;
  try {
    const { data: currentItem, error: getError } = await supabase
      .from('items').select('*').eq('id', id).single();
    if (getError || !currentItem) return res.status(404).json({ error: 'Item tidak ditemukan' });
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

// DELETE /api/items/:id — Hanya Staff
app.delete('/api/items/:id', requireAuth, requireStaff, async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Gagal menghapus data dari database' });
  }
});

// ─── Attendance / Absen API ───────────────────────────────────────────────────

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
    res.json(data || []);
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
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching absen:', err);
    res.status(500).json({ error: 'Gagal mengambil data absensi.' });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server is running at http://localhost:${PORT}`);
  console.log(`   Halaman login: http://localhost:${PORT}/login.html\n`);
});
