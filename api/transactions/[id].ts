import { gasApi, methodNotAllowed, sendError } from '../_gas';

function getType(req: any): 'IN' | 'CC' {
  const rawType = Array.isArray(req.query.type) ? req.query.type[0] : req.query.type;
  return rawType === 'IN' ? 'IN' : 'CC';
}

export default async function handler(req: any, res: any) {
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const type = getType(req);

  if (!id) {
    res.status(400).json({ success: false, message: 'ID transaksi wajib diisi.' });
    return;
  }

  if (req.method === 'PUT') {
    try {
      const record = req.body?.record;
      if (!record) {
        res.status(400).json({ success: false, message: 'Record wajib diisi.' });
        return;
      }

      const action = type === 'IN' ? 'updateProductIn' : 'updateCycleCount';
      const response = await gasApi(action, { rowId: id, record, user: record.user });
      res.status(response.success === true ? 200 : 502).json(response);
    } catch (err) {
      sendError(res, err, 'Gagal update transaksi.');
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const action = type === 'IN' ? 'deleteProductIn' : 'deleteCycleCount';
      const response = await gasApi(action, { rowId: id });
      res.status(response.success === true ? 200 : 502).json(response);
    } catch (err) {
      sendError(res, err, 'Gagal hapus transaksi.');
    }
    return;
  }

  methodNotAllowed(res, ['PUT', 'DELETE']);
}
