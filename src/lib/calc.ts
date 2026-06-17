export function calculateQty(input: string): number {
  try {
    const raw = input.trim();
    if (!raw) return 0;

    if (/^\d+$/.test(raw)) {
      return parseInt(raw, 10);
    }

    const expr = raw
      .replace(/x|×/gi, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '.');

    if (!/^[\d+\-*/.\s()]+$/.test(expr)) return 0;

    const result = new Function(`return (${expr})`)();
    if (isNaN(result) || !isFinite(result)) return 0;

    return Math.round(result);
  } catch (err) {
    return 0;
  }
}

export function formatDateShort(mdy: string): string {
  if (!mdy || !mdy.includes('/')) return '';
  const parts = mdy.split('/');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[parseInt(parts[0], 10) - 1] || '';
  const day = parseInt(parts[1], 10);
  const year = parts[2];
  return `${day} ${month} ${year}`;
}

export function formatDateFull(mdy: string): string {
  if (!mdy || !mdy.includes('/')) return '';
  const parts = mdy.split('/');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[parseInt(parts[0], 10) - 1] || '';
  const day = parseInt(parts[1], 10);
  const year = parts[2];
  return `${month} ${day}, ${year}`;
}

export function toYMD(mdy: string) {
  if (!mdy || !mdy.includes('/')) return '';
  const parts = mdy.split('/');
  return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}

export function toMDY(ymd: string) {
  if (!ymd || !ymd.includes('-')) return '';
  const parts = ymd.split('-');
  return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`;
}

export function isToday(mdy: string): boolean {
  if (!mdy || !mdy.includes('/')) return false;

  try {
    const [month, day, year] = mdy.split('/').map(Number);
    const saved = new Date(year, month - 1, day);
    const today = new Date();

    // Reset time to start of day
    saved.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return saved.getTime() === today.getTime();
  } catch {
    return false;
  }
}
