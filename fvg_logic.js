// ==== Interpretazione periodicità — Foglio Disposizioni Prove Freno D.R. Friuli Venezia Giulia ====
// Formato diverso dal documento Veneto: ogni riga della tabella contiene UN SOLO valore di
// periodicità; più righe con stesso Treno/Prova/Turno vanno unite in OR (condizioni alternative).
// Le date non riportano l'anno: si assume 2026.
//
// Formati introdotti dalla REV.04 (25/10/2026) rispetto alla REV.03:
//  - date scritte come "DD-mon" con abbreviazione italiana del mese (es. "07-dic", "11-feb")
//    oltre al consueto "DD/MM";
//  - suffisso "dal DD/MM" (senza "al"): limite INFERIORE di validità (valido da quella data
//    in poi, senza scadenza), simmetrico al "fino al/il DD/MM" già gestito (limite superiore);
//  - separatore ":" oltre a "-" nei range Lv (es. "LV 1:5");
//  - "Festivi" per esteso come sinonimo di "F";
//  - cifra singola 1-6 senza prefisso "Lv" per indicare un giorno della settimana (oltre al
//    già noto "7" equivalente a festivo);
//  - "Circola F Infr" — nuovo codice che sostituisce "Circola F pF"/"Circola Festivi SF" delle
//    revisioni precedenti: interpretato come "festività infrasettimanale", cioè un giorno
//    festivo che NON cade di domenica;
//  - riferimenti testuali ad altri treni in coda al valore (es. "da tr 16797", "invio dopo
//    16615", "invio x tr 17362") o note estese (es. "CONTROLLI AGGIUNTIVI COME DA ART.7
//    MMIEFCA"): puramente informativi, non modificano il confronto con la data, mostrati
//    come nota.

function fvgResolveYear(d, m) {
  return 2026;
}

const ITALIAN_MONTHS = { gen:1, feb:2, mar:3, apr:4, mag:5, giu:6, lug:7, ago:8, set:9, ott:10, nov:11, dic:12 };

function fvgExpandDayRange(spec){
  const m = spec.match(/^(\d)(?:-(\d))?$/);
  if (!m) return [];
  const a = +m[1], b = m[2] ? +m[2] : +m[1];
  const days = [];
  for (let i=a;i<=b;i++) days.push(i);
  return days;
}

function fvgMakeDate(d, m){ return { d, m, y: fvgResolveYear(d, m) }; }

// --- Riferimenti/note testuali in coda al token: vengono stralciati e conservati come etichetta ---
const TRAILING_NOTE_PATTERNS = [
  /\s+DA\s+TR\s*\d+\s*$/i,
  /\s+INVIO\s+X\s+TR\s*\d+\s*$/i,
  /\s+INVIO\s+DOPO\s+\d+\s*$/i,
  /\s+CONTROLLI\s+AGGIUNTIVI[\s\S]*$/i,
];
function fvgExtractTrailingNotes(tok){
  let t = tok;
  const notes = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of TRAILING_NOTE_PATTERNS) {
      const m = t.match(re);
      if (m) {
        notes.unshift(m[0].trim());
        t = t.slice(0, m.index).trim();
        changed = true;
      }
    }
  }
  return { rest: t, notes };
}

function fvgExtractFino(tok){
  const m = tok.match(/^(.*?)\s+FINO\s+(?:AL|IL)?\s*(\d{1,2})\/(\d{1,2})\s*$/i);
  if (!m) return { rest: tok, upperBound: null };
  const d = +m[2], mo = +m[3];
  return { rest: m[1].trim(), upperBound: fvgMakeDate(d, mo) };
}

// Simmetrico a fvgExtractFino: suffisso "dal DD/MM" senza "al" che segue (limite inferiore,
// nessuna scadenza). Va cercato DOPO aver escluso il pattern "dal D al D/MM" (intervallo
// esplicito), che è gestito altrove come range completo.
function fvgExtractDal(tok){
  const m = tok.match(/^(.*?)\s+DAL\s+(\d{1,2})\/(\d{1,2})\s*$/i);
  if (!m) return { rest: tok, lowerBound: null };
  const d = +m[2], mo = +m[3];
  return { rest: m[1].trim(), lowerBound: fvgMakeDate(d, mo) };
}

function fvgParseSingleDateWithLabel(tok){
  const m = tok.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .]*))?$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  const label = m[3] ? m[3].trim() : null;
  return { date: fvgMakeDate(d, mo), label };
}

// Data in formato "DD-mon" con abbreviazione italiana del mese (es. "07-dic")
function fvgParseAbbrevMonthDate(tok){
  const m = tok.trim().match(/^(\d{1,2})-([a-zA-Zà-ÿ]{3})$/);
  if (!m) return null;
  const mo = ITALIAN_MONTHS[m[2].toLowerCase()];
  if (!mo) return null;
  return fvgMakeDate(+m[1], mo);
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

// Data singola DD/MM o DD/MM/YYYY (con anno esplicito, usato solo per sanity-check: se
// l'anno è fuori dalla finestra di validità del documento la data viene segnalata come
// non interpretabile invece di essere corretta "a caso").
function fvgParseFullOrShortDate(tok){
  let m = tok.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d=+m[1], mo=+m[2], y=+m[3];
    if (y < 2025 || y > 2026) return { invalid: true, raw: tok };
    return { date: { d, m: mo, y } };
  }
  return null;
}

