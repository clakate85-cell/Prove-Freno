// ==== Interpretazione periodicità — Foglio Disposizioni Prove Freno D.R. Friuli Venezia Giulia ====
// Formato diverso dal documento Veneto: ogni riga della tabella contiene UN SOLO valore di
// periodicità; più righe con stesso Treno/Prova/Turno vanno unite in OR (condizioni alternative).
// Le date non riportano l'anno: si assume 2026 (la revisione REV.03 è valida dal 11/09/2026).
//
// Formati aggiuntivi introdotti dalla REV.03 rispetto alla REV.02:
//  - suffisso "fino al/il/<nulla> DD/MM" su un token settimanale o festivo: limita la validità
//    del token a "fino a e incluso" quella data (nessun limite inferiore esplicito).
//  - singola data seguita da un'etichetta evento libera (es. "26/09 GdF", "12/09 FR DOC",
//    "10/10 Barcolana"): l'etichetta è puramente descrittiva e non incide sul confronto date,
//    viene solo mostrata come nota.
//  - token composti con liste e intervalli espliciti "dal D al D/MM" uniti da "e" e ";"
//    (es. "21-28/09; 05-12/10 e dal 19 al 22/10").

function fvgResolveYear(d, m) {
  // Finestra di validità 14/12/2025 - 12/12/2026. La REV.03 è in vigore dall'11/09/2026.
  // Tutte le date di questo prospetto ricadono nel 2026.
  return 2026;
}

function fvgExpandDayRange(spec){
  const m = spec.match(/^(\d)(?:-(\d))?$/);
  if (!m) return [];
  const a = +m[1], b = m[2] ? +m[2] : +m[1];
  const days = [];
  for (let i=a;i<=b;i++) days.push(i);
  return days;
}

function fvgMakeDate(d, m){ return { d, m, y: fvgResolveYear(d, m) }; }

function fvgExtractFino(tok){
  const m = tok.match(/^(.*?)\s+FINO\s+(?:AL|IL)?\s*(\d{1,2})\/(\d{1,2})\s*$/i);
  if (!m) return { rest: tok, upperBound: null };
  const d = +m[2], mo = +m[3];
  return { rest: m[1].trim(), upperBound: fvgMakeDate(d, mo) };
}

function fvgParseSingleDateWithLabel(tok){
  const m = tok.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .]*))?$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  const label = m[3] ? m[3].trim() : null;
  return { date: fvgMakeDate(d, mo), label };
}

function fvgParseDateListSameMonth(tok){
  const m = tok.trim().match(/^(\d{1,2}(?:-\d{1,2})*)\/(\d{1,2})$/);
  if (!m) return null;
  const days = m[1].split('-').map(s=>+s);
  const mo = +m[2];
  return days.map(d => fvgMakeDate(d, mo));
}

function fvgParseFullDateChain(tok){
  const parts = tok.trim().split('-').map(s=>s.trim());
  if (parts.length < 2) return null;
  if (!parts.every(p => /^\d{1,2}\/\d{1,2}$/.test(p))) return null;
  return parts.map(p => {
    const [dd,mm] = p.split('/').map(Number);
    return fvgMakeDate(dd, mm);
  });
}

function fvgParseDalAl(tok){
  const m = tok.trim().match(/^DAL\s+(\d{1,2}(?:\/\d{1,2})?)\s+AL\s+(\d{1,2}\/\d{1,2})\s*$/i);
  if (!m) return null;
  const [ed, em] = m[2].split('/').map(Number);
  const end = fvgMakeDate(ed, em);
  let start;
  if (m[1].includes('/')) {
    const [sd, sm] = m[1].split('/').map(Number);
    start = fvgMakeDate(sd, sm);
  } else {
    start = fvgMakeDate(+m[1], em);
  }
  return { start, end };
}

function fvgParseDateExpr(expr){
  const t = expr.trim();
  if (!t) return { dates: [], ranges: [] };

  const dalAl = fvgParseDalAl(t);
  if (dalAl) return { dates: [], ranges: [dalAl] };

  const sameMonth = fvgParseDateListSameMonth(t);
  if (sameMonth) return { dates: sameMonth, ranges: [] };

  const single = fvgParseSingleDateWithLabel(t);
  if (single) return { dates: [single.date], ranges: [], label: single.label };

  const chain = fvgParseFullDateChain(t);
  if (chain) {
    if (chain.length === 2) return { dates: [], ranges: [{ start: chain[0], end: chain[1] }], assumedRange: true };
    return { dates: chain, ranges: [] };
  }

  return null;
}

