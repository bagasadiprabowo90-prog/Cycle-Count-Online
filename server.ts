import express from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

dotenv.config({ path: '.env.local' });
dotenv.config();

// URL Google Apps Script untuk Google Sheets sebagai master database.
const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL?.trim();

// --- RAM CACHE OPTIMIZER ---
// Berfungsi mempercepat baca data ke Frontend tanpa menunggu respons Google Sheets
let cachedProducts: any[] = [];

const dataDir = process.env.DATA_DIR?.trim() || path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'stock-opname.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    barcode TEXT,
    sku TEXT,
    product TEXT,
    batch TEXT,
    sku_batch TEXT,
    qty REAL NOT NULL DEFAULT 0,
    status TEXT,
    user TEXT,
    timestamp INTEGER NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    sync_action TEXT,
    sync_error TEXT,
    deleted INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )
`);

const transactionColumns = db.prepare('PRAGMA table_info(transactions)').all().map((column: any) => column.name);
if (!transactionColumns.includes('sync_action')) {
  db.exec('ALTER TABLE transactions ADD COLUMN sync_action TEXT');
}

const upsertTransactionStmt = db.prepare(`
  INSERT INTO transactions (
    id, type, date, barcode, sku, product, batch, sku_batch, qty, status, user,
    timestamp, sync_status, sync_action, sync_error, deleted, updated_at
  ) VALUES (
    @id, @type, @date, @barcode, @sku, @product, @batch, @sku_batch, @qty, @status, @user,
    @timestamp, @sync_status, @sync_action, @sync_error, @deleted, @updated_at
  )
  ON CONFLICT(id) DO UPDATE SET
    type = excluded.type,
    date = excluded.date,
    barcode = excluded.barcode,
    sku = excluded.sku,
    product = excluded.product,
    batch = excluded.batch,
    sku_batch = excluded.sku_batch,
    qty = excluded.qty,
    status = excluded.status,
    user = excluded.user,
    timestamp = excluded.timestamp,
    sync_status = CASE
      WHEN transactions.sync_status IN ('pending_insert', 'pending_update', 'pending_delete', 'failed') THEN transactions.sync_status
      ELSE excluded.sync_status
    END,
    sync_action = COALESCE(transactions.sync_action, excluded.sync_action),
    sync_error = excluded.sync_error,
    deleted = excluded.deleted,
    updated_at = excluded.updated_at
