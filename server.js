// override:false (default) — kalau ada .env yang somehow ikut ke-deploy, dia
// TIDAK BOLEH menimpa env var yang sudah diset lewat dashboard hosting
// (Vercel dsb). override:true justru bikin file lokal menang atas
// konfigurasi resmi platform — berbahaya kalau file .env-nya ketinggalan
// versi lama/bocor.
require('dotenv').config();
const express = require('express');
const compression = require('compression');
const path = require('path');
const session = require('cookie-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
// Tanpa limits.fileSize, multer akan menampung seluruh file di memori proses
// tanpa batas — siapa pun yang login bisa upload file raksasa ke CV
// Narasumber dan menghabiskan RAM server. 10MB cukup longgar untuk dokumen
// CV/PDF wajar.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
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

// ─── Web Push Init ───────────────────────────────────────────────────────────
const webpush = require('web-push');
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@rbjakarta.id', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

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
app.use(compression());
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
// Sesi cookie hanya menyimpan snapshot role saat login. Kalau tidak dicek ulang,
// akun yang barusan di-demote/dihapus staff tetap bisa pakai akses lamanya
// sampai browser/tab ditutup. Refetch role dari DB tiap request supaya
// perubahan role/penghapusan akun langsung berlaku. Gagal-terbuka kalau
// Supabase-nya sendiri yang error (jangan sampai satu hiccup mengunci semua
// orang keluar), tapi gagal-tertutup kalau akunnya memang sudah tidak ada.
async function requireAuth(req, res, next) {
  if (!(req.session && req.session.user)) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized', redirect: '/login.html' });
    }
    return res.redirect('/login.html');
  }
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', req.session.user.id)
    .maybeSingle();
  if (error) return next();
  if (!data) {
    req.session = null;
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Akun tidak ditemukan, silakan login kembali.', redirect: '/login.html' });
    }
    return res.redirect('/login.html');
  }
  req.session.user.role = data.role;
  next();
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
      id: req.session.user.id,
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


// ─── Protected HTML Pages ─────────────────────────────────────────────────────
// Must be registered BEFORE express.static below. express.static ends the
// request as soon as it finds a matching file and never calls next(), so any
// route guard for an existing .html file placed after it never runs — these
// pages would always be served unguarded straight off disk. (That's exactly
// what had silently happened here: this whole block used to sit after the
// static mount, so even the pre-existing manage-users.html guard never
// actually fired — anyone logged in could open it directly.)
function sendGuardedHtml(res, filename) {
  // Bypassing express.static here also means bypassing its no-cache header
  // for HTML (see the static config below) — replicate it so a stale
  // cached copy of one of these pages can't linger in the browser.
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', filename));
}
app.get('/manage', requireAuth, (req, res) => sendGuardedHtml(res, 'manage.html'));
app.get('/manage.html', requireAuth, (req, res) => sendGuardedHtml(res, 'manage.html'));
app.get('/manage-users', requireAuth, requireStaff, (req, res) => sendGuardedHtml(res, 'manage-users.html'));
app.get('/manage-users.html', requireAuth, requireStaff, (req, res) => sendGuardedHtml(res, 'manage-users.html'));
app.get('/agenda-hub.html', requireAuth, (req, res) => sendGuardedHtml(res, 'agenda-hub.html'));
// administrasi.html, email.html, dan rekap-absen.html sebelumnya diserve
// begitu saja lewat express.static tanpa penjaga sama sekali — intern yang
// tahu/menebak URL-nya bisa langsung membuka halaman dan (untuk email.html)
// melihat kredensial staff. Tambahkan guard yang sama seperti manage-users.
app.get('/administrasi.html', requireAuth, requireStaff, (req, res) => sendGuardedHtml(res, 'administrasi.html'));
app.get('/email.html', requireAuth, requireStaff, (req, res) => sendGuardedHtml(res, 'email.html'));
app.get('/rekap-absen.html', requireAuth, requireStaff, (req, res) => sendGuardedHtml(res, 'rekap-absen.html'));
app.get('/chat.html', requireAuth, (req, res) => sendGuardedHtml(res, 'chat.html'));