function fvgParseCompoundDate(tok){
  const semiParts = tok.split(';').map(s=>s.trim()).filter(Boolean);
  let dates = [], ranges = [], labels = [], assumedRange = false, ok = true;
  for (const sp of semiParts) {
    const andParts = sp.split(/\s+E\s+/i).map(s=>s.trim()).filter(Boolean);
    for (const ap of andParts) {
      const r = fvgParseDateExpr(ap);
      if (!r) { ok = false; break; }
      dates = dates.concat(r.dates);
      ranges = ranges.concat(r.ranges);
      if (r.label) labels.push(r.label);
      if (r.assumedRange) assumedRange = true;
    }
    if (!ok) break;
  }
  if (!ok) return null;
  return { dates, ranges, labels, assumedRange };
}

function fvgParseToken(raw){
  let tok = raw.trim();

  const { rest, upperBound } = fvgExtractFino(tok);
  tok = rest;
  const upper = tok.toUpperCase();

  function withBound(obj){
    if (upperBound) obj.upperBound = upperBound;
    return obj;
  }

  if (upper === 'F') return withBound({ kind: 'festivo' });
  if (upper === '7') return withBound({ kind: 'festivo' });
  if (/^CIRCOLA\s+F\s+PF$/.test(upper)) return withBound({ kind: 'festivo_o_prefestivo' });
  if (/^CIRCOLA\s+FESTIVI\s+SF$/.test(upper)) return withBound({ kind: 'festivo_o_seguente' });

  let m = upper.match(/^EFFETTUATO\s+G(\d)$/);
  if (m) return withBound({ kind: 'weekday', days: [+m[1]] });
  m = upper.match(/^EFFETTUATO\s+(\d)(?:-(\d))?$/);
  if (m) return withBound({ kind: 'weekday', days: fvgExpandDayRange(m[2] ? `${m[1]}-${m[2]}` : m[1]) });

  m = upper.match(/^LV\s*(\d)(?:-(\d))?$/);
  if (m) return withBound({ kind: 'weekday', days: fvgExpandDayRange(m[2] ? `${m[1]}-${m[2]}` : m[1]) });

  const compound = fvgParseCompoundDate(tok);
  if (compound) {
    if (compound.ranges.length === 1 && compound.dates.length === 0) {
      return withBound({ kind: 'date_range', start: compound.ranges[0].start, end: compound.ranges[0].end,
                          assumedRange: !!compound.assumedRange, labels: compound.labels });
    }
    return withBound({ kind: 'date', dates: compound.dates, ranges: compound.ranges, labels: compound.labels });
  }

  return withBound({ kind: 'unknown', raw: tok });
}

function fvgDnum(d,m,y){ return y*10000+m*100+d; }

function fvgMatchToken(parsed, d, m, y){
  if (parsed.upperBound) {
    const v = fvgDnum(d,m,y);
    const ub = fvgDnum(parsed.upperBound.d, parsed.upperBound.m, parsed.upperBound.y);
    if (v > ub) return false;
  }

  const festivo = isFestivoDMY(d,m,y);
  const dow = new Date(y, m-1, d).getDay();
  const code = dow===0 ? 7 : dow;

  switch (parsed.kind) {
    case 'festivo':
      return festivo;
    case 'festivo_o_prefestivo': {
      const prev = new Date(y, m-1, d-1);
      const prevFestivo = isFestivoDMY(prev.getDate(), prev.getMonth()+1, prev.getFullYear());
      return festivo || prevFestivo;
    }
    case 'festivo_o_seguente': {
      const prev = new Date(y, m-1, d-1);
      const prevFestivo = isFestivoDMY(prev.getDate(), prev.getMonth()+1, prev.getFullYear());
      return festivo && prevFestivo;
    }
    case 'weekday':
      return parsed.days.includes(code === 7 ? 7 : code);
    case 'date': {
      const v = fvgDnum(d,m,y);
      const inDates = (parsed.dates || []).some(dd => fvgDnum(dd.d,dd.m,dd.y) === v);
      const inRanges = (parsed.ranges || []).some(rg => v >= fvgDnum(rg.start.d,rg.start.m,rg.start.y) && v <= fvgDnum(rg.end.d,rg.end.m,rg.end.y));
      return inDates || inRanges;
    }
    case 'date_range': {
      const v = fvgDnum(d,m,y);
      return v >= fvgDnum(parsed.start.d,parsed.start.m,parsed.start.y) && v <= fvgDnum(parsed.end.d,parsed.end.m,parsed.end.y);
    }
    case 'unknown':
    default:
      return null;
  }
}
