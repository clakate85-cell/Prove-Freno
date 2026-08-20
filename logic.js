// ==== Interpretazione del campo "Periodicità" del Foglio Disposizioni Prove Freno ====

const FD_START = { d: 14, m: 12, y: 2025 };
const FD_END   = { d: 12, m: 12, y: 2026 };

// Festività nazionali italiane nel periodo di validità del FD (14/12/2025 - 12/12/2026)
const HOLIDAYS = [
  [25,12,2025], [26,12,2025],           // Natale, Santo Stefano
  [1,1,2026], [6,1,2026],               // Capodanno, Epifania
  [5,4,2026], [6,4,2026],               // Pasqua, Pasquetta
  [25,4,2026], [1,5,2026], [2,6,2026],  // Liberazione, Lavoro, Repubblica
  [15,8,2026],                          // Ferragosto
  [1,11,2026],                          // Ognissanti
  [8,12,2026]                           // Immacolata
];

function dnum(d,m,y){ return y*10000+m*100+d; }
function inHolidays(d,m,y){ return HOLIDAYS.some(h => h[0]===d && h[1]===m && h[2]===y); }
function isFestivoDMY(d,m,y){
  const dt = new Date(y,m-1,d);
  return dt.getDay()===0 || inHolidays(d,m,y);
}

function clean(raw){
  let t = raw.trim();
  t = t.replace(/\bNAL\b/gi, 'AL');
  t = t.replace(/DAL\s+DAL/gi, 'DAL');
  t = t.replace(/\bAL\s+AL\b/gi, 'AL');
  t = t.replace(/\/+/g, '/');
  t = t.replace(/\bIL(\d)/gi, 'IL $1');
  t = t.replace(/\s+/g, ' ');
  return t.trim();
}

function parseDateToken(tok, fbMonth, fbYear){
  tok = tok.trim();
  let m = tok.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return {d:+m[1], m:+m[2], y:+m[3]};
  m = tok.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) { if (fbYear) return {d:+m[1], m:+m[2], y:fbYear}; return null; }
  m = tok.match(/^(\d{1,2})$/);
  if (m) { if (fbMonth && fbYear) return {d:+m[1], m:fbMonth, y:fbYear}; return null; }
  return null;
}

function extractRange(text){
  const re = /DAL\s*(\d{1,2}(?:\/\d{1,2})?(?:\/\d{4})?)\s*AL\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
  const m = text.match(re);
  if (!m) return { range: null, rest: text };
  const end = parseDateToken(m[2]);
  const start = parseDateToken(m[1], end ? end.m : null, end ? end.y : null);
  const rest = text.slice(0, m.index) + text.slice(m.index + m[0].length);
  return { range: (start && end) ? {start, end} : null, rest };
}

function fixYearIfOutOfRange(d, notes){
  if (!d) return d;
  const v = dnum(d.d, d.m, d.y);
  const FD_S = dnum(FD_START.d, FD_START.m, FD_START.y);
  const FD_E = dnum(FD_END.d, FD_END.m, FD_END.y);
  if (v < FD_S || v > FD_E) {
    const cand = { d: d.d, m: d.m, y: d.y + 1 };
    const cv = dnum(cand.d, cand.m, cand.y);
    if (cv >= FD_S && cv <= FD_E) {
      notes.push(`Anno corretto ${d.y}→${cand.y} per la data ${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')} (probabile refuso nel documento originale)`);
      return cand;
    }
  }
  return d;
}

function parseSpecificDates(text, notes){
  let t = text.replace(/\bIL\b/gi, '');
  const tokens = t.split(/,|\bE\b|\be\b/).map(s=>s.trim()).filter(Boolean);
  const parsed = [];
  const bad = [];
  let pending = [];
  for (const tok of tokens) {
    let m = tok.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mo = +m[2], y = +m[3];
      for (const p of pending) {
        if (p.kind === 'dm') parsed.push({d:p.d, m:p.m, y});
        else if (p.kind === 'd') parsed.push({d:p.d, m:mo, y});
      }
      pending = [];
      parsed.push({d:+m[1], m:mo, y});
      continue;
    }
    m = tok.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (m) { pending.push({kind:'dm', d:+m[1], m:+m[2]}); continue; }
    m = tok.match(/^(\d{1,2})$/);
    if (m) { pending.push({kind:'d', d:+m[1]}); continue; }
    if (tok) bad.push(tok);
  }
  const fixed = parsed.map(d => fixYearIfOutOfRange(d, notes));
  return { dates: fixed, bad };
}

function expandDays(spec){
  spec = spec.toUpperCase().replace(/\s+/g,'');
  const days = new Set();
  for (const part of spec.split('E')) {
    if (!part) continue;
    let m = part.match(/^(\d)-(\d)$/);
    if (m) { for (let i=+m[1]; i<=+m[2]; i++) days.add(i); continue; }
    m = part.match(/^\d$/);
    if (m) days.add(+part);
  }
  return Array.from(days).sort();
}