`);

function normalizeText(value: any) {
  return value == null ? '' : String(value).trim();
}

function makeSkuBatch(record: any) {
  return `${normalizeText(record.sku)}${normalizeText(record.batch)}`;
}

function makeLocalId() {
  return String(Date.now() + Math.floor(Math.random() * 1000));
}

function productKey(product: any) {
  return `${normalizeText(product.sku).toLowerCase()}::${normalizeText(product.batch).toLowerCase()}`;
}

function hasCachedProductBatch(record: any) {
  const key = productKey(record);
  return cachedProducts.some(product => productKey(product) === key);
}

function addCachedProductBatch(record: any) {
  if (!normalizeText(record.sku) || !normalizeText(record.product) || !normalizeText(record.batch) || hasCachedProductBatch(record)) return;
  cachedProducts = [
    ...cachedProducts,
    {
      barcode: normalizeText(record.barcode) || `NEW-${normalizeText(record.sku)}-${normalizeText(record.batch)}`,
      sku: normalizeText(record.sku),
      product: normalizeText(record.product),
      batch: normalizeText(record.batch)
    }
  ];
}

async function ensureMasterBatch(record: any) {
  if (record.type !== 'IN' || !normalizeText(record.sku) || !normalizeText(record.product) || !normalizeText(record.batch)) return;
  if (hasCachedProductBatch(record) && !normalizeText(record.barcode).startsWith('NEW-')) return;

  const response = await gasApi('addNewBatch', {
    record: {
      barcode: normalizeText(record.barcode) || `NEW-${normalizeText(record.sku)}-${normalizeText(record.batch)}`,
      sku: normalizeText(record.sku),
      product: normalizeText(record.product),
      batch: normalizeText(record.batch)
    }
  });
  assertGasSuccess(response, 'Gagal menambahkan batch baru ke master product');
  addCachedProductBatch(record);
}

function normalizeTransaction(record: any, fallback: any = {}) {
  const id = normalizeText(record.id || record.rowId || record.row_id || fallback.id || makeLocalId());
  const type = normalizeText(record.type || fallback.type || 'CC') === 'IN' ? 'IN' : 'CC';
  const date = normalizeText(record.date || fallback.date);
  const timestamp = Number(record.timestamp || fallback.timestamp || new Date(date || Date.now()).getTime() || Date.now());

  return {
    id,
    type,
    date,
    barcode: normalizeText(record.barcode || fallback.barcode),
    sku: normalizeText(record.sku || fallback.sku),
    product: normalizeText(record.product || fallback.product),
    batch: normalizeText(record.batch || fallback.batch),
    sku_batch: normalizeText(record.sku_batch || fallback.sku_batch || makeSkuBatch(record)),
    qty: Number(record.qty || fallback.qty || 0),
    status: normalizeText(record.status || fallback.status || (type === 'IN' ? 'Verified' : '')),
    user: normalizeText(record.user || fallback.user || 'Unknown'),
    timestamp,
    sync_status: normalizeText(record.sync_status || fallback.sync_status || 'pending_insert'),
    sync_action: record.sync_action || fallback.sync_action || null,
    sync_error: record.sync_error || fallback.sync_error || null,
    deleted: Number(record.deleted || fallback.deleted || 0),
    updated_at: Number(record.updated_at || fallback.updated_at || Date.now())
  };
}

function saveTransactionLocal(record: any, syncStatus = 'pending_insert', syncAction?: 'insert' | 'update' | 'delete') {
  const normalized = normalizeTransaction({ ...record, sync_status: syncStatus, sync_action: syncAction, updated_at: Date.now() });
  upsertTransactionStmt.run(normalized);
  return normalized;
}

function getLocalTransactions(date?: any) {
  const rows = date
    ? db.prepare('SELECT * FROM transactions WHERE date = ? AND deleted = 0 ORDER BY timestamp DESC, id DESC').all(String(date))
    : db.prepare('SELECT * FROM transactions WHERE deleted = 0 ORDER BY timestamp DESC, id DESC').all();
  return rows.map((row: any) => ({ ...row, qty: Number(row.qty), deleted: Boolean(row.deleted) }));
}

function importRemoteTransactions(rows: any[], type: 'IN' | 'CC') {
  const now = Date.now();
  const importMany = db.transaction((items: any[]) => {
    for (const item of items) {
      const normalized = normalizeTransaction({
        ...item,
        id: item.rowId,
        type,
        sync_status: 'synced',
        sync_action: null,
        sync_error: null,
        deleted: 0,
        updated_at: now
      });
      upsertTransactionStmt.run(normalized);
    }
  });
  importMany(rows || []);
}

let isSyncingWrites = false;

async function processPendingWrites() {
  if (isSyncingWrites) return;
  isSyncingWrites = true;

  try {
    const rows = db.prepare(`
      SELECT * FROM transactions
      WHERE sync_status IN ('pending_insert', 'pending_update', 'pending_delete', 'failed')
      ORDER BY updated_at ASC
      LIMIT 50
    `).all();

    for (const row of rows as any[]) {
      try {
        const actionType = row.sync_action || (row.deleted ? 'delete' : row.sync_status === 'pending_insert' ? 'insert' : 'update');

        if (actionType === 'delete') {
          const action = row.type === 'IN' ? 'deleteProductIn' : 'deleteCycleCount';
          const response = await gasApi(action, { rowId: row.id });
          assertGasSuccess(response, 'Gagal hapus transaksi di Google Sheets');
          db.prepare('DELETE FROM transactions WHERE id = ?').run(row.id);
          continue;
        }

        const record = {
          rowId: row.id,
          id: row.id,
          type: row.type,
          date: row.date,
          barcode: row.barcode,
          sku: row.sku,
          product: row.product,
          batch: row.batch,
          qty: row.qty,
          status: row.status || 'Verified',
          user: row.user
        };

        const isInsert = actionType === 'insert';
        if (isInsert && row.type === 'IN') {
          await ensureMasterBatch(record);
        }

        const action = row.type === 'IN'
          ? (isInsert ? 'addProductIn' : 'updateProductIn')
          : (isInsert ? 'addCycleCount' : 'updateCycleCount');
        const payload = isInsert
          ? { record, user: row.user }
          : { rowId: row.id, record, user: row.user };

        const response = await gasApi(action, payload);
        assertGasSuccess(response, 'Gagal sync transaksi ke Google Sheets');
        db.prepare("UPDATE transactions SET sync_status = 'synced', sync_action = NULL, sync_error = NULL, updated_at = ? WHERE id = ?").run(Date.now(), row.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal sync transaksi ke Google Sheets';
        console.error(`[SQLite Sync] ${row.id} gagal`, err);
        db.prepare("UPDATE transactions SET sync_status = 'failed', sync_error = ?, updated_at = ? WHERE id = ?").run(message, Date.now(), row.id);
      }
    }
  } finally {
    isSyncingWrites = false;
  }
}

function retryFailedWrites() {
  processPendingWrites().catch(err => console.error('[SQLite Sync] Gagal menjalankan retry writes', err));
}

async function gasApi(action: string, data: any) {
  if (!SCRIPT_URL) {
    throw new Error('GOOGLE_SCRIPT_URL belum diatur di environment.');
  }

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
  const text = await res.text();
  let json: any;

  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Respons Google Apps Script bukan JSON valid: ${text.slice(0, 160)}`);
  }

  if (!res.ok) {
    throw new Error(json.message || `Google Apps Script HTTP ${res.status}`);
  }

  return json;
}

