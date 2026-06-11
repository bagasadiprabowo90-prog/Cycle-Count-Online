const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL?.trim();

export async function gasApi(action: string, data: any) {
  if (!SCRIPT_URL) {
    throw new Error('GOOGLE_SCRIPT_URL belum diatur di environment.');
  }

  const response = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data })
  });
  const text = await response.text();

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Respons Google Apps Script bukan JSON valid: ${text.slice(0, 160)}`);
  }

  if (!response.ok) {
    throw new Error(json.message || `Google Apps Script HTTP ${response.status}`);
  }

  return json;
}

export function sendError(res: any, err: unknown, fallbackMessage: string) {
  const message = err instanceof Error ? err.message : fallbackMessage;
  res.status(502).json({ success: false, message });
}

export function methodNotAllowed(res: any, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ success: false, message: 'Method not allowed' });
}