function fvgParseDateExpr(expr){
  const t = expr.trim();
  if (!t) return { dates: [], ranges: [] };

  const dalAl = fvgParseDalAl(t);
  if (dalAl) return { dates: [], ranges: [dalAl] };

  const fullDate = fvgParseFullOrShortDate(t);
  if (fullDate) {
    if (fullDate.invalid) return null;
    return { dates: [fullDate.date], ranges: [] };
  }

  const abbrevMonth = fvgParseAbbrevMonthDate(t);
  if (abbrevMonth) return { dates: [abbrevMonth], ranges: [] };

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

  // 1) Stralcia riferimenti/note testuali finali (da tr NNNN, invio..., CONTROLLI AGGIUNTIVI...)
  const { rest: afterNotes, notes } = fvgExtractTrailingNotes(tok);
  tok = afterNotes;

  // 2) Stralcia limite superiore "fino al/il DD/MM"
  const { rest: afterFino, upperBound } = fvgExtractFino(tok);
  tok = afterFino;

  // 3) Stralcia limite inferiore "dal DD/MM" (solo se non è un intervallo "dal D al D/MM",
  //    già intercettato più avanti dentro fvgParseDalAl quando si tenta la classificazione data)
  let lowerBound = null;
  if (!/\bAL\b/i.test(tok)) {
    const r = fvgExtractDal(tok);
    tok = r.rest;
    lowerBound = r.lowerBound;
  }

  const upper = tok.toUpperCase();

  function finalize(obj){
    if (upperBound) obj.upperBound = upperBound;
    if (lowerBound) obj.lowerBound = lowerBound;
    if (notes.length) obj.labels = (obj.labels || []).concat(notes);
    return obj;
  }

  if (upper === 'F' || upper === 'FESTIVI') return finalize({ kind: 'festivo' });
  if (upper === '7') return finalize({ kind: 'festivo' });
  if (/^CIRCOLA\s+F\s+PF$/.test(upper)) return finalize({ kind: 'festivo_o_prefestivo' });
  if (/^CIRCOLA\s+FESTIVI\s+SF$/.test(upper)) return finalize({ kind: 'festivo_o_seguente' });
  if (/^CIRCOLA\s+F\s+INFR$/.test(upper)) return finalize({ kind: 'festivo_infrasettimanale' });

  // "F <data>": giorno festivo con una data di riferimento indicata a fianco (annotazione,
  // non vincolante: F da solo copre già tutti i festivi).
  let m = tok.match(/^F\s+(\d{1,2}\/\d{1,2})$/i);
  if (m) return finalize({ kind: 'festivo', labels: [m[1]] });

  m = upper.match(/^EFFETTUATO\s+G(\d)$/);
  if (m) return finalize({ kind: 'weekday', days: [+m[1]] });
  m = upper.match(/^EFFETTUATO\s+(\d)(?:-(\d))?$/);
  if (m) return finalize({ kind: 'weekday', days: fvgExpandDayRange(m[2] ? `${m[1]}-${m[2]}` : m[1]) });

  m = upper.match(/^LV\s*(\d)(?:[:\-](\d))?$/);
  if (m) return finalize({ kind: 'weekday', days: fvgExpandDayRange(m[2] ? `${m[1]}-${m[2]}` : m[1]) });

  // cifra singola 1-6 senza prefisso "Lv" = giorno della settimana diretto
  m = upper.match(/^([1-6])$/);
  if (m) return finalize({ kind: 'weekday', days: [+m[1]] });

  const compound = fvgParseCompoundDate(tok);
  if (compound) {
    if (compound.ranges.length === 1 && compound.dates.length === 0) {
      return finalize({ kind: 'date_range', start: compound.ranges[0].start, end: compound.ranges[0].end,
                         assumedRange: !!compound.assumedRange, labels: compound.labels });
    }
    return finalize({ kind: 'date', dates: compound.dates, ranges: compound.ranges, labels: compound.labels });
  }

  return finalize({ kind: 'unknown', raw: tok });
}

function fvgDnum(d,m,y){ return y*10000+m*100+d; }

function fvgMatchToken(parsed, d, m, y){
  const v = fvgDnum(d,m,y);
  if (parsed.upperBound) {
    const ub = fvgDnum(parsed.upperBound.d, parsed.upperBound.m, parsed.upperBound.y);
    if (v > ub) return false;
  }
  if (parsed.lowerBound) {
    const lb = fvgDnum(parsed.lowerBound.d, parsed.lowerBound.m, parsed.lowerBound.y);
    if (v < lb) return false;
  }

  const festivo = isFestivoDMY(d,m,y);
  const dow = new Date(y, m-1, d).getDay();
  const code = dow === 0 ? 7 : dow;

  switch (parsed.kind) {
    case 'festivo':
      return festivo;
    case 'festivo_infrasettimanale':
      return festivo && dow !== 0;
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
      const inDates = (parsed.dates || []).some(dd => fvgDnum(dd.d,dd.m,dd.y) === v);
      const inRanges = (parsed.ranges || []).some(rg => v >= fvgDnum(rg.start.d,rg.start.m,rg.start.y) && v <= fvgDnum(rg.end.d,rg.end.m,rg.end.y));
      return inDates || inRanges;
    }
    case 'date_range': {
      return v >= fvgDnum(parsed.start.d,parsed.start.m,parsed.start.y) && v <= fvgDnum(parsed.end.d,parsed.end.m,parsed.end.y);
    }
    case 'unknown':
    default:
      return null;
  }
}
