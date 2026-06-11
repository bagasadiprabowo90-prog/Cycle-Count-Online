import { gasApi, methodNotAllowed, sendError } from './_gas';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST']);
    return;
  }

  try {
    const response = await gasApi('getProducts', {});
    if (response.success !== true) {
      res.status(502).json(response);
      return;
    }

    res.status(200).json({ success: true, count: response.data?.length || 0 });
  } catch (err) {
    sendError(res, err, 'Gagal sinkronisasi master product.');
  }
}
