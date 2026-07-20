require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const session = require('cookie-session');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
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

app.post('/auth/register', requireAuth, requireStaff, async (req, res) => {
  const { email, name, password } = req.body;
  const cleanName = (name || '').trim();

  if (!email || !password || !cleanName) {
    return res.status(400).json({ error: 'Semua kolom wajib diisi.' });
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
      password_hash
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
  const { name, email, role } = req.body;
  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanName || !cleanEmail || !role) {
    return res.status(400).json({ error: 'Nama, email, dan role wajib diisi.' });
  }

  try {
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({ name: cleanName, email: cleanEmail, role })
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
      const { data: users } = await supabase.from('users').select('id, avatar_url').in('id', userIds);
      if (users && users.length) {
        const avatarMap = {};
        users.forEach(u => { if (u.avatar_url) avatarMap[u.id] = u.avatar_url; });
        return attendanceRecords.map(r => ({
          ...r,
          user_avatar: avatarMap[r.user_id] || r.user_avatar || null
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
