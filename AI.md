# AI.md — Buku Panduan Arsitektur & Context Handbook untuk AI Coding Agent

Dokumen ini dibuat khusus sebagai panduan konteks teknis untuk AI Assistant (seperti Antigravity, Gemini, ChatGPT, Claude) agar dapat memahami arsitektur, struktur kode, aturan bisnis, dan skema database proyek **Database Operational Hub — Rumah BUMN Jakarta** secara komprehensif.

---

## 📌 Ringkasan Proyek

- **Nama Proyek**: Database Operational Hub — Rumah BUMN Jakarta
- **Tujuan**: Aplikasi web internal untuk pengelolaan dokumen divisi, kredensial akun, sistem absensi digital GPS & foto selfie, serta pengajuan perizinan tidak masuk (izin/sakit) dengan sistem review mentor.
- **Teknologi Utama**:
  - **Backend**: Node.js, Express.js (`server.js`), `@supabase/supabase-js`, `bcryptjs`, `cookie-session`, `dotenv`.
  - **Database**: Supabase PostgreSQL.
  - **Frontend**: Vanilla HTML5, Vanilla CSS3 (`style.css`), ES6 JavaScript (`shared.js`).
  - **Pustaka Tambahan**: Lucide Icons, Leaflet.js (GPS maps), SweetAlert2.
- **Target Mode Pengoperasian**:
  - Localhost (`app.listen` pada port 3000).
  - Vercel Serverless Function (Ekspor `module.exports = app` jika `process.env.VERCEL` aktif).

---

## 🗂️ Peta File & Responsibilitas

```text
DatabaseRB/
├── server.js                     # Backend Express.js utama: Auth, Middleware, REST APIs
├── schema_permissions.sql        # Migration SQL untuk tabel permissions di Supabase
├── public/                       # Berkas Frontend (Client-side)
│   ├── shared.js                 # Shared library: Auth guard (initAppShell), Sidebar builder, Modals
│   ├── style.css                 # Master CSS: Design tokens, Layout App Shell, UI components
│   ├── theme.js                  # Theme preference manager
│   ├── index.html                # Dashboard / Portal Utama
│   ├── login.html                # Halaman Autentikasi Login
│   ├── absen.html                # Absensi GPS & Selfie untuk Peserta Magang
│   ├── perizinan.html            # Form Pengajuan Izin/Sakit & Panel Review Mentor
│   ├── rekap-absen.html          # Rekap Absensi Real-time (Staff Only)
│   ├── manage-users.html         # Manajemen Akun Pengguna (Staff Only)
│   ├── manage.html               # Manajemen Link & Kredensial Divisi (Staff Only)
│   ├── business-development.html # Hub Divisi Business Development
│   ├── sosmed.html               # Hub Divisi Social Media
│   ├── design.html               # Hub Divisi Design
│   ├── event.html                # Hub Divisi Event
│   ├── admin.html                # Hub Divisi Admin
│   ├── administrasi.html         # Hub Divisi Administrasi (Staff Only)
│   └── email.html                # Hub Divisi Akun Email (Staff Only)
├── .env                          # Variabel lingkungan (SUPABASE_URL, SUPABASE_KEY, etc.)
├── README.md                     # Panduan umum proyek & instalasi
├── DESIGN.md                     # Dokumentasi UI/UX Design System
└── AI.md                         # Dokumen Panduan Konteks AI (File ini)
```

---

## 🗄️ Skema Database Supabase

### 1. Tabel `users`
Mengelola akun pengguna aplikasi.
```sql
CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'staff' atau 'internship'
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. Aturan Otomatisasi Role Pengguna
Aturan penentuan role ditentukan berdasarkan domain email pada `server.js`:
- Email berakhiran `@staff.rbjakarta.id` → **`role = 'staff'`** (Mentor / Staff Admin).
- Email berakhiran `@intern.rbjakarta.id` → **`role = 'internship'`** (Peserta Magang).

### 3. Tabel `permissions` (Perizinan Tidak Masuk)
Mengelola pengajuan sakit/izin dan keputusan review mentor.
```sql
CREATE TABLE public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT DEFAULT 'internship',
  type TEXT NOT NULL, -- 'sakit', 'izin', 'cuti', 'lainnya'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  document_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  mentor_comment TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Tabel `attendance` (Absensi)
