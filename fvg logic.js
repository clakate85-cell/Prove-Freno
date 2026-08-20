// ==== Interpretazione periodicità — Foglio Disposizioni Prove Freno D.R. Friuli Venezia Giulia ====
// Formato diverso dal documento Veneto: ogni riga della tabella contiene UN SOLO valore di
// periodicità; più righe con stesso Treno/Prova/Turno vanno unite in OR (condizioni alternative).
// Le date non riportano l'anno: si assume 2026 (la revisione è valida dal 14/06/2026), tranne
// se la combinazione giorno/mese cade prima del 14/06/2026, nel qual caso si assume 2025 se
// compatibile con la finestra di validità, altrimenti si mantiene 2026.

function fvgResolveYear(d, m) {
  // La finestra di validità è 14/12/2025 - 12/12/2026. La revisione corrente parte dal 14/06/2026.
  // Tutte le date con mese 6-12 vengono assegnate al 2026 (coerente con l'orario in vigore da giu 2026).
  // Non sono presenti date con mese 1-5 in questo prospetto; se comparissero, si assume comunque 2026.
  return 2026;
}

function fvgExpandDayRange(spec){
  // spec tipo "1-4", "6", "2-4"
  const m = spec.match(/^(\d)(?:-(\d))?$/);
  if (!m) return [];
  const a = +m[1], b = m[2] ? +m[2] : +m[1];
  const days = [];
  for (let i=a;i<=b;i++) days.push(i);
  return days;
}

function fvgParseDatePart(tok){
  // tok tipo "20/6" o "14/08"
  const m = tok.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2];
  return { d, m: mo, y: fvgResolveYear(d, mo) };
}

function fvgParseDateListSameMonth(tok){
  // tok tipo "16-17-18/06" o "01-07-22-23/07" o "18-19/06"
  const m = tok.trim().match(/^(\d{1,2}(?:-\d{1,2})*)\/(\d{1,2})$/);
  if (!m) return null;
  const days = m[1].split('-').map(s=>+s);
  const mo = +m[2];
  return days.map(d => ({ d, m: mo, y: fvgResolveYear(d, mo) }));
}

function fvgParseFullDateChain(tok){
  // tok tipo "11/07-08/08" (2 elementi) o "04/07-01/08-05/09" (3 elementi):
  // sequenza di date complete DD/MM separate da trattino.
  const parts = tok.trim().split('-').map(s=>s.trim());
  if (parts.length < 2) return null;
  if (!parts.every(p => /^\d{1,2}\/\d{1,2}$/.test(p))) return null;
  const dates = parts.map(p => {
    const [dd,mm] = p.split('/').map(Number);
    return { d: dd, m: mm, y: fvgResolveYear(dd,mm) };
  });
  return dates;
}

function fvgParseToken(raw){
  const tok = raw.trim();
  const upper = tok.toUpperCase();

  // --- tipo festivo/settimana ---
  if (upper === 'F') return { kind: 'festivo' };
  if (upper === '7') return { kind: 'festivo' }; // notazione equivalente osservata nel documento
  if (/^CIRCOLA\s+F\s+PF$/.test(upper)) return { kind: 'festivo_o_prefestivo' };
  if (/^CIRCOLA\s+FESTIVI\s+SF$/.test(upper)) return { kind: 'festivo_o_seguente' };

  let m = upper.match(/^EFFETTUATO\s+G(\d)$/);
  if (m) return { kind: 'weekday', days: [+m[1]] };
  m = upper.match(/^EFFETTUATO\s+(\d)(?:-(\d))?$/);
  if (m) return { kind: 'weekday', days: fvgExpandDayRange(m[2] ? `${m[1]}-${m[2]}` : m[1]) };

  m = upper.match(/^LV\s*(\d)(?:-(\d))?$/);
  if (m) return { kind: 'weekday', days: fvgExpandDayRange(m[2] ? `${m[1]}-${m[2]}` : m[1]) };

  // --- tipo data ---
  // split su ';' -> unione di sotto-condizioni
  if (tok.includes(';')) {
    const subParts = tok.split(';').map(s=>s.trim()).filter(Boolean);
    let dates = [];
    let ok = true;
    for (const sp of subParts) {
      const sub = fvgParseToken(sp);
      if (sub && sub.kind === 'date' && sub.dates) dates = dates.concat(sub.dates);
      else { ok = false; break; }
    }
    if (ok) return { kind: 'date', dates };
  }

  // data singola "D/M"
  m = tok.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const d = fvgParseDatePart(tok);
    return { kind: 'date', dates: [d] };
  }

  // catena di date complete "DD/MM-DD/MM(-DD/MM...)"
  const chain = fvgParseFullDateChain(tok);
  if (chain) {
    if (chain.length === 2) {
      // assunzione: 2 date complete separate da trattino = INTERVALLO dal primo al secondo
      return { kind: 'date_range', start: chain[0], end: chain[1], assumedRange: true };
    } else {
      return { kind: 'date', dates: chain };
    }
  }

  // lista di giorni con mese condiviso "D-D-D/MM"
  const list = fvgParseDateListSameMonth(tok);
  if (list) return { kind: 'date', dates: list };

  return { kind: 'unknown', raw: tok };
}

function fvgDnum(d,m,y){ return y*10000+m*100+d; }

function fvgMatchToken(parsed, d, m, y){
  const festivo = isFestivoDMY(d,m,y); // riusa da logic.js (Veneto) già caricato in pagina
  const dow = new Date(y, m-1, d).getDay();
  const code = dow===0 ? 7 : dow; // 1..7, 7=domenica (puro calendario, non festivo)

  switch (parsed.kind) {
    case 'festivo':
      return festivo;
    case 'festivo_o_prefestivo': {
      // prefestivo = giorno immediatamente precedente un giorno festivo
      const prev = new Date(y, m-1, d-1);
      const prevFestivo = isFestivoDMY(prev.getDate(), prev.getMonth()+1, prev.getFullYear());
      return festivo || prevFestivo;
    }
    case 'festivo_o_seguente': {
      // "seguente festivo" = giorno festivo che segue immediatamente un altro giorno festivo
      // (es. 26/12 dopo il 25/12, Pasquetta dopo Pasqua) — stesso concetto di "F SEGUENTE F"
      // del documento Veneto, qui indicato con la sigla "SF".
      const prev = new Date(y, m-1, d-1);
      const prevFestivo = isFestivoDMY(prev.getDate(), prev.getMonth()+1, prev.getFullYear());
      return festivo && prevFestivo;
    }
    case 'weekday':
      return parsed.days.includes(code === 7 ? 7 : code);
    case 'date':
      return parsed.dates.some(dd => fvgDnum(dd.d,dd.m,dd.y) === fvgDnum(d,m,y));
    case 'date_range': {
      const v = fvgDnum(d,m,y);
      return v >= fvgDnum(parsed.start.d,parsed.start.m,parsed.start.y) && v <= fvgDnum(parsed.end.d,parsed.end.m,parsed.end.y);
    }
    case 'unknown':
    default:
      return null;
  }
}
