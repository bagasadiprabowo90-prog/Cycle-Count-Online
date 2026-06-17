import { gasApi, methodNotAllowed, sendError } from './_gas.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  try {
    const response = await gasApi('getProducts', {});
    res.status(200).json(response);
  } catch (err) {
    sendError(res, err, 'Gagal mengambil master product.');
  }
}