function parsePeriodicita(raw){
  let text = clean(raw);
  const result = { raw, type: 'unknown', days: [], includeFestivo: false,
                    range: null, exclude: null, dates: [], unresolved: [], notes: [] };

  let m = text.match(/\(?\s*ESCLUSO\s+DAL\s*(\d{1,2}\/\d{1,2}(?:\/\d{4})?)\s*AL\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*\)?/i);
  if (m) {
    const end = parseDateToken(m[2]);
    const start = parseDateToken(m[1], end.m, end.y);
    result.exclude = { type: 'range', start, end };
    text = text.slice(0, m.index) + text.slice(m.index + m[0].length);
  } else {
    m = text.match(/ESCLUSO\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (m) {
      result.exclude = { type: 'date', date: parseDateToken(m[1]) };
      text = text.slice(0, m.index) + text.slice(m.index + m[0].length);
    }
  }

  const { range, rest } = extractRange(text);
  if (range) result.range = range;
  text = rest;

  const upper = text.toUpperCase().trim();

  if (/\bPERMANENTE\b/.test(upper)) {
    const md = upper.match(/PERMANENTE\s+([1-6](?:-[1-6])?(?:\s*E\s*[1-6])?)/);
    if (md) { result.type = 'weekday'; result.days = expandDays(md[1]); }
    else result.type = 'every';
    return result;
  }

  if (/\bLAVORATIVO\b|\bLV\b/.test(upper)) {
    result.type = 'weekday';
    const md = upper.match(/(?:LAVORATIVO|LV)\s+([1-6](?:-[1-6])?(?:\s*E\s*[1-6])?)/);
    if (md) result.days = expandDays(md[1]);
    if (/\bE\s+F\b|\bE\s+FESTIVO\b/.test(upper)) result.includeFestivo = true;
    return result;
  }

  if (/^F\s+SEGUENTE\s+F$/.test(upper)) {
    // giorno festivo che segue immediatamente un altro giorno festivo
    // (es. 26/12 dopo il 25/12, Pasquetta dopo Pasqua)
    result.type = 'festivo_seguente';
    return result;
  }

  if (/\bFESTIVO\b/.test(upper)) {
    result.type = 'festivo';
    return result;
  }

  if (/^\s*IL\b/.test(upper) || /^\d/.test(upper)) {
    const src = upper.startsWith('IL') ? upper : 'IL ' + upper;
    const { dates, bad } = parseSpecificDates(src, result.notes);
    result.type = 'specific';
    result.dates = dates;
    result.unresolved = bad;
    return result;
  }

  if (result.range) {
    result.type = 'every';
    result.notes.push("Nessuna parola chiave (LAVORATIVO/FESTIVO/PERMANENTE) nel testo originale: interpretato come valido tutti i giorni nel periodo indicato");
    return result;
  }

  result.type = 'unknown';
  return result;
}

function inRangeDMY(d,m,y, range){
  if (!range) return true;
  const v = dnum(d,m,y);
  return v >= dnum(range.start.d, range.start.m, range.start.y) && v <= dnum(range.end.d, range.end.m, range.end.y);
}

function matchesDate(parsed, d, m, y){
  if (parsed.range && !inRangeDMY(d,m,y,parsed.range)) return false;
  if (parsed.exclude) {
    if (parsed.exclude.type === 'range' && inRangeDMY(d,m,y,{start:parsed.exclude.start, end:parsed.exclude.end})) return false;
    if (parsed.exclude.type === 'date' && parsed.exclude.date && dnum(d,m,y) === dnum(parsed.exclude.date.d, parsed.exclude.date.m, parsed.exclude.date.y)) return false;
  }
  const festivo = isFestivoDMY(d,m,y);
  const dow = new Date(y, m-1, d).getDay(); // 0=Sun..6=Sat
  const code = festivo ? 'F' : (dow===0 ? 7 : dow); // dow 1..6 = Mon..Sat

  switch (parsed.type) {
    case 'every': return true;
    case 'festivo': return festivo;
    case 'festivo_seguente': {
      const prev = new Date(y, m-1, d-1);
      const prevFestivo = isFestivoDMY(prev.getDate(), prev.getMonth()+1, prev.getFullYear());
      return festivo && prevFestivo;
    }
    case 'weekday':
      if (code === 'F') return parsed.includeFestivo;
      return parsed.days.includes(code);
    case 'specific':
      return parsed.dates.some(dd => dnum(dd.d,dd.m,dd.y) === dnum(d,m,y));
    case 'unknown':
    default:
      return null; // indeterminato
  }
}