```sql
CREATE TABLE public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT NOT NULL,
  type TEXT NOT NULL, -- 'clock_in' atau 'clock_out'
  photo_url TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  address TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);
```

### 5. Tabel `items` (Dokumen & Kredensial Divisi)
```sql
CREATE TABLE public.items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  division TEXT NOT NULL, -- 'bd', 'sosmed', 'design', 'event', 'admin', 'administrasi', 'email'
  cat TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'link' atau 'cred'
  url TEXT,
  email TEXT,
  pass TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📡 Registry API Endpoints Backend (`server.js`)

### Autentikasi (`/auth/*`)
- `POST /auth/login`: Verifikasi email & password Hash, menyimpan sesi cookie `req.session.user`.
- `POST /auth/logout`: Menghapus sesi cookie pengguna.
- `GET /auth/me`: Mengembalikan data pengguna yang sedang aktif/login.
- `POST /auth/register`: Mendaftarkan pengguna baru (Bebas registrasi jika 0 pengguna, selebihnya memerlukan `requireStaff`).

### Perizinan (`/api/permissions`)
- `GET /api/permissions`: 
  - **Internship**: Hanya mengembalikan data perizinan milik dirinya sendiri (`user_id = req.session.user.id`).
  - **Staff**: Mengembalikan seluruh data perizinan magang dengan dukungan query filter `status` dan `user_id`.
- `POST /api/permissions`: Mengajukan perizinan baru (`type`, `start_date`, `end_date`, `reason`, `document_base64`). Validasi batas ukuran unggah file adalah **1 MB**.
- `PUT /api/permissions/:id/status` *(Staff Only)*: Mengubah status perizinan (`approved` / `rejected`) dan memberikan `mentor_comment`.
- `DELETE /api/permissions/:id`: Menghapus pengajuan perizinan (Hanya milik sendiri jika masih status `pending`, atau oleh Staff).

### Absensi (`/api/absen`)
- `POST /api/absen`: Menyimpan data clock-in/out dengan koordinat GPS dan foto selfie.
- `GET /api/absen/today`: Mengambil data absensi hari ini.
- `GET /api/absen` *(Staff Only)*: Rekap data absensi berdasarkan tanggal/user.

### Manajemen User & Items (`/api/users`, `/api/items`)
- `GET /api/users` *(Staff Only)*: Mengambil daftar pengguna.
- `PUT /api/users/:id` *(Staff Only)*: Mengedit profil/role pengguna.
- `DELETE /api/users/:id` *(Staff Only)*: Menghapus pengguna.
- `GET /api/items`: Mengambil item link/kredensial divisi.
- `POST /api/items` *(Staff/Authorized)*: Tambah item divisi.
- `PUT /api/items/:id` *(Staff/Authorized)*: Edit item divisi.
- `DELETE /api/items/:id` *(Staff/Authorized)*: Hapus item divisi.

---

## 🔒 Aturan Privasi & Keamanan (Aturan Wajib AI Agent)

1. **Privasi Data Perizinan**:
   - Jangan pernah mengubah query `GET /api/permissions` yang membiarkan akun `internship` melihat perizinan pengguna lain. Filter `query.eq('user_id', req.session.user.id)` adalah aturan keamanan mutlak.
2. **Handling Error Skema Database**:
   - Selalu pertahankan error handler untuk kode `42P01` dan `PGRST205` / `schema cache` di `server.js` agar sistem dapat memberikan instruksi ramah apabila tabel di Supabase belum dibuat.
3. **Batas Ukuran File Upload**:
   - Batas maksimal ukuran unggah foto dokumen perizinan adalah **1 MB**.
4. **Proteksi Role Staff**:
   - Endpoint sensitif (`requireStaff`) seperti kelola akun, rekap absensi, dan review mentor harus selalu dilindungi middleware `requireStaff`.

---

## 💻 Pola Integrasi Frontend (`shared.js`)

Seluruh halaman divisi dan fitur utama menginisialisasi antarmuka melalui `initAppShell`:

```javascript
initAppShell('key_halaman', function(user) {
  // Callback dijalankan setelah auth terverifikasi
  // user.role ('staff' atau 'internship')
});
```

- `initAppShell` menginjeksi sidebar navigasi ke `#sidebarContainer`, mengatur topbar header, dan menampilkan `#appContent` secara halus.
