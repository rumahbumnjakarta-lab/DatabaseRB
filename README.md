# Database Operational Hub — Rumah BUMN Jakarta

Aplikasi Web **Database Hub & Sistem Operasional Internal** berbasis **Node.js (Express.js)** dan **Supabase (PostgreSQL)**. Sistem ini dirancang untuk mengelola link dokumen divisi, kredensial operasional, absensi peserta magang berbasis GPS & foto selfie, serta fitur pengajuan perizinan tidak masuk (izin/sakit) dengan sistem peninjauan mentor.

---

## 🚀 Fitur Utama

### 1. Portal Divisi & Kelola Data (Operational Hub)
- **Hub Divisi**: Akses dokumen, spreadsheet, form, dan akun email untuk divisi Business Development, Social Media, Design, Event, Admin, dan Administrasi.
- **Manajemen Kredensial & Tautan (CRUD)**: Kelola item tautan dan kredensial (email & kata sandi) secara aman sesuai dengan role pengguna.
- **Copy to Clipboard 1-Click**: Fitur salin email, password, dan URL dengan sekali klik.

### 2. Autentikasi & Pengaturan Role (Staff vs Internship)
- **Penentuan Role Otomatis via Email Domain**:
  - Domain `@staff.rbjakarta.id` → **Role Staff / Mentor** (Akses admin penuh, kelola user, rekap absensi, dan review perizinan).
  - Domain `@intern.rbjakarta.id` → **Role Internship** (Akses absensi, pengajuan perizinan pribadi, dan portal divisi).
- **Sesi Aman berbasis Cookie**: Menggunakan cookie session terenkripsi yang kompatibel dengan arsitektur serverless.

### 3. Sistem Absensi Digital (GPS & Foto Selfie)
- **Validasi Geofencing GPS**: Memastikan absensi dilakukan dalam radius area lokasi yang ditentukan menggunakan Leaflet.js maps.
- **Foto Selfie Verification**: Mengambil foto selfie via kamera perangkat sebagai bukti kehadiran.
- **Rekap Absensi Real-time**: Panel rekap absensi harian untuk Staff dengan fitur filter tanggal dan auto-refresh.

### 4. Perizinan Tidak Masuk & Kontrol Mentor (Izin / Sakit)
- **Pengajuan Izin & Sakit (Internship)**: Pengajuan izin tidak masuk melampirkan tanggal mulai/selesai, alasan, dan unggah foto/dokumen bukti pendukung (maksimal 1 MB).
- **Review & Komentar Mentor (Staff)**: Staff/Mentor dapat meninjau perizinan, menentukan keputusan status (**Disetujui / Ditolak**), dan memberikan **Catatan Staff / Komentar Mentor**.
- **Privasi Terjamin**: Data perizinan bersifat privat untuk akun Internship (hanya dapat dilihat oleh pemilik akun dan Staff).

---

## 🛠️ Teknologi Yang Digunakan

- **Backend**: Node.js, Express.js, `@supabase/supabase-js`, `bcryptjs`, `cookie-session`, `dotenv`.
- **Database**: Supabase PostgreSQL.
- **Frontend**: HTML5, Vanilla CSS3 (Custom Design Tokens & Glassmorphism UI), Vanilla JavaScript (ES6+).
- **Libraries & Icons**: Lucide Icons, Leaflet.js (GPS Mapping), SweetAlert2.

---

## 📂 Struktur Direktori Project

```text
DatabaseRB/
├── public/                       # Berkas Aset Statis & Tampilan Frontend
│   ├── FOTO/                     # Aset logo & gambar aplikasi
│   ├── absen.html                # Halaman Absensi Digital (GPS & Kamera)
│   ├── admin.html                # Portal Divisi Admin
│   ├── administrasi.html         # Portal Divisi Administrasi (Staff Only)
│   ├── business-development.html # Portal Divisi Business Development
│   ├── design.html               # Portal Divisi Design
│   ├── email.html                # Portal Divisi Akun Email (Staff Only)
│   ├── event.html                # Portal Divisi Event
│   ├── index.html                # Dashboard Utama Aplikasi
│   ├── login.html                # Halaman Masuk (Login)
│   ├── manage-users.html         # Kelola Pengguna & Akun (Staff Only)
│   ├── manage.html               # Kelola Link & Kredensial Divisi (Staff Only)
│   ├── perizinan.html            # Halaman Pengajuan Izin/Sakit & Review Mentor
│   ├── rekap-absen.html          # Rekap Absensi Real-time (Staff Only)
│   ├── shared.js                 # App Shell, Sidebar, Navigation, & Shared Utilities
│   ├── sosmed.html               # Portal Divisi Social Media
│   ├── style.css                 # Master Stylesheet (Design System & Tokens)
│   └── theme.js                  # Theme Manager Utility
├── .env                          # Konfigurasi Environment (Supabase URL & Keys)
├── AI.md                         # Panduan Konteks & Arsitektur Teknis untuk AI Assistant
├── DESIGN.md                     # Dokumentasi Sistem Desain UI/UX
├── schema_permissions.sql        # Skrip SQL Tabel Perizinan Supabase
├── server.js                     # Server Utama Backend Express.js
└── package.json                  # Manifes Dependensi Node.js
```

---

## ⚙️ Panduan Instalasi & Pengaturan

### 1. Clone & Install Dependensi
```bash
git clone <repository_url>
cd DatabaseRB
npm install
```

### 2. Konfigurasi Environment (`.env`)
Buat atau sesuaikan berkas `.env` di direktori utama:
```env
SUPABASE_URL=https://<your_supabase_project_ref>.supabase.co
SUPABASE_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>
PORT=3000
SESSION_SECRET=rumahbumn-super-secret-session-key-2024
```

### 3. Eksekusi Skrip Database di Supabase
Buka **Supabase Dashboard → SQL Editor**, kemudian jalankan query pembuatan tabel:
- Tabel `permissions` (bisa dilihat di `schema_permissions.sql`):
```sql
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_role TEXT DEFAULT 'internship',
  type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  document_url TEXT,
  status TEXT DEFAULT 'pending',
  mentor_comment TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.permissions DISABLE ROW LEVEL SECURITY;
```

### 4. Jalankan Aplikasi
- **Mode Pengembangan (Dev Mode)**:
  ```bash
  npm run dev
  ```
- **Mode Produksi (Start Mode)**:
  ```bash
  npm start
  ```
Akses di peramban: `http://localhost:3000` (atau `http://localhost:3000/login.html`).

---

## 🔑 Akun Uji Coba Default

- **Akun Staff / Mentor**:
  - Email: `admin@staff.rbjakarta.id`
  - Password: `12345678`
- **Akun Internship / User**:
  - Email: `user@intern.rbjakarta.id`
  - Password: `12345678`

---

## 📄 Lisensi
Dipersembahkan untuk **Rumah BUMN Jakarta** (Kolaborasi BRI & Danantara Indonesia).
