// ============================================================
//   form-modal.js — Perilaku modal form bersama (pasangan dari
//   /css/form-modal.css). Dipakai sosmed.html & design.html.
//
//   const fm = FormModal.setup({
//     overlay: 'idOverlay', form: 'idForm', body: 'idBody', focus: 'idInputPertama',
//     choices: [{ input: 'idHidden', container: 'idWadah', items: [{ value, label, color, icon }],
//                 toggle: true, empty: '', initial: 'normal' }],
//     onChange: function (id) { ... }   // dipanggil tiap ada isian berubah
//   });
//   fm.open({ idInput: 'nilai awal' });  fm.close();  fm.validate([...]);
//
//   Atribut yang dikenali di dalam form:
//     [data-date-for=ID][data-days=N]   chip "Hari ini/Besok" → isi tanggal
//     [data-hint-for=ID]                keterangan tanggal ("Senin, … · besok")
//     [data-count-for=ID][data-max=N]   penghitung karakter (+ batas opsional)
//     [data-append-for=ID][data-text=T] chip yang menambah baris ke textarea
// ============================================================

(function () {
  'use strict';

  // Tanggal "hari ini" menurut WIB (bukan UTC), ± offset hari → "YYYY-MM-DD"
  function todayISO(offsetDays) {
    const p = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }).split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + (offsetDays || 0))).toISOString().slice(0, 10);
  }
  function daysFromToday(iso) {
    const p = String(iso || '').split('-').map(Number);
    if (p.length !== 3 || !p[0]) return null;
    return Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.parse(todayISO(0))) / 86400000);
  }
  function dateLabel(iso) {
    const diff = daysFromToday(iso);
    if (diff === null) return '';
    const p = iso.split('-').map(Number);
    const rel = diff === 0 ? 'hari ini' : diff === 1 ? 'besok' : diff === -1 ? 'kemarin'
      : diff > 1 ? diff + ' hari lagi' : 'sudah lewat ' + (-diff) + ' hari';
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + rel;
  }
  function shake(el) {
    if (!el) return;
    el.classList.remove('fm-shake'); void el.offsetWidth; el.classList.add('fm-shake');
  }
  function icons() { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); }

  function setup(cfg) {
    const $ = function (id) { return document.getElementById(id); };
    const overlay = $(cfg.overlay), form = $(cfg.form), body = $(cfg.body);
    const groups = {};
    let dirty = false, busy = false, downOnBackdrop = false;

    // ── Tombol pilihan ──
    (cfg.choices || []).forEach(function (g) {
      groups[g.input] = g;
      $(g.container).innerHTML = g.items.map(function (it) {
        return '<button type="button" class="fm-choice' + (it.icon ? ' has-ico' : '') + '" data-v="' + it.value +
          '" style="--c:' + it.color + '">' + (it.icon || '') + '<span>' + (it.label || it.value) + '</span></button>';
      }).join('');
      $(g.container).addEventListener('click', function (e) {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        const cur = $(g.input).value;
        setChoice(g.input, g.toggle && cur === b.dataset.v ? (g.empty || '') : b.dataset.v);
        dirty = true;
        const f = b.closest('.fm-field');
        if (f) f.classList.remove('is-invalid');
        if (cfg.onChange) cfg.onChange(g.input);
      });
    });
    function setChoice(id, v) {
      const g = groups[id];
      // Hanya nilai yang ada di daftar yang diterima (mis. dari link ?prefill=)
      if (v && !g.items.some(function (it) { return it.value === v; })) v = g.empty || '';
      $(id).value = v;
      $(g.container).querySelectorAll('[data-v]').forEach(function (b) { b.classList.toggle('is-on', b.dataset.v === v); });
    }

    // ── Keterangan tanggal, penghitung karakter, status chip ──
    function refresh() {
      form.querySelectorAll('[data-hint-for]').forEach(function (h) {
        const v = $(h.dataset.hintFor).value;
        const diff = daysFromToday(v);
        h.hidden = diff === null;
        if (diff === null) return;
        h.className = 'fm-hint' + (diff < 0 ? ' is-warn' : '');
        h.innerHTML = '<i data-lucide="calendar"></i><span></span>';
        h.querySelector('span').textContent = dateLabel(v);
      });
      form.querySelectorAll('[data-date-for]').forEach(function (b) {
        b.classList.toggle('is-on', $(b.dataset.dateFor).value === todayISO(+b.dataset.days));
      });
      form.querySelectorAll('[data-count-for]').forEach(function (c) {
        const n = $(c.dataset.countFor).value.length;
        const max = +c.dataset.max || 0;
        c.textContent = max ? n.toLocaleString('id-ID') + ' / ' + max.toLocaleString('id-ID') : n.toLocaleString('id-ID') + ' karakter';
        c.classList.toggle('is-bad', !!max && n > max);
        c.classList.toggle('is-warn', !!max && n <= max && n > max * 0.9);
      });
      icons();
    }

    form.addEventListener('input', function (e) {
      dirty = true;
      const f = e.target.closest('.fm-field');
      if (f && f.classList.contains('is-invalid') && String(e.target.value).trim()) f.classList.remove('is-invalid');
      refresh();
      if (cfg.onChange) cfg.onChange(e.target.id);
    });
    form.addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.dateFor) {
        const inp = $(b.dataset.dateFor);
        inp.value = todayISO(+b.dataset.days);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (b.dataset.appendFor) {
        const ta = $(b.dataset.appendFor);
        const cur = ta.value.replace(/\s+$/, '');
        ta.value = (cur ? cur + '\n' : '') + b.dataset.text;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    });
    // Klik di mana saja pada kolom tanggal langsung membuka kalender
    form.querySelectorAll('input[type="date"]').forEach(function (inp) {
      inp.addEventListener('click', function () { try { if (inp.showPicker) inp.showPicker(); } catch (err) { /* browser lama */ } });
    });

    // Tutup: klik di luar kotak (bukan drag dari dalam) atau tombol Esc
    overlay.addEventListener('mousedown', function (e) { downOnBackdrop = e.target === overlay; });
    overlay.addEventListener('click', function (e) { if (e.target === overlay && downOnBackdrop) api.close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !overlay.classList.contains('open')) return;
      if (window.Swal && Swal.isVisible && Swal.isVisible() && !(Swal.getPopup() && Swal.getPopup().classList.contains('swal2-toast'))) return;
      api.close();
    });

    const api = {
      open: function (prefill) {
        form.reset();
        form.querySelectorAll('.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
        Object.keys(groups).forEach(function (id) { setChoice(id, groups[id].initial || groups[id].empty || ''); });
        Object.keys(prefill || {}).forEach(function (id) {
          const v = prefill[id];
          if (v === undefined || v === null || v === '') return;
          if (groups[id]) setChoice(id, String(v));
          else if ($(id)) $(id).value = v;
        });
        refresh();
        if (cfg.onChange) cfg.onChange(null);
        dirty = false;
        body.scrollTop = 0;
        document.documentElement.classList.add('fm-lock');
        overlay.classList.add('open');
        if (cfg.focus && window.innerWidth > 640) setTimeout(function () { $(cfg.focus).focus(); }, 80);
      },
      close: function (force) {
        if (!overlay.classList.contains('open') || busy) return;
        if (!force && dirty) {
          const doClose = function () { api.close(true); };
          if (window.Swal) {
            Swal.fire({
              icon: 'warning', title: 'Tutup form?', text: 'Isian yang sudah kamu ketik akan hilang.',
              showCancelButton: true, reverseButtons: true,
              confirmButtonText: 'Ya, tutup', cancelButtonText: 'Lanjut mengisi', confirmButtonColor: '#dc2626'
            }).then(function (r) { if (r.isConfirmed) doClose(); });
          } else if (window.confirm('Tutup form? Isian yang sudah diketik akan hilang.')) {
            doClose();
          }
          return;
        }
        overlay.classList.remove('open');
        document.documentElement.classList.remove('fm-lock');
      },
      // rules: [{ id: 'idInput', ok: function (nilai) { return bool } }] — ok default: tidak kosong
      validate: function (rules) {
        const bad = [];
        rules.forEach(function (r) {
          const el = $(r.id);
          const ok = r.ok ? r.ok(el.value) : String(el.value || '').trim() !== '';
          const f = el.closest('.fm-field') || (groups[r.id] && $(groups[r.id].container).closest('.fm-field'));
          if (f) f.classList.toggle('is-invalid', !ok);
          if (!ok) bad.push(f);
        });
        if (bad.length && bad[0]) {
          shake(bad[0]);
          bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
          const inp = bad[0].querySelector('input:not([type="hidden"]), textarea');
          if (inp && window.innerWidth > 640) setTimeout(function () { inp.focus({ preventScroll: true }); }, 250);
        }
        return !bad.length;
      },
      setBusy: function (btn, on, text) {
        busy = on;
        if (on) { btn.dataset.html = btn.innerHTML; btn.textContent = text || 'Menyimpan...'; }
        else if (btn.dataset.html) btn.innerHTML = btn.dataset.html;
        btn.disabled = on;
      },
      setChoice: setChoice,
      refresh: refresh
    };
    return api;
  }

  window.FormModal = { setup: setup, todayISO: todayISO, dateLabel: dateLabel, shake: shake };
})();