function sendGasFailure(res: express.Response, err: unknown, fallbackMessage: string) {
  const message = err instanceof Error ? err.message : fallbackMessage;
  console.error(`[Google Sheets] ${fallbackMessage}`, err);
  res.status(502).json({ success: false, message });
}

function assertGasSuccess(response: any, fallbackMessage: string) {
  if (!response || response.success !== true) {
    throw new Error(response?.message || fallbackMessage);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());
  app.get('/favicon.ico', (_req, res) => res.sendStatus(204));

  // 1. Initial Sync Master Product (Background) saat app naik
  gasApi('getProducts', {}).then(res => {
    if (res.success) {
      cachedProducts = res.data;
      console.log(`[Cache Optimizer] Memuat ${cachedProducts.length} produk langsung dari Google Sheets!`);
    }
  }).catch(() => console.log("[Cache] Menunggu sync cloud manual."));

  processPendingWrites().catch(err => console.error('[SQLite Sync] Gagal menjalankan pending writes saat startup', err));
  setInterval(retryFailedWrites, 30000);

  // 2. Fetch Master Products (Super Cepat via Cache Node)
  app.get('/api/products', async (req, res) => {
    // Return Cache instantly untuk frontend yang ringan
    if (cachedProducts.length > 0) {
      return res.json({ success: true, data: cachedProducts });
    }
    
    // Jika cache kosong, paksa tarik dari Google Sheets
    try {
      const response = await gasApi('getProducts', {});
      if (response.success) cachedProducts = response.data;
      res.json(response);
    } catch (err) {
      res.status(500).json({ success: false, message: 'Google Sheets Sinkronisasi terganggu' });
    }
  });

  // Rute khusus jika user menekan tombol Sync Refresh (Memaksa sinkronisasi Sheets baru ke RAM)
  app.post('/api/sync', async (req, res) => {
    try {
      const response = await gasApi('getProducts', {});
      assertGasSuccess(response, 'Gagal sinkronisasi master product');
      cachedProducts = response.data;
      retryFailedWrites();
      res.json({ success: true, count: cachedProducts.length });
    } catch (err) {
      sendGasFailure(res, err, 'Gagal sinkronisasi master product');
    }
  });

  // 3. Transactions List
  app.get('/api/transactions', async (req, res) => {
    const { date, user } = req.query;
    try {
      const localHistory = getLocalTransactions(date);
      if (localHistory.length > 0) {
        return res.json({ success: true, data: localHistory });
      }

      // Parallel Fetch History untuk efisiensi
      const [piRes, ccRes] = await Promise.all([
        gasApi('getProductIn', { date, user }),
        gasApi('getCycleCount', { date, user })
      ]);
      
      assertGasSuccess(piRes, 'Gagal mengambil riwayat Product In');
      assertGasSuccess(ccRes, 'Gagal mengambil riwayat Cycle Count');

      let history: any[] = [];
      if (piRes.data) {
        history.push(...piRes.data.map((d:any) => ({...d, type: 'IN', id: d.rowId, timestamp: new Date(d.date).getTime() })));
        importRemoteTransactions(piRes.data, 'IN');
      }
      if (ccRes.data) {
        history.push(...ccRes.data.map((d:any) => ({...d, type: 'CC', id: d.rowId, timestamp: new Date(d.date).getTime() })));
        importRemoteTransactions(ccRes.data, 'CC');
      }
      
      history.sort((a, b) => b.id - a.id);
      res.json({ success: true, data: getLocalTransactions(date) });
    } catch (err) {
      sendGasFailure(res, err, 'Gagal mengambil riwayat transaksi');
    }
  });

  // 4. ADD Transaction
  app.post('/api/transactions', async (req, res) => {
    const { record } = req.body;

    try {
      const localRecord = saveTransactionLocal({
        ...record,
        id: record.id || record.rowId || makeLocalId(),
        rowId: record.id || record.rowId,
        status: record.type === 'IN' ? (record.status || 'Verified') : record.status
      }, 'pending_insert', 'insert');

      if (localRecord.type === 'IN') {
        addCachedProductBatch(localRecord);
      }

      processPendingWrites().catch(err => console.error('[SQLite Sync] Gagal menjalankan pending writes', err));
      res.json({ success: true, message: 'Data tersimpan lokal dan sedang sync ke Google Sheets', id: localRecord.id });
    } catch (err) {
      sendGasFailure(res, err, 'Gagal menyimpan transaksi lokal');
    }
  });

  // 5. Update Transaction
  app.put('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    const { type } = req.query;
    const { record } = req.body;

    try {
      const existing = (db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) || {}) as any;
      const syncAction = existing.sync_action === 'insert' || existing.sync_status === 'pending_insert' ? 'insert' : 'update';
      saveTransactionLocal({ ...existing, ...record, id, rowId: id, type }, syncAction === 'insert' ? 'pending_insert' : 'pending_update', syncAction);
      processPendingWrites().catch(err => console.error('[SQLite Sync] Gagal menjalankan pending writes', err));
      res.json({ success: true, message: 'Data tersimpan lokal dan sedang sync update ke Google Sheets' });
    } catch (err) {
      sendGasFailure(res, err, 'Gagal update transaksi lokal');
    }
  });

  // 6. Delete Transaction
  app.delete('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;

    try {
      const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
      if (existing?.sync_status === 'pending_insert') {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      } else {
        db.prepare("UPDATE transactions SET deleted = 1, sync_status = 'pending_delete', sync_action = 'delete', updated_at = ? WHERE id = ?").run(Date.now(), id);
      }

      processPendingWrites().catch(err => console.error('[SQLite Sync] Gagal menjalankan pending writes', err));
      res.json({ success: true, message: 'Data dihapus lokal dan sedang sync ke Google Sheets' });
    } catch (err) {
      sendGasFailure(res, err, 'Gagal hapus transaksi lokal');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Node.JS Proxy (Google Sheets Speed Optimizer) Aktif pada port ${PORT}!`);
  });
}

startServer();
