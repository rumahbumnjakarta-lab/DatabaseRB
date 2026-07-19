# Database Hub Operational — Rumah BUMN Jakarta

Aplikasi Web Database Hub Dinamis berbasis **Node.js (Express.js)** untuk mengelola dokumen, spreadsheet, dan kredensial (akun email & password) operasional divisi Rumah BUMN Jakarta. 

Project ini telah dikonversi dari web statis menjadi aplikasi dinamis yang memudahkan pemeliharaan data melalui dashboard admin tanpa mengubah kode program.

---

## 📂 Struktur Direktori & Tata File

Berikut adalah peta struktur file dalam project ini:

```text
database-RB/
├── data/
│   └── items.json            # Database utama berbentuk berkas JSON terpusat
├── node_modules/             # Folder modul dependensi Node.js (dibuat otomatis)
├── public/                   # Folder aset statis (Client-side)
│   ├── FOTO/                 # Folder penyimpanan aset logo dan gambar
│   │   └── LOGO.png
│   ├── admin.html            # Halaman Hub Divisi Admin
│   ├── business-development.html # Halaman Hub Divisi Business Development
│   ├── design.html           # Halaman Hub Divisi Design
│   ├── email.html            # Halaman Hub Divisi Akun Email
│   ├── event.html            # Halaman Hub Divisi Event
│   ├── index.html            # Landing Page utama (Portal Pemilihan Divisi)
│   ├── manage.html           # Dashboard Admin CRUD (Kelola Link & Sandi)
│   ├── shared.js             # Kode logika JavaScript bersama untuk halaman divisi
│   ├── sosmed.html           # Halaman Hub Divisi Social Media
│   ├── style.css             # Stylesheet global (Desain & Tema UI)
│   └── tampilan.html         # Halaman cadangan (template lama)
├── package.json              # Konfigurasi dependensi project Node.js
├── package-lock.json         # Kunci versi dependensi npm
├── server.js                 # Server Backend Express.js utama
└── README.md                 # Dokumentasi panduan project (file ini)
```

---

## 🎨 Sistem Desain & Antarmuka (UI/UX)

Situs ini menggunakan desain bertema **Premium, Modern & Trustworthy** dengan palet warna elegan berikut yang didefinisikan sebagai variabel CSS di `public/style.css`:

### 1. Token Warna (CSS Variables)
*   `--navy` (`#0F2C4C`): Warna biru tua utama (kepercayaan/korporat).
*   `--navy-deep` (`#0A1E36`): Gradien biru gelap untuk latar belakang hero/navigasi.
*   `--gold` (`#C89A3A`): Emas gelap untuk aksen tombol utama & hover.
*   `--gold-bright` (`#E0B655`): Emas terang untuk teks eyebrow & sorotan.
*   `--paper` (`#F6F4EF`): Latar belakang halaman bertekstur krem lembut (mengurangi kelelahan mata).
*   `--ink` (`#1B2430`): Warna teks utama (hampir hitam).
*   `--line` (`#DCD6C8`): Garis pembatas kartu & border lembut.
*   `--card` (`#FFFFFF`): Latar belakang kartu item (putih bersih).
*   `--green` (`#2E7D5B`): Warna status sukses (misalnya tombol "Tersalin").
*   `--red-warn` (`#B23A2F`): Warna peringatan/bahaya (misalnya tombol hapus/kredensial).

### 2. Aksen Divisi (Accent Colors)
Setiap divisi memiliki kode warna aksen khas untuk border kartu dan latar ikon:
*   **Business Development**: `--accent-bd` (`#C89A3A`) - Emas
*   **Social Media**: `--accent-sosmed` (`#6C5CE7`) - Ungu
*   **Design**: `--accent-design` (`#E84393`) - Merah Muda
*   **Admin**: `--accent-admin` (`#00B894`) - Hijau Tosca
*   **Event**: `--accent-event` (`#F39C12`) - Oranye
*   **Akun Email**: `--accent-email` (`#D44638`) - Merah (Gmail)

### 3. Tipografi (Fonts)
Menggunakan Google Fonts yang di-import langsung di `style.css`:
*   `Inter` (sans-serif): Digunakan untuk **seluruh** elemen teks — heading, deskripsi, tombol, navigasi, kredensial, dan antarmuka umum. Font ini dipilih karena sangat terbaca dan memberikan kesan modern serta profesional.

---

## 🗄️ Skema Database (`data/items.json`)

Data disimpan dalam format array JSON datar (flat array). Setiap item memiliki skema objek berikut:

### 1. Tipe Link (Tautan Dokumen)
```json
{
  "id": "bd-1",
  "division": "bd",
  "cat": "Akademik",
  "title": "SILABUS",
  "type": "link",
  "url": "https://docs.google.com/spreadsheets/...",
  "note": "Spreadsheet silabus."
}
```

### 2. Tipe Kredensial (Akun / Sandi)
```json
{
  "id": "bd-12",
  "division": "bd",
  "cat": "Akun Email",
  "title": "Email Merah",
  "type": "cred",
  "email": "Rumahbumnjakarta@gmail.com",
  "pass": "Rumahbumn0417@",
  "note": "Akun email operasional utama."
}
```

