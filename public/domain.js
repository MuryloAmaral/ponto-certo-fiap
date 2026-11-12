export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function minutesUntil(reference, arrival) {
  const parse = value => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!match || +match[1] > 23 || +match[2] > 59) return null;
    return +match[1] * 60 + +match[2];
  };
  const ref = parse(reference), time = parse(arrival);
  if (ref === null || time === null) return null;
  let difference = time - ref;
  if (difference < -720) difference += 1440; // Passagem de 23h para 0h.
  return difference >= 0 && difference < 720 ? difference : null;
}

export function flattenForecast(data) {
  const rows = [];
  for (const line of data?.p?.l || []) {
    for (const bus of line.vs || []) {
      const minutes = minutesUntil(data.hr, bus.t);
      rows.push({
        line: String(line.c || 'Linha'), destination: String(line.lt0 || 'Destino não informado'),
        prefix: String(bus.p || '-'), arrival: String(bus.t || '--:--'),
        accessible: bus.a === true ? true : bus.a === false ? false : null,
        minutes
      });
    }
  }
  return rows.sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity));
}

export function readFavorites(storage) {
  try {
    const data = JSON.parse(storage.getItem('ponto-certo-favoritos') || '[]');
    if (!Array.isArray(data)) return [];
    const seen = new Set();
    return data.filter(item => {
      if (!item || !Number.isSafeInteger(item.cp) || item.cp <= 0 || typeof item.np !== 'string' || seen.has(item.cp)) return false;
      seen.add(item.cp);
      return true;
    }).slice(0, 20).map(({ cp, np, ed }) => ({ cp, np: np.slice(0, 160), ed: String(ed || '').slice(0, 240) }));
  } catch { return []; }
}

export function lineLabel(line) {
  return `${line.lt ?? ''}-${String(line.tl ?? '').padStart(2, '0')}`;
}
