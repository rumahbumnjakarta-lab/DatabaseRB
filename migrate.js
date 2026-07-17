require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4, validate: validateUuid } = require('uuid');

const DATA_FILE = path.join(__dirname, 'data', 'items.json');

// Periksa file .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const isInvalidUrl = !supabaseUrl || supabaseUrl.includes('YOUR_SUPABASE_URL') || !supabaseUrl.startsWith('http');
const isInvalidKey = !supabaseKey || supabaseKey.includes('YOUR_SUPABASE_ANON_KEY');

if (isInvalidUrl || isInvalidKey) {
  console.error('\n========================================================================');
  console.error('ERROR: Silakan konfigurasi SUPABASE_URL dan SUPABASE_KEY di file .env.');
  console.error('Buka file .env dan ganti nilai placeholder dengan kredensial Supabase Anda.');
  console.error('========================================================================\n');
  process.exit(1);
}

// Inisialisasi Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Memulai migrasi data ke Supabase...');

  // Periksa apakah file data/items.json ada
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`ERROR: File database lokal tidak ditemukan di: ${DATA_FILE}`);
    process.exit(1);
  }

  // Baca data local
  let localItems;
  try {
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    localItems = JSON.parse(rawData || '[]');
  } catch (err) {
    console.error('ERROR: Gagal membaca file items.json:', err.message);
    process.exit(1);
  }

  if (localItems.length === 0) {
    console.log('Tidak ada data di items.json untuk dimigrasi.');
    process.exit(0);
  }

  console.log(`Membaca ${localItems.length} item dari database lokal.`);

  // Validasi ID dan bersihkan data sebelum diunggah
  const itemsToInsert = localItems.map(item => {
    // Buat UUID baru jika ID lama tidak valid
    let finalId = item.id;
    if (!validateUuid(finalId)) {
      finalId = uuidv4();
      console.log(`Menghasilkan UUID baru untuk item "${item.title}": ${item.id} -> ${finalId}`);
    }

    const cleanItem = {
      id: finalId,
      division: item.division,
      cat: item.cat,
      title: item.title,
      type: item.type,
      note: item.note || null
    };

    if (item.type === 'link') {
      cleanItem.url = item.url || null;
      cleanItem.email = null;
      cleanItem.pass = null;
    } else if (item.type === 'cred') {
      cleanItem.email = item.email || null;
      cleanItem.pass = item.pass || null;
      cleanItem.url = null;
    }

    return cleanItem;
  });

  // Hapus data lama di Supabase jika ada untuk mencegah duplikasi (opsional, tapi untuk inisialisasi aman menggunakan upsert)
  console.log('Mengunggah data ke tabel "items" di Supabase...');
  const { data, error } = await supabase
    .from('items')
    .upsert(itemsToInsert, { onConflict: 'id' });

  if (error) {
    console.error('ERROR: Gagal mengunggah data ke Supabase:', error.message);
    console.error('Detail Error:', error.details || error.hint);
    console.log('\nPastikan Anda telah membuat tabel "items" di Supabase menggunakan SQL script yang ada di implementation_plan.md');
    process.exit(1);
  }

  console.log(`✅ BERHASIL! Migrasi selesai. ${itemsToInsert.length} item telah diunggah ke Supabase.`);
}

runMigration().catch(err => {
  console.error('Terjadi kesalahan tidak terduga saat migrasi:', err);
});
