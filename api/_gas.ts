const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL?.trim();

export async function gasApi(action: string, data: any) {
  if (!SCRIPT_URL) {
    throw new Error('GOOGLE_SCRIPT_URL belum diatur di environment.');
  }

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data })
    });

    const text = await response.text();

    // Check if response is HTML (error page from Apps Script)
    if (text.trim().startsWith('<') && text.includes('Moved Temporarily')) {
      throw new Error('Google Apps Script redirecting. Pastikan Apps Script di-deploy sebagai Web App dengan "Who has access: Anyone".');
    }

    if (text.trim().startsWith('<') && text.includes('Error')) {
      throw new Error(`Google Apps Script error: ${text.slice(0, 200)}`);
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error(`Respons bukan JSON valid. Kemungkinan Apps Script belum di-deploy dengan benar. Response: ${text.slice(0, 160)}`);
    }

    if (!response.ok) {
      throw new Error(json.message || `Google Apps Script HTTP ${response.status}`);
    }

    return json;
  } catch (err) {
    if (err instanceof Error) {
      // Check for network/redirect issues
      if (err.message.includes('fetch') || err.message.includes('redirect')) {
        throw new Error('Gagal terhubung ke Google Apps Script. Pastikan URL sudah benar dan Apps Script di-deploy sebagai Web App.');
      }
      throw err;
    }
    throw new Error('Tidak bisa terhubung ke Google Apps Script.');
  }
}

export function sendError(res: any, err: unknown, fallbackMessage: string) {
  const message = err instanceof Error ? err.message : fallbackMessage;
  res.status(502).json({ success: false, message });
}

export function methodNotAllowed(res: any, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ success: false, message: 'Method not allowed' });
}