### Penjelasan Properti:
*   `id`: String pengenal unik (UUID digunakan untuk data baru).
*   `division`: Divisi pemilik data. Nilai yang valid: `'bd'` (Business Development), `'sosmed'` (Social Media), `'design'` (Design), `'admin'` (Admin), `'event'` (Event), atau `'email'` (Akun Email).
*   `cat`: String nama kategori (misalnya "Absensi", "Canva", "Surat").
*   `title`: Judul item / dokumen.
*   `type`: Jenis data. Nilai: `'link'` atau `'cred'`.
*   `url`: Alamat URL tautan (wajib jika `type` bernilai `'link'`).
*   `email`: Alamat email akun (wajib jika `type` bernilai `'cred'`).
*   `pass`: Kata sandi akun (wajib jika `type` bernilai `'cred'`).
*   `note`: Keterangan atau catatan tambahan mengenai item.

---

## 🔐 Sistem Autentikasi & Peran (Role-Based Access)

Aplikasi ini memiliki sistem autentikasi dan otorisasi menggunakan **Supabase** untuk menjaga keamanan data internal:

1. **Pendaftaran Akun Tertutup**: Pendaftaran akun baru **tidak dibuka untuk publik** di halaman login. Hanya pengguna dengan peran **Staff** yang dapat mendaftarkan akun untuk anggota baru melalui Dashboard Pengelola (`manage.html`) pada menu **Kelola Akun Tim**.
2. **Penentuan Peran Otomatis (Domain `.id`)**: Peran pengguna (Intern/Staff) ditentukan secara otomatis berdasarkan domain email yang didaftarkan. Aplikasi ini mewajibkan penggunaan domain resmi:
   *   **`@intern.rbjakarta.id`**: Otomatis mendapatkan hak akses **Internship** (hanya dapat melihat data, absen, dan mengedit profil sendiri).
   *   **`@staff.rbjakarta.id`**: Otomatis mendapatkan hak akses **Staff** (akses penuh, dapat mengelola item operasional, melihat rekap absensi seluruh tim, dan mendaftarkan akun baru).

### Contoh Akun Login (Default)
Berikut adalah contoh kredensial bawaan yang dapat digunakan untuk masuk ke dalam sistem:

*   **Akun Staff (Admin):**
    *   **Email**: `admin@staff.rbjakarta.id`
    *   **Password**: `password123`
*   **Akun Internship:**
    *   **Email**: `user@intern.rbjakarta.id`
    *   **Password**: `password123`

---

## 🤖 PETUNJUK UNTUK AI (Instructions for Future AI Agents)

*Jika Anda menggunakan AI untuk mengedit, memodifikasi, atau memperluas aplikasi ini di masa mendatang, berikan petunjuk/instruksi berikut:*

> ### 📌 Panduan Modifikasi bagi AI:
>
> 1.  **Jangan Mengubah Aturan CSS Global:**
>     Semua gaya tampilan diatur di `public/style.css`. Harap selalu gunakan variabel warna yang ada (seperti `var(--navy)`, `var(--gold)`) untuk menjaga keselarasan desain UI premium yang konsisten.
> 
> 2.  **Modifikasi Backend Server:**
>     File `server.js` menangani API CRUD. Selalu lakukan validasi payload data sebelum menulis perubahan ke `data/items.json`. Jika ada field tipe `link`, hapus properti `email`/`pass`. Sebaliknya, jika tipenya `cred`, pastikan property `url` dihapus sebelum disimpan agar file database tetap bersih.
>
> 3.  **Membuat Halaman Divisi Baru:**
>     Jika ingin menambahkan divisi baru (misalnya "Finance"):
>     *   Daftarkan divisinya di dropdown `public/manage.html` (di bagian form input select divisi dan kamus nama divisi `divNames`).
>     *   Tambahkan warna aksen di `:root` CSS (misalnya `--accent-finance`).
>     *   Buat file HTML baru (misalnya `public/finance.html`) dengan meniru struktur `public/design.html` dan arahkan fetch API ke `/api/items?division=finance`.
>     *   Daftarkan menu navigasinya di nav bar halaman divisi (`divTopbar`) dan grid di `public/index.html`.
>
> 4.  **Menambahkan Kategori Baru Secara Otomatis:**
>     Daftar kategori untuk auto-complete form di `manage.html` di-load dinamis menggunakan `updateSuggestions()` berdasarkan kategori unik yang sudah ada di database divisi tersebut. AI tidak perlu meng-hardcode kategori baru di dalam form.

---

## 🚀 Cara Menjalankan Project

1.  Pastikan **Node.js** (versi >= 18) sudah terinstal di komputer.
2.  Install semua dependensi dengan perintah:
    ```bash
    npm install
    ```
3.  Jalankan server dalam mode pengembangan (otomatis me-restart jika ada perubahan file):
    ```bash
    npm run dev
    ```
4.  Buka web browser dan akses alamat berikut:
    *   **Hub Utama**: `http://localhost:3000`
    *   **Dashboard Pengelola**: `http://localhost:3000/manage.html`
