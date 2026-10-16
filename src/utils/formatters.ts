export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!day) return dateStr;
  return `${day}/${month}/${year}`;
}

export function formatMonthName(monthStr: string): string {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const idx = parseInt(month, 10) - 1;
  return `${monthNames[idx] || month} ${year}`;
}

/**
 * Calculates a precise epoch millisecond timestamp for a transaction,
 * using createdAt, time, embedded ID timestamp, or date.
 * Guarantees that same-day transactions are sorted chronologically by date and time.
 */
export function getTransactionTimestamp(t: {
  id?: string;
  date: string;
  time?: string;
  createdAt?: string;
}): number {
  // 1. Explicit createdAt ISO timestamp
  if (t.createdAt) {
    const ts = new Date(t.createdAt).getTime();
    if (!isNaN(ts) && ts > 0) return ts;
  }

  // 2. Date string that already contains full ISO datetime
  if (t.date && t.date.length > 10 && t.date.includes('T')) {
    const ts = new Date(t.date).getTime();
    if (!isNaN(ts) && ts > 0) return ts;
  }

  // 3. Date (YYYY-MM-DD) + explicit time (HH:mm or HH:mm:ss)
  if (t.date && t.time) {
    const cleanTime = t.time.length === 5 ? `${t.time}:00` : t.time;
    const ts = new Date(`${t.date}T${cleanTime}`).getTime();
    if (!isNaN(ts) && ts > 0) return ts;
  }

  // 4. Extract 13-digit Unix millisecond epoch timestamp embedded in ID
  // e.g. push-1727612345678-abc, manual-1727612345678-abc, clip-1727612345678-0-abc
  if (t.id) {
    const match = t.id.match(/(?:push|manual|clip|csv|ofx|mirror)?[-_]?(\d{13})/);
    if (match && match[1]) {
      const tsFromId = parseInt(match[1], 10);
      if (!isNaN(tsFromId) && tsFromId > 1577836800000 && tsFromId < 2208988800000) {
        return tsFromId;
      }
    }
  }

  // 5. Fallback: Parse date YYYY-MM-DD
  if (t.date) {
    const parts = t.date.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      }
    }
    const ts = new Date(t.date).getTime();
    if (!isNaN(ts)) return ts;
  }

  return 0;
}

/**
 * Extracts and formats the time (HH:mm) of a transaction if available.
 */
export function formatTransactionTime(t: {
  id?: string;
  time?: string;
  createdAt?: string;
}): string | null {
  if (t.time && t.time.length >= 5) {
    return t.time.substring(0, 5);
  }
  if (t.createdAt) {
    try {
      const d = new Date(t.createdAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      // Ignore
    }
  }
  if (t.id) {
    const match = t.id.match(/(?:push|manual|clip|csv|ofx|mirror)?[-_]?(\d{13})/);
    if (match && match[1]) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 1577836800000 && ts < 2208988800000) {
        const d = new Date(ts);
        return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    }
  }
  return null;
}

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'no', 'na']);
/** "SUPERMERCADO BH LTDA" → "Supermercado Bh Ltda". Texto já com minúsculas fica como está. */
export function descricaoLegivel(texto: string): string {
  const t = (texto || '').trim();
  if (!t || /[a-zà-ú]/.test(t)) return t;
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
