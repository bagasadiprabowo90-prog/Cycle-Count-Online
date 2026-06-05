// ============================================
// GOOGLE APPS SCRIPT - SISI DATABASE
// Deploy ini sebagai Web App di Google Apps Script
// ============================================

// Isi hanya jika Apps Script berdiri sendiri (bukan dibuat dari menu Extensions di Google Sheets).
// Ambil dari URL Google Sheets:
// https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
const SPREADSHEET_ID = '16kGt5RM2bpAA8iDqlqS1SgATEHYN1X5B8JaLCz29Wvo';

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('SPREADSHEET_ID belum diisi dan script tidak terhubung ke spreadsheet aktif.');
  }

  return spreadsheet;
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    const action = payload.action;
    const data = payload.data;

    let result = { success: false, message: 'Action not found' };

    switch (action) {
      case 'getProducts': result = getProducts(); break;
      case 'getProductIn': result = getHistory('Product In', data.date); break;
      case 'getCycleCount': result = getHistory('Cycle Count', data.date); break;
      case 'addProductIn': result = addTransaction('Product In', data); break;
      case 'addCycleCount': result = addTransaction('Cycle Count', data); break;
      case 'updateProductIn': result = updateTransaction('Product In', data); break;
      case 'updateCycleCount': result = updateTransaction('Cycle Count', data); break;
      case 'deleteProductIn': result = deleteTransaction('Product In', data); break;
      case 'deleteCycleCount': result = deleteTransaction('Cycle Count', data); break;
      case 'addNewBatch': result = addNewBatch(data); break;
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'Stock Opname Pro database endpoint aktif'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function parsePayload(e) {
  const params = e && e.parameter ? e.parameter : {};

  if (params.action) {
    return {
      action: params.action,
      data: JSON.parse(params.data || "{}")
    };
  }

  if (e && e.postData && e.postData.contents) {
    const contents = e.postData.contents || "{}";

    if (contents.indexOf('action=') === 0 || contents.indexOf('&action=') >= 0) {
      const form = parseFormBody(contents);
      return {
        action: form.action || '',
        data: JSON.parse(form.data || "{}")
      };
    }

    const body = JSON.parse(contents);
    return {
      action: body.action,
      data: body.data || {}
    };
  }

  return { action: '', data: {} };
}

function parseFormBody(contents) {
  return contents.split('&').reduce(function(result, pair) {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts.shift() || '');
    const value = decodeURIComponent(parts.join('=') || '');
    result[key] = value;
    return result;
  }, {});
}

function getProducts() {
  const sheet = getSpreadsheet().getSheetByName('Daftar Product');
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { success: true, data: [] };

  const products = [];

  for (let i = 1; i < data.length; i++) {
    products.push({
      barcode: data[i][0] ? String(data[i][0]).trim() : '',
      sku: data[i][1] ? String(data[i][1]).trim() : '',
      product: data[i][2] ? String(data[i][2]).trim() : '',
      batch: data[i][3] ? String(data[i][3]).trim() : ''
    });
  }

  return { success: true, data: products };
}

function getHistory(sheetName, filterDate) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { success: true, data: [] };

  const history = [];

  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][1]
      ? Utilities.formatDate(new Date(data[i][1]), "GMT+7", "M/d/yyyy")
      : '';

    if (filterDate && rowDate !== filterDate) continue;

    if (sheetName === 'Product In') {
      history.push({
        rowId: data[i][0],
        date: rowDate,
        barcode: data[i][2],
        sku: data[i][3],
        product: data[i][4],
        batch: data[i][5],
        sku_batch: data[i][6],
        qty: data[i][7],
        status: data[i][8],
        user: data[i][9]
      });
    } else {
      history.push({
        rowId: data[i][0],
        date: rowDate,
        barcode: data[i][2],
        sku: data[i][3],
        product: data[i][4],
        batch: data[i][5],
        sku_batch: data[i][6],
        qty: data[i][7],
        user: data[i][8]
      });
    }
  }

  return { success: true, count: history.length, data: history };
}

function addTransaction(sheetName, data) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  const record = data.record;
  const user = data.user || record.user || "Unknown";

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const rowId = record.rowId || record.id || (new Date().getTime() + Math.floor(Math.random() * 1000));
    const skuBatch = record.sku + record.batch;

    if (sheetName === 'Product In') {
      sheet.appendRow([
        rowId, record.date, record.barcode, record.sku,
        record.product, record.batch, skuBatch, record.qty,
        record.status || 'Verified', user
      ]);
    } else {
      sheet.appendRow([
        rowId, record.date, record.barcode, record.sku,
        record.product, record.batch, skuBatch, record.qty, user
      ]);
    }

    return { success: true, message: 'Berhasil ditambahkan!', rowId: rowId };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteTransaction(sheetName, data) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  const targetId = String(data.rowId || '').trim();
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Data dihapus' };
    }
  }

  return { success: false, message: 'Data tidak ditemukan' };
}

function updateTransaction(sheetName, data) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  const record = data.record;
  const targetId = String(data.rowId || '').trim();

  const values = sheet.getDataRange().getValues();
  const skuBatch = record.sku + record.batch;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === targetId) {
      const row = i + 1;

      if (sheetName === 'Product In') {
        sheet.getRange(row, 2, 1, 9).setValues([[
          record.date, record.barcode, record.sku, record.product,
          record.batch, skuBatch, record.qty, record.status || 'Verified', record.user || "Unknown"
        ]]);
      } else {
        sheet.getRange(row, 2, 1, 8).setValues([[
          record.date, record.barcode, record.sku, record.product,
          record.batch, skuBatch, record.qty, record.user || "Unknown"
        ]]);
      }

      return { success: true, message: 'Data diperbarui' };
    }
  }

  return { success: false, message: 'Data tidak ditemukan untuk diupdate' };
}

function addNewBatch(data) {
  const sheet = getSpreadsheet().getSheetByName('Daftar Product');
  const record = data.record || data;
  const barcode = record.barcode ? String(record.barcode).trim() : '';
  const sku = record.sku ? String(record.sku).trim() : '';
  const product = record.product ? String(record.product).trim() : '';
  const batch = record.batch ? String(record.batch).trim() : '';

  if (!sku || !product || !batch) {
    return { success: false, message: 'SKU, Product, dan Batch wajib diisi untuk tambah master batch.' };
  }

  const values = sheet.getDataRange().getValues();
  const targetSku = sku.toLowerCase();
  const targetBatch = batch.toLowerCase();

  for (let i = 1; i < values.length; i++) {
    const rowSku = values[i][1] ? String(values[i][1]).trim().toLowerCase() : '';
    const rowBatch = values[i][3] ? String(values[i][3]).trim().toLowerCase() : '';
    if (rowSku === targetSku && rowBatch === targetBatch) {
      return { success: true, message: 'Batch sudah ada di master product.' };
    }
  }

  sheet.appendRow([barcode || ('NEW-' + sku + '-' + batch), sku, product, batch]);
  return { success: true, message: 'Batch baru ditambahkan ke master product.' };
}
