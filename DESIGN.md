# DESIGN.md — Panduan Sistem Desain & Antarmuka (UI/UX)

Dokumen ini menjelaskan fondasi estetika, tokens visual, tata letak antarmuka, dan komponen komponen UI yang digunakan dalam aplikasi **Database Operational Hub — Rumah BUMN Jakarta**.

---

## 🎨 Filosofi Desain

Aplikasi menggunakan pendekatan **Modern, Dark Glassmorphic & Executive Design System**. Antarmuka dirancang untuk memberikan kesan korporat yang profesional, tepercaya, serta nyaman dipandang dalam penggunaan jangka panjang.

### Prinsip Utama:
1. **Premium & Tepercaya**: Penggunaan warna biru tua (*Navy*), aksen emas (*Gold*), dan biru ter terang (*Blue Mid*) mencerminkan identitas Rumah BUMN (BRI & Danantara Indonesia).
2. **Kejelasan Hierarki Visual**: Setiap informasi penting (seperti status absensi, status izin, atau kredensial) ditonjolkan dengan *badge* dan kontras warna yang intuitif.
3. **Responsif & Mobile-First Navigasi**: Bekerja dengan sempurna baik di layar komputer desktop maupun di layar smartphone pengguna melalui *mobile bottom navigation*.

---

## 🗂️ Tokens Warna (CSS Variables in `style.css`)

```css
:root {
  /* Latar Belakang & Permukaan */
  --bg-app: #090e17;             /* Latar belakang utama aplikasi (Ultra Dark Navy) */
  --bg-sidebar: #0d1421;         /* Latar belakang navigasi sidebar */
  --bg-card: #131c2e;            /* Permukaan kartu utama */
  --bg-surface: #19243b;         /* Permukaan input / box sekunder */

  /* Warna Teks */
  --text-primary: #f8fafc;       /* Teks utama (Putih bersih) */
  --text-secondary: #cbd5e1;     /* Teks sekunder (Abu-abu terang) */
  --text-muted: #64748b;         /* Teks label & keterangan (Muted Gray) */

  /* Warna Brand & Aksen */
  --blue-dark: #0857c3;          /* Biru utama korporat */
  --blue-mid: #307fe2;           /* Biru aksen interaktif / tombol */
  --blue-light: #71c5e8;         /* Biru cerah sorotan */
  --gold: #c89a3a;               /* Emas elegan */
  --gold-bright: #e0b655;        /* Emas terang eyebrow */

  /* Border & Pembatas */
  --border: rgba(255, 255, 255, 0.08);     /* Border kartu ultra-subtle */
  --border-mid: rgba(255, 255, 255, 0.15); /* Border input & elemen interaktif */

  /* Indikator Status */
  --color-success: #22c55e;      /* Hijau (Disetujui / Clock In) */
  --color-warning: #f59e0b;      /* Oranye / Kuning (Pending / Menunggu) */
  --color-danger: #ef4444;       /* Merah (Ditolak / Clock Out) */
}
```

---

## 📐 Anatomi Tata Letak (Layout Anatomy)

Seluruh halaman utama mengikuti arsitektur **App Shell**:

```html
<div class="app-shell">
  <!-- 1. Sidebar Navigasi (Desktop) & Overlay Mobile -->
  <div id="sidebarContainer"></div>

  <!-- 2. Area Konten Utama -->
  <main class="app-main">
    <!-- Topbar Header Sticky -->
    <div class="app-topbar">
      <button class="sidebar-toggle" onclick="toggleSidebar()">...</button>
      <div class="topbar-title">Nama Halaman <small>Keterangan Sub</small></div>
    </div>

    <!-- Container Konten Dinamis -->
    <div id="appContent" class="app-content" style="display:none;">
      <div class="page-container">
        <!-- Komponen Kartu & Tabel -->
      </div>
    </div>
  </main>
</div>
```

---

## 🏷️ Aksen Warna Divisi

Setiap divisi operasional memiliki kode warna aksen khas untuk membedakan kartu dan kategori:

| Divisi | Variabel CSS | Kode Warna | Keterangan |
| :--- | :--- | :--- | :--- |
| **Business Development** | `--accent-bd` | `#C89A3A` | Emas Korporat |
| **Social Media** | `--accent-sosmed` | `#6C5CE7` | Ungu Kreatif |
| **Design** | `--accent-design` | `#E84393` | Merah Muda Estetik |
| **Admin** | `--accent-admin` | `#00B894` | Hijau Tosca Administrasi |
| **Event** | `--accent-event` | `#F39C12` | Oranye Publikasi |
| **Akun Email** | `--accent-email` | `#D44638` | Merah Gmail |

---

## 🔤 Tipografi (Typography)

Menggunakan kombinasi Google Fonts modern:
1. **Inter** (`sans-serif`): Digunakan untuk seluruh heading, body text, label form, navigasi, dan antarmuka umum.
2. **JetBrains Mono** (`monospace`): Digunakan untuk elemen data numerik, waktu/jam absensi, jam transaksi, dan statistik angka agar tampak sejajar.

---

## 🧩 Komponen Visual Utama

### 1. Status Badges (Indikator Status Perizinan & Absensi)
- 🟡 **Pending**: `background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.25);`
- 🟢 **Disetujui / Clock In**: `background: rgba(34, 197, 94, 0.12); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.25);`
- 🔴 **Ditolak / Clock Out**: `background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25);`

### 2. Tombol Utama (Primary Gradient Button)
```css
.btn-primary {
  background: linear-gradient(135deg, #307fe2 0%, #1e5bb8 100%);
  color: #ffffff;
  font-weight: 700;
  border-radius: 9px;
  padding: 10px 18px;
  box-shadow: 0 4px 14px rgba(48,127,226,0.3);
}
```

### 3. Modal Glassmorphic & Lightbox
- Modal menggunakan `backdrop-filter: blur(6px)` dengan latar belakang semi-transparan `rgba(0,0,0,0.65)` untuk memfokuskan perhatian pengguna pada form aktif.
- Preview foto/dokumen menggunakan lightbox layar penuh dengan tombol penutup mengambang.
