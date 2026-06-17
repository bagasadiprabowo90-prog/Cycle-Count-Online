import { gasApi, methodNotAllowed, sendError } from './_gas.js';

function normalizeHistoryItem(item: any, type: 'IN' | 'CC') {
  const id = String(item.rowId || item.id || '');
  return {
    ...item,
    type,
    id,
    qty: Number(item.qty || 0),
    timestamp: Number(id) || new Date(item.date || Date.now()).getTime()
  };
}

async function ensureMasterBatch(record: any) {
  if (record.type !== 'IN' || !record.sku || !record.product || !record.batch) return;

  const response = await gasApi('addNewBatch', {
    record: {
      barcode: record.barcode || `NEW-${record.sku}-${record.batch}`,
      sku: record.sku,
      product: record.product,
      batch: record.batch
    }
  });

  if (response.success !== true) {
    throw new Error(response.message || 'Gagal menambahkan batch baru ke master product.');
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const date = Array.isArray(req.query.date) ? req.query.date[0] : req.query.date;
      const [productIn, cycleCount] = await Promise.all([
        gasApi('getProductIn', { date }),
        gasApi('getCycleCount', { date })
      ]);

      if (productIn.success !== true) {
        res.status(502).json(productIn);
        return;
      }
      if (cycleCount.success !== true) {
        res.status(502).json(cycleCount);
        return;
      }

      const history = [
        ...(productIn.data || []).map((item: any) => normalizeHistoryItem(item, 'IN')),
        ...(cycleCount.data || []).map((item: any) => normalizeHistoryItem(item, 'CC'))
      ].sort((a, b) => b.timestamp - a.timestamp);

      res.status(200).json({ success: true, data: history });
    } catch (err) {
      sendError(res, err, 'Gagal mengambil riwayat transaksi.');
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const record = req.body?.record;
      if (!record) {
        res.status(400).json({ success: false, message: 'Record wajib diisi.' });
        return;
      }

      await ensureMasterBatch(record);

      const action = record.type === 'IN' ? 'addProductIn' : 'addCycleCount';
      const response = await gasApi(action, { record, user: record.user });
      if (response.success !== true) {
        res.status(502).json(response);
        return;
      }

      res.status(200).json({
        success: true,
        message: response.message || 'Data berhasil disimpan.',
        id: response.rowId ? String(response.rowId) : undefined
      });
    } catch (err) {
      sendError(res, err, 'Gagal menyimpan transaksi.');
    }
    return;
  }

  methodNotAllowed(res, ['GET', 'POST']);
}