// ─── Static Files ─────────────────────────────────────────────────────────────
// Vendor libs only change on npm install/upgrade, safe to cache for a day.
app.use('/vendor/lucide', express.static(path.join(__dirname, 'node_modules/lucide/dist/umd'), { maxAge: '1d' }));
app.use('/vendor/aos', express.static(path.join(__dirname, 'node_modules/aos/dist'), { maxAge: '1d' }));
app.use('/vendor/sweetalert2', express.static(path.join(__dirname, 'node_modules/sweetalert2/dist'), { maxAge: '1d' }));
app.use('/vendor/gsap', express.static(path.join(__dirname, 'node_modules/gsap/dist'), { maxAge: '1d' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res, path) => {
    // No-cache for HTML and the app-shell files that change often during
    // active development — a stale cached copy (e.g. an old sidebar/topbar
    // in shared.js) can silently linger in the browser otherwise.
    // Everything else (images, etc.) gets the 1-day maxAge set above.
    if (path.endsWith('.html') || path.endsWith('shared.js') || path.endsWith('style.css')
      || path.endsWith('theme.js') || path.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ─── API: Items (CRUD) — Memerlukan Login ─────────────────────────────────────
// 'administrasi' dan 'email' menyimpan kredensial staff (termasuk password
// dalam bentuk plaintext di kolom `pass`) — POST/PUT/DELETE items sudah
// menolak intern untuk divisi ini, tapi GET sebelumnya tidak, jadi intern
// yang tahu/menebak URL (mis. /email.html) bisa membaca kredensial itu
// langsung. Terapkan batasan yang sama di sini juga.
const ITEMS_STAFF_ONLY_DIVISIONS = ['administrasi', 'email'];

// GET /api/items — Semua user yang login bisa baca, kecuali divisi Staff Only di atas
app.get('/api/items', requireAuth, async (req, res) => {
  const { division } = req.query;
  const isStaff = req.session.user.role === 'staff';

  if (division && !isStaff && ITEMS_STAFF_ONLY_DIVISIONS.includes(division)) {
    return res.status(403).json({ error: 'Forbidden: Divisi ini hanya dapat diakses oleh Staff.' });
  }

  try {
    let query = supabase.from('items').select('*').order('created_at', { ascending: true });
    if (division) query = query.eq('division', division);
    let { data, error } = await query;
    if (error) throw error;

    // No division filter = "semua divisi" (dipakai Kelola Data & pencarian
    // global) — buang divisi Staff Only dari hasilnya untuk intern.
    if (!division && !isStaff) {
      data = (data || []).filter(i => !ITEMS_STAFF_ONLY_DIVISIONS.includes(i.division));
    }

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
  const staffOnlyDivisions = ITEMS_STAFF_ONLY_DIVISIONS;
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
  const staffOnlyDivisions = ITEMS_STAFF_ONLY_DIVISIONS;

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
  const staffOnlyDivisions = ITEMS_STAFF_ONLY_DIVISIONS;
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

// This endpoint is shared by two forms with very different intent:
//   - Agenda & Event Hub's "Tambah Agenda" (calendar/silabus entries) — any
//     logged-in user, interns included.
//   - Event Hub's "Tambah Event" (narasumber & partnership tracking, with CV
//     upload) — Staff only, since it drives official outreach documents.
// Both write to the same `events` table, so the category value is what
// tells them apart. Gate on that instead of the route as a whole, so an
// intern can't just replay an Event Hub payload with a relabeled category.
const AGENDA_ONLY_CATEGORIES = [
  'Silabus BD', 'UMIBA', 'GBKP Moria', 'Event', 'Audiensi',
  'Design', 'Sosmed', 'Admin', 'Lainnya'
];

// POST /api/events — Menambah acara baru (semua user login untuk kategori
// agenda; kategori event/narasumber tetap Staff Only)
app.post('/api/events', requireAuth, upload.single('cvNarsum'), async (req, res) => {
  const {
    category, title, event_date, start_time, end_time, location, speaker_name, pic_name,
    kelas, jenis_pelatihan, mc, jumlah_peserta,
    link_zoom, link_umkm, caption_sosmed, link_pendaftaran_gform, spreadsheets_data_peserta
  } = req.body;

  if (!category || !title || !event_date) {
    return res.status(400).json({ error: 'Kategori, Judul, dan Tanggal acara wajib diisi.' });
  }

  const isStaff = req.session.user.role === 'staff';
  if (!isStaff && !AGENDA_ONLY_CATEGORIES.includes(category)) {
    return res.status(403).json({ error: 'Forbidden: kategori ini hanya bisa ditambahkan oleh Staff.' });
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

// PUT /api/events/:id — Edit data acara (Staff Only)
app.put('/api/events/:id', requireAuth, requireStaff, upload.single('cvNarsum'), async (req, res) => {
  const eventId = req.params.id;
  const {
    category, title, event_date, start_time, end_time, location, speaker_name, pic_name,
    kelas, jenis_pelatihan, mc, jumlah_peserta,
    link_zoom, link_umkm, caption_sosmed, link_pendaftaran_gform, spreadsheets_data_peserta
  } = req.body;

  if (!category || !title || !event_date) {
    return res.status(400).json({ error: 'Kategori, Judul, dan Tanggal acara wajib diisi.' });
  }

  const updatedData = {
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
    link_zoom: link_zoom || null,
    link_umkm: link_umkm || null,
    caption_sosmed: caption_sosmed || null,
    link_pendaftaran_gform: link_pendaftaran_gform || null,
    spreadsheets_data_peserta: spreadsheets_data_peserta || null,
  };

  // Jika ada file CV baru yang diunggah, upload ke storage
  if (req.file) {
    try {
      const { originalname, buffer, mimetype } = req.file;
      const filename = `${Date.now()}_${originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
      const { data, error } = await supabase.storage.from('cv_narasumber').upload(filename, buffer, { contentType: mimetype });
      if (error) {
        console.error('Storage Error:', error);
        return res.status(500).json({ error: 'Gagal mengunggah CV: ' + error.message });
      }
      const { data: publicUrlData } = supabase.storage.from('cv_narasumber').getPublicUrl(filename);
      updatedData.cv_narasumber_url = publicUrlData.publicUrl;
    } catch (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan saat mengunggah CV.' });
    }
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .update(updatedData)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('Supabase update event error:', error);
      return res.status(500).json({ error: error.message || 'Gagal memperbarui data acara.' });
    }
    res.json({ message: 'Data acara berhasil diperbarui!', data });
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: err.message || 'Gagal memperbarui data acara.' });
  }
});

// PUT /api/events/:id/status — Ubah status acara: upcoming / done (Staff Only)
app.put('/api/events/:id/status', requireAuth, requireStaff, async (req, res) => {
  const eventId = req.params.id;
  const { status } = req.body;

  if (!['upcoming', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid. Gunakan "upcoming" atau "done".' });
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('Supabase status update error:', error);
      return res.status(500).json({ error: error.message || 'Gagal mengubah status acara.' });
    }
    res.json({ message: `Status acara berhasil diubah menjadi "${status}".`, data });
  } catch (err) {
    console.error('Error updating event status:', err);
    res.status(500).json({ error: err.message || 'Gagal mengubah status acara.' });
  }
});

// DELETE /api/events/:id — Hapus acara (Staff Only)
app.delete('/api/events/:id', requireAuth, requireStaff, async (req, res) => {
  const eventId = req.params.id;

  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('Supabase delete event error:', error);
      return res.status(500).json({ error: error.message || 'Gagal menghapus acara.' });
    }
    res.json({ message: 'Acara berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: err.message || 'Gagal menghapus acara.' });
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
const BD_PARTNERSHIP_EDITABLE_FIELDS = [
  'tanggal_dihubungi', 'tanggal_kerjasama', 'nama_komunitas', 'linkedin',
  'instagram', 'email', 'kontak_komunitas', 'nama_cp', 'kontak_cp',
  'jumlah_anggota', 'status', 'via', 'template_approach'
];
app.put('/api/bd-partnerships/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  // Ambil field yang boleh diedit saja — body mentah tidak boleh langsung
  // dipakai, supaya orang tidak bisa selipin kolom lain (mis. created_by, id)
  // buat memalsukan kepemilikan data atau menimpa primary key.
  const updates = {};
  for (const key of BD_PARTNERSHIP_EDITABLE_FIELDS) {
    if (key in req.body) updates[key] = req.body[key];
  }
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

// ─── API: Katalog UMKM (Business Development) ─────────────────────────────────
// Kategori bebas (teks) — kategori baru otomatis muncul begitu dipakai di satu
// entri, tidak ada tabel/menu kelola kategori terpisah.

// Foto produk dibatasi 2MB — cukup untuk kualitas web/mobile, jaga kuota
// Supabase Storage tetap hemat walau entri katalog terus bertambah.
const CATALOG_PHOTO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const uploadCatalogPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!CATALOG_PHOTO_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Format foto harus PNG, JPEG, atau WebP.'));
    }
    cb(null, true);
  }
});

function handleCatalogUpload(req, res, next) {
  uploadCatalogPhoto.single('foto')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Ukuran foto maksimal 2MB.' });
      }
      return res.status(400).json({ error: 'Gagal memproses foto: ' + err.message });
    }
    next();
  });
}

async function uploadCatalogPhotoFile(file) {
  const filename = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const { error } = await supabase.storage.from('bd-catalog-photos').upload(filename, file.buffer, { contentType: file.mimetype });
  if (error) throw error;
  const { data } = supabase.storage.from('bd-catalog-photos').getPublicUrl(filename);
  return data.publicUrl;
}

function catalogStoragePathFromUrl(url) {
  if (!url || !url.startsWith('http')) return null;
  const marker = '/bd-catalog-photos/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length);
}

async function deleteCatalogPhotoIfAny(url) {
  const path = catalogStoragePathFromUrl(url);
  if (!path) return;
  try { await supabase.storage.from('bd-catalog-photos').remove([path]); }
  catch (e) { console.warn('Gagal hapus foto katalog lama:', e.message); }
}

// GET /api/bd-catalog — Ambil data katalog UMKM
app.get('/api/bd-catalog', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bd_catalog')
      .select(`*, users ( name, divisi )`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedData = data.map(item => ({
      ...item,
      created_by_name: item.users ? item.users.name : 'Unknown'
    }));
    res.json(formattedData);
  } catch (err) {
    console.error('Error fetching bd catalog:', err);
    res.status(500).json({ error: 'Gagal mengambil data katalog UMKM' });
  }
});

// POST /api/bd-catalog — Buat entri katalog baru (multipart/form-data, field "foto" opsional)
app.post('/api/bd-catalog', requireAuth, handleCatalogUpload, async (req, res) => {
  const { kategori, nama_umkm, no_telp, tanggal_display } = req.body;

  if (!nama_umkm) {
    return res.status(400).json({ error: 'Nama UMKM wajib diisi' });
  }

  try {
    let link_foto_katalog = null;
    if (req.file) link_foto_katalog = await uploadCatalogPhotoFile(req.file);

    const { data, error } = await supabase
      .from('bd_catalog')
      .insert([{
        kategori: (kategori || '').trim() || 'Umum',
        nama_umkm,
        no_telp: no_telp || null,
        link_foto_katalog,
        tanggal_display: tanggal_display || null,
        created_by: req.session.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Error creating bd catalog entry:', err);
    res.status(500).json({ error: 'Gagal membuat entri katalog: ' + err.message });
  }
});

// PUT /api/bd-catalog/:id — Update entri katalog. Kirim field "foto" untuk ganti
// foto (foto lama otomatis dihapus dari Storage), atau hapusFoto=1 untuk
// menghapus foto tanpa gantinya.
app.put('/api/bd-catalog/:id', requireAuth, handleCatalogUpload, async (req, res) => {
  const { id } = req.params;
  const { kategori, nama_umkm, no_telp, tanggal_display, hapusFoto } = req.body;

  try {
    const { data: existing, error: findErr } = await supabase
      .from('bd_catalog').select('link_foto_katalog').eq('id', id).maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: 'Data tidak ditemukan.' });

    const updates = {
      kategori: (kategori || '').trim() || 'Umum',
      nama_umkm,
      no_telp: no_telp || null,
      tanggal_display: tanggal_display || null,
    };

    const oldPhotoUrl = existing.link_foto_katalog;
    let shouldDeleteOldPhoto = false;
    if (req.file) {
      updates.link_foto_katalog = await uploadCatalogPhotoFile(req.file);
      shouldDeleteOldPhoto = true;
    } else if (hapusFoto === '1' || hapusFoto === 'true') {
      updates.link_foto_katalog = null;
      shouldDeleteOldPhoto = true;
    }

    const { data, error } = await supabase
      .from('bd_catalog')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Hapus foto lama BARU setelah update DB dikonfirmasi berhasil — kalau
    // urutannya dibalik dan update-nya gagal, entrinya jadi nunjuk ke foto
    // yang sudah tidak ada, dan foto baru yang sudah terupload jadi nyasar
    // (tidak terhubung ke entri manapun).
    if (shouldDeleteOldPhoto) await deleteCatalogPhotoIfAny(oldPhotoUrl);

    res.json(data);
  } catch (err) {
    console.error('Error updating bd catalog entry:', err);
    res.status(500).json({ error: 'Gagal update entri katalog: ' + err.message });
  }
});

// DELETE /api/bd-catalog/:id — Hapus entri katalog sekaligus foto di Storage-nya
app.delete('/api/bd-catalog/:id', requireAuth, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('bd_catalog').select('link_foto_katalog').eq('id', req.params.id).maybeSingle();

    const { error } = await supabase
      .from('bd_catalog')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    if (existing) await deleteCatalogPhotoIfAny(existing.link_foto_katalog);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting bd catalog entry:', err);
    res.status(500).json({ error: 'Gagal menghapus entri katalog' });
  }
});

// ─── Attendance / Absen API ───────────────────────────────────────────────────

// --- Geofencing Target ---
const TARGET_LAT = -6.185582350879704;
const TARGET_LNG = 106.79652101747172;
const MAX_RADIUS = 50; // meters

// --- Sinkron real-time ke Google Sheets (via Apps Script Web App) ---
// Diisi setelah setup di Google Sheets selesai (lihat panduan). Kalau kosong,
// sinkronisasi otomatis dilewati (tidak error) — absen tetap tersimpan normal.
const ABSEN_SHEETS_WEBHOOK_URL = process.env.ABSEN_SHEETS_WEBHOOK_URL || '';
const ABSEN_SHEETS_SECRET = process.env.ABSEN_SHEETS_SECRET || '';

// Fire-and-forget: tidak pernah membuat submit absen gagal walau Sheets/Drive
// sedang error atau lambat — hanya dicatat di log server.
function syncAbsenToSheets(payload) {
  if (!ABSEN_SHEETS_WEBHOOK_URL) return;
  fetch(ABSEN_SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, secret: ABSEN_SHEETS_SECRET }),
  })
    .then(r => { if (!r.ok) console.error('Sync absen ke Sheets gagal, status:', r.status); })
    .catch(err => console.error('Sync absen ke Sheets gagal:', err.message));
}

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

// ─── Cleanup absensi lama — data lengkap sudah ke-backup di Google Sheets/Drive,
// jadi aman dibersihkan dari Supabase (DB + Storage) biar kuota tidak penuh ───
const ATTENDANCE_RETENTION_DAYS = 60;

function extractStoragePath(photoUrl) {
  if (!photoUrl || !photoUrl.startsWith('http')) return null;
  const marker = '/attendance-photos/';
  const idx = photoUrl.indexOf(marker);
  if (idx === -1) return null;
  return photoUrl.substring(idx + marker.length);
}

async function cleanupOldAttendance() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ATTENDANCE_RETENTION_DAYS);

  try {
    const { data: oldRecords, error: fetchError } = await supabase
      .from('attendance')
      .select('id, photo_url')
      .lt('timestamp', cutoff.toISOString());
    if (fetchError) throw fetchError;
    if (!oldRecords || !oldRecords.length) return;

    const paths = oldRecords.map(r => extractStoragePath(r.photo_url)).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('attendance-photos').remove(paths);
      if (storageError) console.warn('Cleanup: gagal hapus sebagian foto lama di Storage:', storageError.message);
    }

    const ids = oldRecords.map(r => r.id);
    const { error: deleteError } = await supabase.from('attendance').delete().in('id', ids);
    if (deleteError) throw deleteError;

    console.log(`🧹 Cleanup absensi: ${ids.length} data lebih dari ${ATTENDANCE_RETENTION_DAYS} hari dihapus (${paths.length} foto ikut dihapus dari Storage).`);
  } catch (err) {
    console.error('Cleanup absensi lama gagal:', err.message);
  }
}

// GET /api/cron/cleanup-attendance — Dipanggil Vercel Cron (lihat vercel.json).
// setInterval di bagian "Start Server" di bawah cuma jalan untuk server
// long-running (localhost) — di Vercel tiap request punya proses serverless
// sendiri yang berumur pendek, jadi setInterval di sana tidak pernah benar-benar
// jalan. Endpoint ini adalah cara cleanup tetap jalan saat deploy di Vercel.
// Diproteksi CRON_SECRET (Vercel otomatis kirim header ini kalau env var
// CRON_SECRET diset di project settings) supaya orang luar tidak bisa memicu.
app.get('/api/cron/cleanup-attendance', async (req, res) => {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  await cleanupOldAttendance();
  res.json({ ok: true });
});

// POST /api/absen — Submit absensi (semua user yang login)
app.post('/api/absen', requireAuth, async (req, res) => {
  const { type, photo_base64, latitude, longitude, address, work_mode } = req.body;
  const user = req.session.user;

  if (!type || !['clock_in', 'clock_out'].includes(type)) {
    return res.status(400).json({ error: 'Tipe absen tidak valid.' });
  }
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Data GPS diperlukan untuk absensi.' });
  }

  const mode = work_mode === 'wfh' ? 'wfh' : 'wfo';

  // Intern hanya boleh WFH kalau sudah diizinkan staff untuk hari ini. Staff bebas pilih sendiri.
  if (mode === 'wfh' && user.role !== 'staff') {
    const { data: assignment } = await supabase
      .from('wfh_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('work_date', todayDateStr())
      .maybeSingle();
    if (!assignment) {
      return res.status(403).json({ error: 'Absen WFH belum diizinkan oleh staff untuk hari ini.' });
    }
  }

  // Validasi Geofencing — dilewati kalau lagi WFH
  if (mode === 'wfo') {
    const distance = calculateDistance(latitude, longitude, TARGET_LAT, TARGET_LNG);
    if (distance > MAX_RADIUS) {
      return res.status(403).json({ error: `Absensi ditolak: Anda berada ${distance} meter di luar area kantor (Maksimal ${MAX_RADIUS}m).` });
    }
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
      work_mode: mode,
      photo_url,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || null,
    }]).select().single();

    if (error) throw error;

    // Sinkron real-time ke Google Sheets (tidak menunggu/tidak memblokir response)
    syncAbsenToSheets({
      user_name: user.name,
      user_email: user.email,
      user_role: user.role,
      type,
      work_mode: mode,
      address: address || '',
      latitude,
      longitude,
      photo_base64: photo_base64 || '',
    });

    res.status(201).json({ message: `Absensi ${mode === 'wfh' ? 'WFH' : 'WFO'} berhasil!`, data });
  } catch (err) {
    console.error('Absen error:', err);
    res.status(500).json({ error: 'Gagal menyimpan absensi: ' + err.message });
  }
});

function todayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── WFH Assignment — staff menentukan intern mana yang boleh WFH per tanggal ───

// GET /api/wfh-assignments?date=YYYY-MM-DD — daftar intern yang diizinkan WFH pada tanggal tsb (Staff only)
app.get('/api/wfh-assignments', requireAuth, requireStaff, async (req, res) => {
  const date = req.query.date || todayDateStr();
  try {
    const { data: assignments, error } = await supabase
      .from('wfh_assignments')
      .select('id, user_id, work_date')
      .eq('work_date', date);
    if (error) throw error;

    const userIds = [...new Set((assignments || []).map(a => a.user_id))];
    let userMap = {};
    if (userIds.length) {
      const { data: users } = await supabase.from('users').select('id, name, email').in('id', userIds);
      (users || []).forEach(u => { userMap[u.id] = u; });
    }

    res.json((assignments || []).map(a => ({
      ...a,
      user_name: userMap[a.user_id]?.name || 'Unknown',
      user_email: userMap[a.user_id]?.email || '',
    })));
  } catch (err) {
    console.error('List wfh assignments error:', err);
    res.status(500).json({ error: 'Gagal mengambil data assignment WFH: ' + err.message });
  }
});

// POST /api/wfh-assignments — staff mengizinkan seorang intern WFH pada tanggal tertentu
app.post('/api/wfh-assignments', requireAuth, requireStaff, async (req, res) => {
  const { user_id, date } = req.body;
  const work_date = date || todayDateStr();
  if (!user_id) return res.status(400).json({ error: 'user_id wajib diisi.' });

  try {
    const { data, error } = await supabase
      .from('wfh_assignments')
      .upsert({ user_id, work_date, assigned_by: req.session.user.id }, { onConflict: 'user_id,work_date' })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('Create wfh assignment error:', err);
    res.status(500).json({ error: 'Gagal menyimpan assignment WFH: ' + err.message });
  }
});

// DELETE /api/wfh-assignments — staff mencabut izin WFH intern pada tanggal tertentu
app.delete('/api/wfh-assignments', requireAuth, requireStaff, async (req, res) => {
  const { user_id, date } = req.body;
  const work_date = date || todayDateStr();
  if (!user_id) return res.status(400).json({ error: 'user_id wajib diisi.' });

  try {
    const { error } = await supabase
      .from('wfh_assignments')
      .delete()
      .eq('user_id', user_id)
      .eq('work_date', work_date);
    if (error) throw error;
    res.json({ message: 'Assignment WFH dicabut.' });
  } catch (err) {
    console.error('Delete wfh assignment error:', err);
    res.status(500).json({ error: 'Gagal menghapus assignment WFH: ' + err.message });
  }
});

// POST /api/wfh-assignments/bulk — staff mengizinkan/mencabut WFH untuk SEMUA intern sekaligus pada tanggal tertentu
app.post('/api/wfh-assignments/bulk', requireAuth, requireStaff, async (req, res) => {
  const { date, allowed } = req.body;
  const work_date = date || todayDateStr();

  try {
    const { data: interns, error: internErr } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'internship');
    if (internErr) throw internErr;

    const internIds = (interns || []).map(u => u.id);
    if (!internIds.length) return res.json({ message: 'Belum ada akun intern.', count: 0 });

    if (allowed) {
      const rows = internIds.map(id => ({ user_id: id, work_date, assigned_by: req.session.user.id }));
      const { error } = await supabase.from('wfh_assignments').upsert(rows, { onConflict: 'user_id,work_date' });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('wfh_assignments').delete().eq('work_date', work_date).in('user_id', internIds);
      if (error) throw error;
    }

    res.json({ message: allowed ? 'Semua intern diizinkan WFH.' : 'Izin WFH semua intern dicabut.', count: internIds.length });
  } catch (err) {
    console.error('Bulk wfh assignment error:', err);
    res.status(500).json({ error: 'Gagal memperbarui assignment WFH: ' + err.message });
  }
});

// GET /api/wfh-assignments/mine — cek apakah user saat ini boleh absen WFH pada tanggal tsb (default hari ini)
app.get('/api/wfh-assignments/mine', requireAuth, async (req, res) => {
  const date = req.query.date || todayDateStr();
  const user = req.session.user;

  // Staff selalu bebas memilih WFO/WFH sendiri.
  if (user.role === 'staff') {
    return res.json({ allowed: true });
  }

  try {
    const { data, error } = await supabase
      .from('wfh_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('work_date', date)
      .maybeSingle();
    if (error) throw error;
    res.json({ allowed: !!data });
  } catch (err) {
    console.error('Check wfh assignment error:', err);
    res.status(500).json({ error: 'Gagal memeriksa assignment WFH: ' + err.message });
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
      // `new Date(date).setHours(0,0,0,0)` memakai jam LOKAL proses Node —
      // di server yang jalan di UTC (mis. default Vercel), itu jadi batas
      // hari UTC, bukan WIB. Orang yang absen jam 00:00–06:59 WIB (masih
      // hari "kemarin" di UTC) jadi hilang dari rekap hari itu. Tulis
      // offset +07:00 langsung di string ISO-nya supaya batas harinya
      // selalu pas WIB, apa pun zona waktu server yang menjalankannya.
      const start = new Date(`${date}T00:00:00+07:00`);
      const end = new Date(`${date}T23:59:59.999+07:00`);
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

// ─── Chat (Global / Divisi / Personal) ───────────────────────────────────────
// Keanggotaan ruang tidak disimpan di tabel terpisah — dihitung dari
// users.divisi dan dm_key, lalu diperiksa di setiap request. Dengan begitu
// mengubah divisi seorang user lewat menu Kelola langsung memindahkan
// akses ruang divisinya tanpa perlu sinkronisasi tambahan.

const CHAT_DIVISIONS = [
  'Business Development',
  'Social Media',
  'Design Graphic',
  'Event & Partnerships',
  'General Administration'
];
const CHAT_MSG_MAX = 4000;

// Session dibuat saat login dan belum tentu memuat divisi (kolom divisi bisa
// berubah setelah user login), jadi selalu ambil versi terbaru dari database.
async function getChatUser(req) {
  const sessionUser = req.session.user;
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, divisi, avatar_url')
    .eq('id', sessionUser.id)
    .single();
  if (error || !data) return null;
  return data;
}

// Kunci DM yang stabil: urutkan kedua id agar pasangan yang sama selalu
// menghasilkan kunci identik, siapa pun yang memulai percakapan.
function dmKeyFor(idA, idB) {
  return [String(idA), String(idB)].sort().join(':');
}

// Ruang global & divisi dibuat saat pertama dibutuhkan, sehingga tidak perlu
// seeding manual setelah menjalankan schema_chat.sql.
async function ensureRoom({ type, name, division }) {
  let query = supabase.from('chat_rooms').select('*').eq('type', type);
  query = division ? query.eq('division', division) : query;
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('chat_rooms')
    .insert([{ type, name, division: division || null }])
    .select()
    .single();

  if (error) {
    // Unique index bisa menolak insert saat dua request bersamaan membuat
    // ruang yang sama — ambil saja baris yang sudah menang.
    let retry = supabase.from('chat_rooms').select('*').eq('type', type);
    retry = division ? retry.eq('division', division) : retry;
    const { data: raced } = await retry.maybeSingle();
    if (raced) return raced;
    throw error;
  }
  return data;
}

// Daftar ruang yang boleh diakses user + id-nya, dipakai sebagai penjaga akses.
async function roomsVisibleTo(user) {
  const rooms = [];

  rooms.push(await ensureRoom({ type: 'global', name: 'Semua Anggota' }));

  if (user.divisi && CHAT_DIVISIONS.includes(user.divisi)) {
    rooms.push(await ensureRoom({ type: 'division', name: user.divisi, division: user.divisi }));
  }

  // Staff mengawasi seluruh divisi, jadi diberi akses ke semua ruang divisi.
  if (user.role === 'staff') {
    for (const div of CHAT_DIVISIONS) {
      if (div === user.divisi) continue;
      rooms.push(await ensureRoom({ type: 'division', name: div, division: div }));
    }
  }

  const { data: dms } = await supabase
    .from('chat_rooms')
    .select('*')
    .eq('type', 'dm')
    .like('dm_key', `%${user.id}%`);

  // `like` bisa ikut menangkap id yang hanya kebetulan mengandung substring,
  // jadi saring lagi berdasarkan potongan kunci yang persis.
  (dms || []).forEach(r => {
    if (String(r.dm_key).split(':').includes(String(user.id))) rooms.push(r);
  });

  return rooms;
}

async function canAccessRoom(user, roomId) {
  const rooms = await roomsVisibleTo(user);
  return rooms.find(r => String(r.id) === String(roomId)) || null;
}

// Anggota sebenarnya dari sebuah ruang — dipakai untuk membatasi siapa yang
// bisa di-@tag di ruang itu (mis. ruang divisi Design tidak boleh menawarkan
// orang dari divisi Sosmed di autocomplete-nya).
//   global   → semua user
//   division → intern divisi itu + semua staff (staff memang mengawasi semua ruang divisi)
//   dm       → dua orang di dm_key itu saja
async function getRoomMembers(room) {
  if (room.type === 'global') {
    const { data } = await supabase.from('users').select('id, name, email, role, divisi, avatar_url');
    return data || [];
  }
  if (room.type === 'division') {
    const { data } = await supabase.from('users').select('id, name, email, role, divisi, avatar_url')
      .or(`divisi.eq.${room.division},role.eq.staff`);
    return data || [];
  }
  if (room.type === 'dm') {
    const ids = String(room.dm_key).split(':');
    const { data } = await supabase.from('users').select('id, name, email, role, divisi, avatar_url').in('id', ids);
    return data || [];
  }
  return [];
}

// ─── Web Push: subscribe/unsubscribe + kirim notifikasi pesan baru ───────────

// GET /api/push/vapid-public-key — key publik dipakai frontend untuk subscribe
app.get('/api/push/vapid-public-key', requireAuth, (req, res) => {
  if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'Push notification belum dikonfigurasi.' });
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — simpan/replace subscription device ini
app.post('/api/push/subscribe', requireAuth, async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Data subscription tidak lengkap.' });
  }
  try {
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: req.session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Gagal menyimpan subscription: ' + err.message });
  }
});

// POST /api/push/unsubscribe — device ini tidak mau menerima notifikasi lagi
app.post('/api/push/unsubscribe', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint wajib diisi.' });
  try {
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus subscription: ' + err.message });
  }
});

// Kirim push ke semua anggota ruang selain pengirim — dipanggil fire-and-forget
// (tidak menunggu/tidak memblokir response kirim pesan).
async function pushNotifyRoom(room, sender, previewText) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const members = await getRoomMembers(room);
    const targetIds = members.map(m => m.id).filter(id => String(id) !== String(sender.id));
    if (!targetIds.length) return;

    const { data: subs } = await supabase.from('push_subscriptions').select('*').in('user_id', targetIds);
    if (!subs || !subs.length) return;

    const payload = JSON.stringify({
      title: room.type === 'dm' ? sender.name : `${room.name || 'Ruang'} · ${sender.name}`,
      body: (previewText || '').slice(0, 120),
      url: `/chat.html?room=${room.id}`,
      room_id: room.id,
    });

    await Promise.all(subs.map(async (sub) => {
      const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
      try {
        await webpush.sendNotification(pushSub, payload);
      } catch (err) {
        // 404/410 = subscription sudah tidak valid (browser di-uninstall, izin dicabut, dst) — bersihkan.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.warn('Push send gagal:', err.message);
        }
      }
    }));
  } catch (err) {
    console.error('pushNotifyRoom error:', err.message);
  }
}

// GET /api/chat/rooms/:id/members — anggota ruang, dipakai composer untuk
// membatasi daftar autocomplete @tag sesuai ruang yang sedang dibuka.
app.get('/api/chat/rooms/:id/members', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const room = await canAccessRoom(user, req.params.id);
    if (!room) return res.status(403).json({ error: 'Anda tidak memiliki akses ke ruang ini.' });

    const members = await getRoomMembers(room);
    res.json(members.filter(m => String(m.id) !== String(user.id)));
  } catch (err) {
    console.error('Room members error:', err);
    res.status(500).json({ error: 'Gagal memuat anggota ruang: ' + err.message });
  }
});

// GET /api/chat/rooms — daftar ruang + pesan terakhir + jumlah belum dibaca
app.get('/api/chat/rooms', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const rooms = await roomsVisibleTo(user);
    if (!rooms.length) return res.json([]);

    const roomIds = rooms.map(r => r.id);

    const { data: reads } = await supabase
      .from('chat_reads')
      .select('room_id, last_read_at')
      .eq('user_id', user.id)
      .in('room_id', roomIds);
    const readMap = {};
    (reads || []).forEach(r => { readMap[r.room_id] = r.last_read_at; });

    // Ambil pesan tiap ruang sekaligus, lalu hitung di memori — jauh lebih
    // hemat daripada dua query per ruang.
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('room_id, sender_id, sender_name, body, created_at, msg_type, meta, deleted_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(1500);

    const lastMap = {};
    const unreadMap = {};
    (msgs || []).forEach(m => {
      if (!lastMap[m.room_id]) lastMap[m.room_id] = m;
      const readAt = readMap[m.room_id];
      const isMine = String(m.sender_id) === String(user.id);
      if (!isMine && (!readAt || new Date(m.created_at) > new Date(readAt))) {
        unreadMap[m.room_id] = (unreadMap[m.room_id] || 0) + 1;
      }
    });

    // Nama lawan bicara untuk ruang DM.
    const partnerIds = rooms
      .filter(r => r.type === 'dm')
      .map(r => String(r.dm_key).split(':').find(id => id !== String(user.id)))
      .filter(Boolean);

    let partnerMap = {};
    if (partnerIds.length) {
      const { data: partners } = await supabase
        .from('users')
        .select('id, name, email, divisi, avatar_url')
        .in('id', partnerIds);
      (partners || []).forEach(p => { partnerMap[p.id] = p; });
    }

    const payload = rooms.map(r => {
      let label = r.name;
      let subtitle = '';
      let partner = null;
      if (r.type === 'dm') {
        const pid = String(r.dm_key).split(':').find(id => id !== String(user.id));
        partner = partnerMap[pid] || null;
        label = partner ? partner.name : 'Pengguna';
        subtitle = partner ? (partner.divisi || '') : '';
      } else if (r.type === 'global') {
        subtitle = 'Semua divisi';
      } else {
        subtitle = 'Ruang divisi';
      }
      const last = lastMap[r.id] || null;
      let lastBody = '';
      if (last) {
        if (last.deleted_at) lastBody = 'Pesan telah dihapus';
        else if (last.msg_type === 'agenda') lastBody = '📅 ' + ((last.meta && last.meta.title) || 'Agenda');
        else lastBody = last.body;
      }
      return {
        id: r.id,
        type: r.type,
        label,
        subtitle,
        partner_id: partner ? partner.id : null,
        avatar: partner ? partner.avatar_url : null,
        unread: unreadMap[r.id] || 0,
        last_body: lastBody,
        last_sender: last ? last.sender_name : '',
        last_at: last ? last.created_at : null
      };
    });

    // Ruang dengan aktivitas terbaru di atas; yang belum ada pesan menyusul.
    payload.sort((a, b) => {
      if (a.last_at && b.last_at) return new Date(b.last_at) - new Date(a.last_at);
      if (a.last_at) return -1;
      if (b.last_at) return 1;
      return a.label.localeCompare(b.label);
    });

    res.json(payload);
  } catch (err) {
    console.error('Chat rooms error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar obrolan: ' + err.message });
  }
});

// GET /api/chat/contacts — daftar orang yang bisa diajak chat pribadi
app.get('/api/chat/contacts', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, divisi, avatar_url')
      .neq('id', user.id)
      .order('name', { ascending: true });
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Chat contacts error:', err);
    res.status(500).json({ error: 'Gagal memuat kontak: ' + err.message });
  }
});

// POST /api/chat/dm — buka (atau buat) ruang obrolan pribadi dengan seseorang
app.post('/api/chat/dm', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const targetId = (req.body.user_id || '').trim();
    if (!targetId) return res.status(400).json({ error: 'user_id wajib diisi.' });
    if (String(targetId) === String(user.id)) {
      return res.status(400).json({ error: 'Tidak bisa memulai obrolan dengan diri sendiri.' });
    }

    const { data: target } = await supabase
      .from('users').select('id, name').eq('id', targetId).maybeSingle();
    if (!target) return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });

    const key = dmKeyFor(user.id, target.id);
    const { data: existing } = await supabase
      .from('chat_rooms').select('*').eq('type', 'dm').eq('dm_key', key).maybeSingle();
    if (existing) return res.json({ room_id: existing.id, label: target.name });

    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{ type: 'dm', dm_key: key, name: null }])
      .select()
      .single();
    if (error) {
      const { data: raced } = await supabase
        .from('chat_rooms').select('*').eq('type', 'dm').eq('dm_key', key).maybeSingle();
      if (raced) return res.json({ room_id: raced.id, label: target.name });
      throw error;
    }

    res.json({ room_id: data.id, label: target.name });
  } catch (err) {
    console.error('Chat DM error:', err);
    res.status(500).json({ error: 'Gagal membuka obrolan: ' + err.message });
  }
});

// GET /api/chat/rooms/:id/messages — riwayat, atau pesan baru saja bila ?after=
const CHAT_MSG_COLUMNS = 'id, sender_id, sender_name, body, created_at, msg_type, meta, mentions, edited_at, deleted_at, reply_to';
const CHAT_MENTIONS_MAX = 20;

// Deleted messages keep their row (for ordering/unread integrity) but the
// body is never sent back over the API once deleted_at is set.
function serializeChatMessage(m, myId, avatarMap, replyMap) {
  const isDeleted = !!m.deleted_at;
  return {
    id: m.id,
    sender_id: m.sender_id,
    sender_name: m.sender_name,
    sender_avatar: (avatarMap && avatarMap[m.sender_id]) || null,
    body: isDeleted ? '' : m.body,
    created_at: m.created_at,
    msg_type: m.msg_type || 'text',
    meta: isDeleted ? null : (m.meta || null),
    mentions: isDeleted ? [] : (m.mentions || []),
    edited_at: m.edited_at || null,
    deleted: isDeleted,
    mine: String(m.sender_id) === String(myId),
    reply_to: m.reply_to || null,
    reply_preview: (m.reply_to && replyMap && replyMap[m.reply_to]) || null
  };
}

// Batch lookup avatar_url untuk sekumpulan sender_id sekaligus — dipakai
// supaya avatar bisa ditampilkan di bubble chat tanpa query per-pesan.
async function buildAvatarMap(senderIds) {
  const ids = [...new Set(senderIds.filter(Boolean).map(String))];
  if (!ids.length) return {};
  const { data } = await supabase.from('users').select('id, avatar_url').in('id', ids);
  const map = {};
  (data || []).forEach(u => { map[u.id] = u.avatar_url || null; });
  return map;
}

// Batch lookup pesan yang dibalas (reply_to) — dipakai untuk menampilkan
// kutipan pengirim + isi pesan asli di dalam bubble balasan.
async function buildReplyMap(replyToIds) {
  const ids = [...new Set(replyToIds.filter(Boolean).map(String))];
  if (!ids.length) return {};
  const { data } = await supabase.from('chat_messages').select('id, sender_name, body, msg_type, meta, deleted_at').in('id', ids);
  const map = {};
  (data || []).forEach(m => {
    map[m.id] = {
      sender_name: m.sender_name,
      body: m.deleted_at ? '' : (m.msg_type === 'agenda' ? '📅 ' + ((m.meta && m.meta.title) || 'Agenda') : m.body),
      deleted: !!m.deleted_at
    };
  });
  return map;
}

app.get('/api/chat/rooms/:id/messages', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const room = await canAccessRoom(user, req.params.id);
    if (!room) return res.status(403).json({ error: 'Anda tidak memiliki akses ke ruang ini.' });

    let query = supabase
      .from('chat_messages')
      .select(CHAT_MSG_COLUMNS)
      .eq('room_id', room.id);

    const after = req.query.after;
    if (after) {
      // Polling incremental: hanya pesan setelah timestamp yang klien punya.
      query = query.gt('created_at', after).order('created_at', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false }).limit(100);
    }

    const { data, error } = await query;
    if (error) throw error;

    const messages = after ? (data || []) : (data || []).reverse();
    const avatarMap = await buildAvatarMap(messages.map(m => m.sender_id));
    const replyMap = await buildReplyMap(messages.map(m => m.reply_to));
    res.json(messages.map(m => serializeChatMessage(m, user.id, avatarMap, replyMap)));
  } catch (err) {
    console.error('Chat messages error:', err);
    res.status(500).json({ error: 'Gagal memuat pesan: ' + err.message });
  }
});

// POST /api/chat/rooms/:id/messages — kirim pesan (teks biasa, kartu agenda,
// atau hasil forward — dibedakan lewat msg_type/meta, bukan endpoint terpisah)
app.post('/api/chat/rooms/:id/messages', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const room = await canAccessRoom(user, req.params.id);
    if (!room) return res.status(403).json({ error: 'Anda tidak memiliki akses ke ruang ini.' });

    const msgType = req.body.msg_type === 'agenda' ? 'agenda' : 'text';
    const body = (req.body.body || '').trim();

    if (msgType === 'agenda') {
      const meta = req.body.meta;
      if (!meta || !meta.event_id || !meta.title) {
        return res.status(400).json({ error: 'Data agenda tidak lengkap.' });
      }
    } else if (!body) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    }
    if (body.length > CHAT_MSG_MAX) {
      return res.status(400).json({ error: `Pesan maksimal ${CHAT_MSG_MAX} karakter.` });
    }

    // mentions: hanya id anggota ruang ini (bukan sekadar "user valid mana
    // pun") — supaya ruang divisi Design, misalnya, tidak bisa dipakai buat
    // nge-tag orang di divisi Sosmed yang bahkan tidak ada di ruang itu.
    // Dibatasi jumlahnya juga supaya tidak bisa dipakai nge-tag ratusan orang sekaligus.
    let mentions = Array.isArray(req.body.mentions) ? req.body.mentions : [];
    mentions = [...new Set(mentions.map(String))].slice(0, CHAT_MENTIONS_MAX);
    if (mentions.length) {
      const members = await getRoomMembers(room);
      const memberIds = new Set(members.map(m => String(m.id)));
      mentions = mentions.filter(id => memberIds.has(id));
    }

    // reply_to harus benar-benar pesan yang ada di ruang yang sama dan belum
    // dihapus — kalau tidak valid, dilewat saja (bukan error) supaya kirim
    // pesan tetap jalan meski kutipannya sudah keburu terhapus orang lain.
    let replyTo = req.body.reply_to || null;
    if (replyTo) {
      const { data: replyMsg } = await supabase
        .from('chat_messages').select('id, room_id, deleted_at')
        .eq('id', replyTo).maybeSingle();
      if (!replyMsg || String(replyMsg.room_id) !== String(room.id) || replyMsg.deleted_at) replyTo = null;
    }

    const row = {
      room_id: room.id,
      sender_id: user.id,
      sender_name: user.name,
      body,
      msg_type: msgType,
      meta: msgType === 'agenda' ? req.body.meta : (req.body.meta && req.body.meta.forwarded ? { forwarded: true } : null),
      mentions,
      reply_to: replyTo
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([row])
      .select(CHAT_MSG_COLUMNS)
      .single();
    if (error) throw error;

    // Pengirim otomatis dianggap sudah membaca ruangnya sendiri.
    await supabase
      .from('chat_reads')
      .upsert({ room_id: room.id, user_id: user.id, last_read_at: data.created_at },
              { onConflict: 'room_id,user_id' });

    // Push notification ke anggota lain (tidak menunggu/tidak memblokir response).
    const pushPreview = msgType === 'agenda' ? `📅 ${req.body.meta.title}` : body;
    pushNotifyRoom(room, user, pushPreview);

    const replyMap = replyTo ? await buildReplyMap([replyTo]) : {};
    res.json(serializeChatMessage(data, user.id, { [user.id]: user.avatar_url }, replyMap));
  } catch (err) {
    console.error('Chat send error:', err);
    res.status(500).json({ error: 'Gagal mengirim pesan: ' + err.message });
  }
});

// PUT /api/chat/rooms/:id/messages/:msgId — edit pesan (pengirim asli saja,
// dan hanya pesan teks — kartu agenda/forward tidak bisa diedit)
app.put('/api/chat/rooms/:id/messages/:msgId', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const room = await canAccessRoom(user, req.params.id);
    if (!room) return res.status(403).json({ error: 'Anda tidak memiliki akses ke ruang ini.' });

    const body = (req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
    if (body.length > CHAT_MSG_MAX) {
      return res.status(400).json({ error: `Pesan maksimal ${CHAT_MSG_MAX} karakter.` });
    }

    const { data: existing, error: findErr } = await supabase
      .from('chat_messages').select('sender_id, msg_type, deleted_at')
      .eq('id', req.params.msgId).eq('room_id', room.id).maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: 'Pesan tidak ditemukan.' });
    if (existing.deleted_at) return res.status(400).json({ error: 'Pesan yang sudah dihapus tidak bisa diedit.' });
    if (existing.msg_type !== 'text') return res.status(400).json({ error: 'Hanya pesan teks yang bisa diedit.' });
    if (String(existing.sender_id) !== String(user.id)) {
      return res.status(403).json({ error: 'Anda hanya bisa mengedit pesan Anda sendiri.' });
    }

    let mentions = Array.isArray(req.body.mentions) ? req.body.mentions : [];
    mentions = [...new Set(mentions.map(String))].slice(0, CHAT_MENTIONS_MAX);
    if (mentions.length) {
      const { data: validUsers } = await supabase.from('users').select('id').in('id', mentions);
      const validIds = new Set((validUsers || []).map(u => String(u.id)));
      mentions = mentions.filter(id => validIds.has(id));
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update({ body, mentions, edited_at: new Date().toISOString() })
      .eq('id', req.params.msgId)
      .select(CHAT_MSG_COLUMNS)
      .single();
    if (error) throw error;

    const replyMap = data.reply_to ? await buildReplyMap([data.reply_to]) : {};
    res.json(serializeChatMessage(data, user.id, { [user.id]: user.avatar_url }, replyMap));
  } catch (err) {
    console.error('Chat edit error:', err);
    res.status(500).json({ error: 'Gagal mengedit pesan: ' + err.message });
  }
});

// DELETE /api/chat/rooms/:id/messages/:msgId — hapus pesan (pengirim asli saja)
app.delete('/api/chat/rooms/:id/messages/:msgId', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const room = await canAccessRoom(user, req.params.id);
    if (!room) return res.status(403).json({ error: 'Anda tidak memiliki akses ke ruang ini.' });

    const { data: existing, error: findErr } = await supabase
      .from('chat_messages').select('sender_id, deleted_at')
      .eq('id', req.params.msgId).eq('room_id', room.id).maybeSingle();
    if (findErr) throw findErr;
    if (!existing) return res.status(404).json({ error: 'Pesan tidak ditemukan.' });
    if (existing.deleted_at) return res.json({ ok: true }); // sudah terhapus, anggap sukses
    if (String(existing.sender_id) !== String(user.id)) {
      return res.status(403).json({ error: 'Anda hanya bisa menghapus pesan Anda sendiri.' });
    }

    const { error } = await supabase
      .from('chat_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.msgId);
    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    console.error('Chat delete error:', err);
    res.status(500).json({ error: 'Gagal menghapus pesan: ' + err.message });
  }
});

// POST /api/chat/rooms/:id/read — tandai ruang sudah dibaca
app.post('/api/chat/rooms/:id/read', requireAuth, async (req, res) => {
  try {
    const user = await getChatUser(req);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid.' });

    const room = await canAccessRoom(user, req.params.id);
    if (!room) return res.status(403).json({ error: 'Anda tidak memiliki akses ke ruang ini.' });

    const { error } = await supabase
      .from('chat_reads')
      .upsert({ room_id: room.id, user_id: user.id, last_read_at: new Date().toISOString() },
              { onConflict: 'room_id,user_id' });
    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    console.error('Chat read error:', err);
    res.status(500).json({ error: 'Gagal menandai dibaca: ' + err.message });
  }
});

// ─── Error Handler ────────────────────────────────────────────────────────────
// Multer melempar error lewat next(err) kalau limits.fileSize/fileFilter
// menolak upload (mis. cvNarsum di /api/events). Tanpa handler ini, Express
// jatuh ke handler bawaannya sendiri: halaman HTML generik + stack trace,
// bukan respons JSON yang bisa dibaca frontend.
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Ukuran file terlalu besar.' });
    }
    return res.status(400).json({ error: 'Gagal memproses file: ' + err.message });
  }
  if (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
  next();
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

    // Cleanup absensi lama (>60 hari) — jalan sesaat setelah start, lalu tiap 24 jam
    setTimeout(cleanupOldAttendance, 10 * 1000);
    setInterval(cleanupOldAttendance, 24 * 60 * 60 * 1000);
  });
}
