// ============================================================
//   silabus-form.js — Modal "Tambah Silabus" (wizard 4 langkah)
//
//   Satu komponen yang dipakai bareng oleh Event Hub (event-hub.html)
//   dan Silabus (agenda-hub.html), supaya form tambahnya selalu sama
//   di dua halaman itu. Butuh /css/silabus-form.css.
//
//   Pemakaian:
//     SilabusForm.init({ onSaved: function (saved) { ...reload data... } });
//     SilabusForm.open();                        // buka form kosong
//     SilabusForm.open({ event_date: '2026-10-12' }); // + isian awal
//
//   Field yang dikirim (name) sama persis dengan form lama, jadi
//   POST /api/events di server.js tidak perlu diubah.
// ============================================================

(function () {
  'use strict';

  // Ikon Lucide versi inline — sengaja tidak pakai <i data-lucide>, supaya
  // tidak tergantung kapan lucide.createIcons() dipanggil tiap halaman.
  const ICONS = {
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    calendarPlus: '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
    presentation: '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    clipboardList: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    table: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    graduationCap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    minus: '<path d="M5 12h14"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>'
  };
  function icon(name, cls) {
    return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  // Pilihan kategori di form = jenis kegiatan saja.
  const CATEGORIES = [
    ['Pelatihan', '#155eef'], ['Seminar', '#7c5cfc'], ['Workshop', '#ea580c'],
    ['Webinar', '#0891b2'], ['Coaching', '#12b76a'], ['Networking', '#db2777'],
    ['Lainnya', '#64748b']
  ];
  // Kategori lama yang sudah tidak bisa dipilih lagi di form, tapi masih
  // dipakai oleh acara yang sudah tersimpan — warnanya tetap dipertahankan
  // supaya tampilan acara lama di kalender tidak berubah jadi abu-abu.
  const LEGACY_CATEGORY_COLORS = [
    ['Silabus BD', '#d97706'], ['UMIBA', '#0d9488'], ['GBKP Moria', '#9333ea'],
    ['Event', '#dc2626'], ['Audiensi', '#4f46e5'], ['Design', '#c026d3'],
    ['Sosmed', '#ca8a04'], ['Admin', '#0284c7']
  ];

  const STEPS = [
    { label: 'Info Dasar', icon: 'fileText', title: 'Info dasar kegiatan', desc: 'Kasih judul yang jelas, lalu pilih kategorinya.' },
    { label: 'Jadwal & Tempat', icon: 'calendar', title: 'Kapan & di mana?', desc: 'Tentukan tanggal, jam, dan lokasi acaranya.' },
    { label: 'Tim & Peserta', icon: 'users', title: 'Siapa yang terlibat?', desc: 'Isi yang sudah pasti saja — sisanya boleh dilewati.', optional: true },
    { label: 'Tautan', icon: 'link', title: 'Tautan & publikasi', desc: 'Semua isian di langkah ini opsional.', optional: true }
  ];
  const LAST = STEPS.length - 1;

  const LINKS = [
    { name: 'link_zoom', label: 'Link Zoom', icon: 'video', color: '#2d8cff', ph: 'https://zoom.us/j/...' },
    { name: 'link_umkm', label: 'Link Pendataan UMKM', icon: 'store', color: '#ea580c', ph: 'https://...' },
    { name: 'link_pendaftaran_gform', label: 'Link Form Pendaftaran', icon: 'clipboardList', color: '#7c5cfc', ph: 'https://forms.gle/...' },
    { name: 'spreadsheets_data_peserta', label: 'Link Spreadsheet Data Peserta', icon: 'table', color: '#12b76a', ph: 'https://docs.google.com/spreadsheets/...' }
  ];

  const PEOPLE = [
    { name: 'speaker_name', label: 'Narasumber', icon: 'presentation', color: '#7c5cfc', ph: 'Nama narasumber' },
    { name: 'pic_name', label: 'PIC', icon: 'userCheck', color: '#155eef', ph: 'Nama penanggung jawab' },
    { name: 'mc', label: 'MC', icon: 'mic', color: '#db2777', ph: 'Nama MC' }
  ];

  // ── Markup ──────────────────────────────────────────────────
  function quick(chips) {
    return '<div class="sf-quick">' + chips.join('') + '</div>';
  }
  function qchip(attrs, html) {
    return '<button type="button" class="sf-qchip" ' + attrs + '>' + html + '</button>';
  }
  function errLine(msg) {
    return '<div class="sf-err">' + icon('alert') + '<span>' + msg + '</span></div>';
  }
  function panelHead(i) {
    const s = STEPS[i];
    return '<div class="sf-panel-head"><h4>' + s.title +
      (s.optional ? ' <span class="sf-pill-opt">Opsional</span>' : '') +
      '</h4><p>' + s.desc + '</p></div>';
  }

  function buildMarkup() {
    const stepper = STEPS.map(function (s, i) {
      return '<button type="button" class="sf-step" data-goto="' + i + '" aria-label="Langkah ' + (i + 1) + ': ' + s.label + '">' +
        '<span class="sf-step-dot">' + icon(s.icon, 'sf-ico-step') + icon('check', 'sf-ico-check') + '</span>' +
        '<span class="sf-step-label">' + s.label + '</span></button>';
    }).join('');

    const cats = '<div class="sf-chip-grid">' +
      CATEGORIES.map(function (it) {
        return '<label class="sf-cat" style="--c:' + it[1] + '"><input type="radio" name="category" value="' + it[0] + '"><span>' + it[0] + '</span></label>';
      }).join('') + '</div>';

    const panel0 =
      '<section class="sf-panel" data-panel="0">' + panelHead(0) +
        '<div class="sf-field" data-field="title">' +
          '<label class="sf-label" for="sfTitle">Judul Acara / Silabus <span class="sf-req">*</span><span class="sf-label-aside" id="sfTitleCount">0/150</span></label>' +
          '<input class="sf-input sf-input-lg" id="sfTitle" name="title" maxlength="150" autocomplete="off" placeholder="Contoh: Pelatihan Digital Marketing UMKM">' +
          errLine('Judul acara wajib diisi.') +
        '</div>' +
        '<div class="sf-field" data-field="category">' +
          '<div class="sf-label">Kategori <span class="sf-req">*</span></div>' + cats +
          errLine('Pilih salah satu kategori.') +
        '</div>' +
        '<div class="sf-field">' +
          '<label class="sf-label" for="sfJenis">Jenis Pelatihan <span class="sf-label-aside">Opsional</span></label>' +
          '<div class="sf-input-wrap">' + icon('layers', 'sf-input-ico') +
            '<input class="sf-input" id="sfJenis" name="jenis_pelatihan" autocomplete="off" placeholder="Soft Skill / Hard Skill"></div>' +
          quick([qchip('data-fill="jenis_pelatihan" data-val="Soft Skill"', 'Soft Skill'), qchip('data-fill="jenis_pelatihan" data-val="Hard Skill"', 'Hard Skill')]) +
        '</div>' +
      '</section>';

    const panel1 =
      '<section class="sf-panel" data-panel="1">' + panelHead(1) +
        '<div class="sf-field" data-field="event_date">' +
          '<label class="sf-label" for="sfDate">Tanggal <span class="sf-req">*</span></label>' +
          '<div class="sf-input-wrap">' + icon('calendar', 'sf-input-ico') +
            '<input type="date" class="sf-input" id="sfDate" name="event_date"></div>' +
          quick([qchip('data-days="0"', 'Hari ini'), qchip('data-days="1"', 'Besok'), qchip('data-days="7"', 'Minggu depan')]) +
          '<div class="sf-hint" id="sfDateHint" hidden></div>' +
          errLine('Tanggal acara wajib diisi.') +
        '</div>' +
        '<div class="sf-field" data-field="time">' +
          '<div class="sf-label">Waktu <span class="sf-label-aside">Opsional</span></div>' +
          '<div class="sf-time-row">' +
            '<div><span class="sf-time-cap">Mulai</span><div class="sf-input-wrap">' + icon('clock', 'sf-input-ico') +
              '<input type="time" class="sf-input" id="sfStart" name="start_time"></div></div>' +
            '<span class="sf-time-sep">' + icon('arrowRight') + '</span>' +
            '<div><span class="sf-time-cap">Selesai</span><div class="sf-input-wrap">' + icon('clock', 'sf-input-ico') +
              '<input type="time" class="sf-input" id="sfEnd" name="end_time"></div></div>' +
          '</div>' +
          quick([
            qchip('data-time="08:00-12:00"', 'Pagi <small>08.00–12.00</small>'),
            qchip('data-time="13:00-16:00"', 'Siang <small>13.00–16.00</small>'),
            qchip('data-time="09:00-16:00"', 'Seharian <small>09.00–16.00</small>')
          ]) +
          '<div class="sf-hint" id="sfTimeHint" hidden></div>' +
        '</div>' +
        '<div class="sf-grid-2">' +
          '<div class="sf-field">' +
            '<label class="sf-label" for="sfLoc">Lokasi / Platform</label>' +
            '<div class="sf-input-wrap">' + icon('mapPin', 'sf-input-ico') +
              '<input class="sf-input" id="sfLoc" name="location" autocomplete="off" placeholder="Aula Lt.2 / Zoom"></div>' +
            quick([qchip('data-fill="location" data-val="Zoom"', 'Zoom'), qchip('data-fill="location" data-val="Google Meet"', 'Google Meet'), qchip('data-fill="location" data-val="Aula Lt.2"', 'Aula Lt.2')]) +
          '</div>' +
          '<div class="sf-field">' +
            '<label class="sf-label" for="sfKelas">Kelas / Format</label>' +
            '<div class="sf-input-wrap">' + icon('graduationCap', 'sf-input-ico') +
              '<input class="sf-input" id="sfKelas" name="kelas" autocomplete="off" placeholder="Kelas A / Offline / Online"></div>' +
            quick([qchip('data-fill="kelas" data-val="Offline"', 'Offline'), qchip('data-fill="kelas" data-val="Online"', 'Online'), qchip('data-fill="kelas" data-val="Hybrid"', 'Hybrid')]) +
          '</div>' +
        '</div>' +
      '</section>';

    const people = PEOPLE.map(function (p) {
      return '<div class="sf-person">' +
        '<div class="sf-avatar" data-avatar="' + p.name + '" style="--av:' + p.color + '">' + icon(p.icon) + '</div>' +
        '<div class="sf-person-main"><label class="sf-label" for="sf_' + p.name + '">' + p.label + '</label>' +
        '<input class="sf-input" id="sf_' + p.name + '" name="' + p.name + '" autocomplete="off" placeholder="' + p.ph + '"></div>' +
      '</div>';
    }).join('');

    const panel2 =
      '<section class="sf-panel" data-panel="2">' + panelHead(2) +
        '<div class="sf-person-list">' + people + '</div>' +
        '<div class="sf-field">' +
          '<label class="sf-label" for="sfPeserta">Target Peserta</label>' +
          '<div class="sf-counter-row">' +
            '<div class="sf-counter">' +
              '<button type="button" data-count="-1" aria-label="Kurangi">' + icon('minus') + '</button>' +
              '<input type="number" id="sfPeserta" name="jumlah_peserta" min="0" inputmode="numeric" placeholder="0">' +
              '<button type="button" data-count="1" aria-label="Tambah">' + icon('plus') + '</button>' +
            '</div>' +
            quick(['20', '30', '50', '100'].map(function (n) { return qchip('data-fill="jumlah_peserta" data-val="' + n + '"', n + ' orang'); })) +
          '</div>' +
        '</div>' +
      '</section>';

    const links = LINKS.map(function (l) {
      return '<div class="sf-link" data-link="' + l.name + '" style="--lc:' + l.color + '">' +
        '<span class="sf-link-ico">' + icon(l.icon) + '</span>' +
        '<div class="sf-link-main"><label for="sf_' + l.name + '">' + l.label + '</label>' +
        '<input type="url" id="sf_' + l.name + '" name="' + l.name + '" inputmode="url" autocomplete="off" placeholder="' + l.ph + '"></div>' +
        '<span class="sf-link-state" title="">' + icon('check', 'sf-ico-ok') + icon('alert', 'sf-ico-bad') + '</span>' +
      '</div>';
    }).join('');

    const panel3 =
      '<section class="sf-panel" data-panel="3">' +
        '<div class="sf-summary">' +
          '<div class="sf-sum-top"><span class="sf-sum-cat" id="sfSumCat"></span>' +
            '<button type="button" class="sf-sum-edit" data-goto="0">' + icon('pencil') + 'Ubah</button></div>' +
          '<div class="sf-sum-title" id="sfSumTitle"></div>' +
          '<div class="sf-sum-meta" id="sfSumMeta"></div>' +
        '</div>' +
        panelHead(3) +
        '<div class="sf-field" data-field="links"><div class="sf-links">' + links + '</div>' +
          errLine('Ada tautan yang formatnya belum benar — contoh yang benar: https://zoom.us/j/123') +
        '</div>' +
        '<div class="sf-field" style="margin-top:18px;">' +
          '<label class="sf-label" for="sfCaption">' + icon('megaphone') + ' Caption Sosmed <span class="sf-label-aside" id="sfCaptionCount">0 karakter</span></label>' +
          '<textarea class="sf-input" id="sfCaption" name="caption_sosmed" placeholder="Caption singkat untuk publikasi..."></textarea>' +
        '</div>' +
      '</section>';

    return '' +
      '<div class="sf-modal" role="dialog" aria-modal="true" aria-labelledby="sfHeadTitle">' +
        '<div class="sf-header">' +
          '<div class="sf-head-icon">' + icon('calendarPlus') + '</div>' +
          '<div class="sf-head-text"><h3 id="sfHeadTitle">Tambah Silabus Baru</h3>' +
            '<p>Isi langkah demi langkah — yang wajib cuma judul, kategori &amp; tanggal.</p></div>' +
          '<button type="button" class="sf-close" data-act="close" title="Tutup" aria-label="Tutup">' + icon('x') + '</button>' +
        '</div>' +
        '<div class="sf-stepper">' + stepper + '</div>' +
        '<form class="sf-form" id="sfForm" novalidate>' +
          '<div class="sf-body" id="sfBody">' + panel0 + panel1 + panel2 + panel3 + '</div>' +
          '<div class="sf-footer">' +
            '<div class="sf-foot-info">Langkah <b id="sfStepNum">1</b> dari ' + STEPS.length +
              '<span class="sf-foot-bar"><i id="sfBar"></i></span></div>' +
            '<button type="button" class="sf-btn sf-btn-ghost" data-act="close" id="sfCancel">Batal</button>' +
            '<button type="button" class="sf-btn sf-btn-ghost" id="sfBack" hidden>' + icon('chevronLeft') + '<span class="sf-btn-txt">Kembali</span></button>' +
            '<button type="button" class="sf-btn sf-btn-primary" id="sfNext"><span id="sfNextTxt">Lanjut</span>' + icon('chevronRight') + '</button>' +
            '<button type="submit" class="sf-btn sf-btn-primary sf-btn-save" id="sfSave" hidden>' + icon('save') + '<span>Simpan Silabus</span></button>' +
          '</div>' +
        '</form>' +
      '</div>';
  }

  // ── State ───────────────────────────────────────────────────
  let root = null, form = null, body = null;
  let cur = 0, visited = new Set([0]), dirty = false, saving = false;
  const shown = new Set(); // langkah yang error-nya sudah pernah ditampilkan
  let opts = {};

  const $ = function (sel) { return root.querySelector(sel); };
  const field = function (name) { return form.elements[name]; };
  const val = function (name) {
    const el = field(name);
    return el ? String(el.value || '').trim() : '';
  };
  const categoryVal = function () {
    const c = form.querySelector('input[name="category"]:checked');
    return c ? c.value : '';
  };

  // ── Tanggal & waktu ─────────────────────────────────────────
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoLocal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function today0() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function toMin(t) {
    const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function fmtTime(t) { return (t || '').slice(0, 5).replace(':', '.'); }
  function fmtDate(d, short) {
    return d.toLocaleDateString('id-ID', short
      ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
      : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function updateDateHint() {
    const hint = $('#sfDateHint');
    const d = parseISO(val('event_date'));
    root.querySelectorAll('[data-days]').forEach(function (b) {
      const t = today0(); t.setDate(t.getDate() + (+b.dataset.days));
      b.classList.toggle('is-on', !!d && isoLocal(t) === val('event_date'));
    });
    if (!d) { hint.hidden = true; return; }
    const diff = Math.round((d - today0()) / 86400000);
    let rel;
    if (diff === 0) rel = 'hari ini';
    else if (diff === 1) rel = 'besok';
    else if (diff > 1) rel = diff + ' hari lagi';
    else rel = 'sudah lewat ' + Math.abs(diff) + ' hari';
    hint.className = 'sf-hint' + (diff < 0 ? ' is-warn' : '');
    hint.innerHTML = icon('calendar') + '<span></span>';
    hint.querySelector('span').textContent = fmtDate(d) + ' · ' + rel;
    hint.hidden = false;
  }

  function timeState() {
    const s = toMin(val('start_time')), e = toMin(val('end_time'));
    if (s === null || e === null) return { ok: true };
    return { ok: e > s, dur: e - s };
  }
  function updateTimeHint() {
    const hint = $('#sfTimeHint');
    const st = timeState();
    root.querySelectorAll('[data-time]').forEach(function (b) {
      const p = b.dataset.time.split('-');
      b.classList.toggle('is-on', val('start_time') === p[0] && val('end_time') === p[1]);
    });
    if (st.dur === undefined) { hint.hidden = true; return; }
    if (!st.ok) {
      hint.className = 'sf-hint is-bad';
      hint.innerHTML = icon('alert') + '<span>Jam selesai harus setelah jam mulai.</span>';
    } else {
      const h = Math.floor(st.dur / 60), m = st.dur % 60;
      hint.className = 'sf-hint';
      hint.innerHTML = icon('clock') + '<span>Durasi ' + (h ? h + ' jam' : '') + (h && m ? ' ' : '') + (m ? m + ' menit' : '') + '</span>';
    }
    hint.hidden = false;
  }

  // ── Tautan ──────────────────────────────────────────────────
  // Kosong → netral; http(s)://… valid → ok; "zoom.us/j/1" dilengkapi
  // https:// otomatis saat keluar dari kolom; selain itu → salah.
  function linkState(v) {
    if (!v) return '';
    try {
      const u = new URL(v);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.indexOf('.') > 0 ? 'ok' : 'bad';
    } catch (e) {
      return /^[^\s/]+\.[^\s]{2,}/.test(v) ? 'fixable' : 'bad';
    }
  }
  function updateLink(box, finalize) {
    const input = box.querySelector('input');
    let v = input.value.trim();
    let st = linkState(v);
    if (st === 'fixable' && finalize) { input.value = v = 'https://' + v; st = linkState(v); }
    box.classList.toggle('is-ok', st === 'ok' || st === 'fixable');
    box.classList.toggle('is-bad', st === 'bad' && (finalize || box.classList.contains('is-bad')));
    return st;
  }

  // ── Orang & peserta ─────────────────────────────────────────
  function initials(name) {
    const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function updateAvatar(name) {
    const av = root.querySelector('[data-avatar="' + name + '"]');
    if (!av) return;
    const ini = initials(val(name));
    const p = PEOPLE.find(function (x) { return x.name === name; });
    av.classList.toggle('is-filled', !!ini);
    if (ini) av.textContent = ini;
    else av.innerHTML = icon(p.icon);
  }

  function syncFillChips(name) {
    const v = val(name).toLowerCase();
    root.querySelectorAll('[data-fill="' + name + '"]').forEach(function (b) {
      b.classList.toggle('is-on', !!v && b.dataset.val.toLowerCase() === v);
    });
  }

  // ── Ringkasan (langkah 4) ───────────────────────────────────
  function metaItem(ic, text) {
    const s = document.createElement('span');
    s.innerHTML = icon(ic);
    s.appendChild(document.createTextNode(text));
    return s;
  }
  function updateSummary() {
    $('#sfSumCat').textContent = categoryVal() || 'Tanpa kategori';
    $('#sfSumTitle').textContent = val('title') || '(Judul belum diisi)';
    const meta = $('#sfSumMeta');
    meta.textContent = '';
    const d = parseISO(val('event_date'));
    if (d) meta.appendChild(metaItem('calendar', fmtDate(d, true)));
    if (val('start_time')) meta.appendChild(metaItem('clock', fmtTime(val('start_time')) + (val('end_time') ? '–' + fmtTime(val('end_time')) : '') + ' WIB'));
    if (val('location')) meta.appendChild(metaItem('mapPin', val('location')));
    if (val('jumlah_peserta')) meta.appendChild(metaItem('users', val('jumlah_peserta') + ' peserta'));
  }

  // ── Validasi ────────────────────────────────────────────────
  function setInvalid(name, bad) {
    const f = root.querySelector('[data-field="' + name + '"]');
    if (f) f.classList.toggle('is-invalid', !!bad);
  }
  function shake(el) {
    if (!el) return;
    el.classList.remove('sf-shake'); void el.offsetWidth; el.classList.add('sf-shake');
  }
  // Mengembalikan daftar nama field yang salah di langkah i.
  function problems(i) {
    const bad = [];
    if (i === 0) {
      if (!val('title')) bad.push('title');
      if (!categoryVal()) bad.push('category');
    } else if (i === 1) {
      if (!parseISO(val('event_date'))) bad.push('event_date');
      if (!timeState().ok) bad.push('time');
    } else if (i === 3) {
      const anyBad = Array.prototype.some.call(root.querySelectorAll('.sf-link'), function (box) {
        return linkState(box.querySelector('input').value.trim()) === 'bad';
      });
      if (anyBad) bad.push('links');
    }
    return bad;
  }
  function showProblems(i) {
    const bad = problems(i);
    const names = { 0: ['title', 'category'], 1: ['event_date', 'time'], 3: ['links'] }[i] || [];
    names.forEach(function (n) { setInvalid(n, bad.indexOf(n) !== -1); });
    if (i === 3) root.querySelectorAll('.sf-link').forEach(function (b) { updateLink(b, true); });
    if (bad.length) {
      shown.add(i);
      const first = root.querySelector('[data-field="' + bad[0] + '"]');
      shake(first);
      const focusEl = first && (first.querySelector('.sf-link.is-bad input') || first.querySelector('input:not([type="radio"])'));
      if (focusEl && window.innerWidth > 640) setTimeout(function () { focusEl.focus(); }, 60);
      else if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return !bad.length;
  }
  // Dipanggil tiap ada input: hapus tanda merah begitu field-nya sudah benar.
  function recheck() {
    [0, 1, 3].forEach(function (i) {
      if (!shown.has(i)) return;
      const bad = problems(i);
      ({ 0: ['title', 'category'], 1: ['event_date', 'time'], 3: ['links'] })[i].forEach(function (n) {
        if (bad.indexOf(n) === -1) setInvalid(n, false);
      });
      if (!bad.length) shown.delete(i);
    });
    renderChrome();
  }

  // ── Navigasi langkah ────────────────────────────────────────
  function optionalEmpty(i) {
    if (i === 2) return !PEOPLE.some(function (p) { return val(p.name); }) && !val('jumlah_peserta');
    return false;
  }
  function renderChrome() {
    root.querySelectorAll('.sf-step').forEach(function (b, i) {
      const done = i !== cur && visited.has(i) && !problems(i).length && (i < cur || !STEPS[i].optional || !optionalEmpty(i));
      b.classList.toggle('is-active', i === cur);
      b.classList.toggle('is-done', done);
      b.classList.toggle('has-error', shown.has(i) && i !== cur);
      b.setAttribute('aria-current', i === cur ? 'step' : 'false');
    });
    $('#sfStepNum').textContent = cur + 1;
    $('#sfBar').style.width = ((cur + 1) / STEPS.length * 100) + '%';
    $('#sfCancel').hidden = cur !== 0;
    $('#sfBack').hidden = cur === 0;
    $('#sfNext').hidden = cur === LAST;
    $('#sfSave').hidden = cur !== LAST;
    $('#sfNextTxt').textContent = STEPS[cur].optional && optionalEmpty(cur) ? 'Lewati' : 'Lanjut';
  }
  function show(i, backwards) {
    cur = i;
    visited.add(i);
    root.querySelectorAll('.sf-panel').forEach(function (p) {
      const on = +p.dataset.panel === i;
      p.classList.toggle('is-active', on);
      p.classList.toggle('from-left', on && !!backwards);
    });
    if (i === LAST) updateSummary();
    body.scrollTop = 0;
    renderChrome();
    // Fokus otomatis ke kolom pertama (desktop saja — di HP keyboard yang
    // tiba-tiba muncul malah menutupi form). Langkah Jadwal dilewati karena
    // kolom pertamanya pemilih tanggal.
    if (window.innerWidth > 640 && i !== 1) {
      const first = root.querySelector('.sf-panel.is-active .sf-input:not([type="date"]):not([type="time"]), .sf-panel.is-active .sf-link input');
      if (first && !first.value) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    }
  }
  function goTo(t) {
    if (t === cur) return;
    if (t > cur) {
      // Maju: semua langkah sebelum tujuan harus lolos validasi dulu.
      for (let i = cur; i < t; i++) {
        if (problems(i).length) {
          if (i !== cur) show(i, i < cur);
          showProblems(i);
          renderChrome();
          return;
        }
      }
    }
    show(t, t < cur);
  }

  // ── Buka / tutup ────────────────────────────────────────────
  function resetForm() {
    form.reset();
    cur = 0; visited = new Set([0]); shown.clear(); dirty = false;
    root.querySelectorAll('.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
    root.querySelectorAll('.sf-link').forEach(function (b) { b.classList.remove('is-ok', 'is-bad'); });
    root.querySelectorAll('.sf-qchip.is-on').forEach(function (b) { b.classList.remove('is-on'); });
    PEOPLE.forEach(function (p) { updateAvatar(p.name); });
    $('#sfTitleCount').textContent = '0/150';
    $('#sfCaptionCount').textContent = '0 karakter';
    $('#sfDateHint').hidden = true;
    $('#sfTimeHint').hidden = true;
  }
  function applyPrefill(data) {
    Object.keys(data || {}).forEach(function (k) {
      if (k === 'category') {
        const r = form.querySelector('input[name="category"][value="' + CSS.escape(data[k]) + '"]');
        if (r) r.checked = true;
      } else if (field(k)) {
        field(k).value = data[k];
      }
    });
    updateDateHint(); updateTimeHint();
  }
  function open(prefill) {
    build();
    resetForm();
    applyPrefill(prefill);
    show(0, false);
    document.documentElement.classList.add('sf-lock');
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
  }
  function close(force) {
    if (!root || !root.classList.contains('is-open') || saving) return;
    if (!force && dirty) {
      if (window.Swal) {
        Swal.fire({
          icon: 'warning', title: 'Tutup form?',
          text: 'Isian yang sudah kamu ketik akan hilang.',
          showCancelButton: true, reverseButtons: true,
          confirmButtonText: 'Ya, tutup', cancelButtonText: 'Lanjut mengisi',
          confirmButtonColor: '#dc2626'
        }).then(function (r) { if (r.isConfirmed) close(true); });
      } else if (window.confirm('Tutup form? Isian yang sudah diketik akan hilang.')) {
        close(true);
      }
      return;
    }
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('sf-lock');
  }

  // ── Simpan ──────────────────────────────────────────────────
  function notify(msg, type) {
    if (typeof window.showSwalToast === 'function') window.showSwalToast(msg, type);
    else if (window.Swal) Swal.fire({ icon: type, title: msg, timer: 1800, showConfirmButton: false });
    else alert(msg);
  }
  function setSaving(on) {
    saving = on;
    const btn = $('#sfSave');
    btn.disabled = on;
    btn.innerHTML = on ? '<span class="sf-spin"></span><span>Menyimpan...</span>' : icon('save') + '<span>Simpan Silabus</span>';
    $('#sfBack').disabled = on;
  }
  async function save() {
    if (saving) return;
    for (let i = 0; i <= LAST; i++) {
      if (problems(i).length) {
        if (i !== cur) show(i, i < cur);
        showProblems(i);
        renderChrome();
        return;
      }
    }
    root.querySelectorAll('.sf-link').forEach(function (b) { updateLink(b, true); });
    const saved = { title: val('title'), category: categoryVal(), event_date: val('event_date') };
    setSaving(true);
    try {
      const r = await fetch('/api/events', { method: 'POST', body: new FormData(form), credentials: 'same-origin' });
      let res = {};
      try { res = await r.json(); } catch (e) { /* respons bukan JSON */ }
      if (!r.ok || res.error) {
        notify(res.error || ('Gagal menyimpan silabus (HTTP ' + r.status + ').'), 'error');
        return;
      }
      setSaving(false);
      dirty = false;
      close(true);
      notify('Silabus berhasil disimpan!', 'success');
      if (typeof opts.onSaved === 'function') opts.onSaved(saved, res);
    } catch (e) {
      notify('Terjadi kesalahan koneksi server', 'error');
    } finally {
      if (saving) setSaving(false);
    }
  }

  // ── Event binding ───────────────────────────────────────────
  function bind() {
    root.addEventListener('mousedown', function (e) { root._downOnBackdrop = e.target === root; });
    root.addEventListener('click', function (e) {
      // Tutup kalau klik di luar modal — tapi bukan kalau user cuma
      // nge-drag seleksi teks dari dalam modal lalu lepas di luar.
      if (e.target === root && root._downOnBackdrop) { close(); return; }

      const t = e.target.closest('button');
      if (!t || !root.contains(t)) return;

      if (t.dataset.act === 'close') { close(); return; }
      if (t.id === 'sfNext') { goTo(cur + 1); return; }
      if (t.id === 'sfBack') { goTo(cur - 1); return; }
      if (t.dataset.goto !== undefined) { goTo(+t.dataset.goto); return; }

      if (t.dataset.fill) {
        const input = field(t.dataset.fill);
        input.value = t.classList.contains('is-on') && t.dataset.fill !== 'jumlah_peserta' ? '' : t.dataset.val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (t.dataset.days !== undefined) {
        const d = today0(); d.setDate(d.getDate() + (+t.dataset.days));
        field('event_date').value = isoLocal(d);
        field('event_date').dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (t.dataset.time) {
        const p = t.dataset.time.split('-');
        field('start_time').value = p[0];
        field('end_time').value = p[1];
        field('end_time').dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (t.dataset.count) {
        const input = field('jumlah_peserta');
        input.value = Math.max(0, (parseInt(input.value, 10) || 0) + (+t.dataset.count));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    function onInput(e) {
      dirty = true;
      const n = e.target.name;
      if (n === 'title') $('#sfTitleCount').textContent = e.target.value.length + '/150';
      if (n === 'caption_sosmed') $('#sfCaptionCount').textContent = e.target.value.length + ' karakter';
      if (n === 'event_date') updateDateHint();
      if (n === 'start_time' || n === 'end_time') updateTimeHint();
      if (PEOPLE.some(function (p) { return p.name === n; })) updateAvatar(n);
      if (['jenis_pelatihan', 'location', 'kelas', 'jumlah_peserta'].indexOf(n) !== -1) syncFillChips(n);
      const box = e.target.closest('.sf-link');
      if (box) updateLink(box, false);
      recheck();
    }
    form.addEventListener('focusout', function (e) {
      const box = e.target.closest && e.target.closest('.sf-link');
      if (box) { updateLink(box, true); recheck(); }
    });

    // Klik di mana saja pada kolom tanggal/jam langsung buka pemilihnya.
    form.querySelectorAll('input[type="date"], input[type="time"]').forEach(function (inp) {
      inp.addEventListener('click', function () {
        try { if (inp.showPicker) inp.showPicker(); } catch (e) { /* browser lama */ }
      });
    });

    // Enter = lanjut ke langkah berikutnya (bukan langsung submit form).
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      if (cur < LAST) goTo(cur + 1);
      else save();
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); save(); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !root.classList.contains('is-open')) return;
      if (window.Swal && Swal.isVisible && Swal.isVisible() && !(Swal.getPopup() && Swal.getPopup().classList.contains('swal2-toast'))) return;
      close();
    });
  }

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'sf-overlay';
    root.id = 'sfOverlay';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = buildMarkup();
    document.body.appendChild(root);
    form = $('#sfForm');
    body = $('#sfBody');
    bind();
  }

  // Warna per kategori — dipakai juga oleh kalender Silabus supaya warna
  // label acara di kalender sama dengan warna pilihan kategori di form.
  const CATEGORY_COLORS = {};
  LEGACY_CATEGORY_COLORS.concat(CATEGORIES).forEach(function (it) {
    CATEGORY_COLORS[it[0].toLowerCase()] = it[1];
  });
  function categoryColor(cat) {
    return CATEGORY_COLORS[String(cat || '').trim().toLowerCase()] || '#64748b';
  }

  window.SilabusForm = {
    init: function (o) { opts = Object.assign({}, opts, o || {}); build(); },
    open: open,
    close: close,
    categoryColor: categoryColor
  };
})();
