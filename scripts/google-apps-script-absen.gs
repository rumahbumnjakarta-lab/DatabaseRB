/**
 * Google Apps Script — Sinkron Absensi Real-time ke Google Sheets + Drive
 * Rumah BUMN Jakarta
 *
 * CARA PASANG (lihat panduan lengkap dari Claude di chat):
 * 1. Buka Google Sheet baru (sheets.new)
 * 2. Extensions > Apps Script
 * 3. Hapus isi default, tempel SELURUH isi file ini
 * 4. Project Settings (ikon gerigi) > Script Properties > Add script property
 *      Property: SHARED_SECRET   Value: (bikin sendiri, string acak apa saja)
 * 5. Deploy > New deployment > Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Klik Deploy, izinkan akses (Advanced > Go to project (unsafe) itu normal
 *    karena ini script milikmu sendiri)
 * 7. Copy "Web app URL" yang muncul
 * 8. Masukkan ke file .env project:
 *      ABSEN_SHEETS_WEBHOOK_URL=<Web app URL dari langkah 7>
 *      ABSEN_SHEETS_SECRET=<value SHARED_SECRET dari langkah 4>
 */

const SHEET_NAME = 'Absensi';
const DRIVE_FOLDER_NAME = 'Foto Absensi - Rumah BUMN Jakarta';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const expectedSecret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (expectedSecret && data.secret !== expectedSecret) {
      return jsonResponse_({ ok: false, error: 'Unauthorized' });
    }

    const sheet = getOrCreateSheet_();

    let photo = { url: '', embedUrl: '' };
    if (data.photo_base64) {
      photo = savePhotoToDrive_(data.photo_base64, data.user_name, data.type);
    }

    sheet.appendRow([
      new Date(),
      data.user_name || '',
      data.user_email || '',
      data.user_role || '',
      data.type === 'clock_in' ? 'Clock In' : (data.type === 'clock_out' ? 'Clock Out' : (data.type || '')),
      data.address || '',
      data.latitude || '',
      data.longitude || '',
      photo.url,
    ]);

    if (photo.embedUrl) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 10).setFormula('=IMAGE("' + photo.embedUrl + '")');
      sheet.setRowHeight(lastRow, 90);
    }

    return jsonResponse_({ ok: true, photoUrl: photo.url });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return jsonResponse_({ ok: true, message: 'Absen sync endpoint aktif.' });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Waktu', 'Nama', 'Email', 'Role', 'Tipe', 'Alamat', 'Latitude', 'Longitude', 'Link Foto', 'Preview Foto']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }
  return sheet;
}

function getOrCreateFolder_() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function savePhotoToDrive_(base64, userName, type) {
  const match = String(base64).match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return { url: '', embedUrl: '' };

  const mime = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = (userName || 'user').replace(/[^a-zA-Z0-9]/g, '_');
  const blob = Utilities.newBlob(bytes, mime, safeName + '_' + type + '_' + Date.now() + '.jpg');

  const folder = getOrCreateFolder_();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const id = file.getId();
  return {
    url: 'https://drive.google.com/file/d/' + id + '/view',
    embedUrl: 'https://drive.google.com/uc?id=' + id,
  };
}
