// ==== Parking FVG — corrispondenza treno arrivo/partenza in sosta ====
// Ogni riga indica un treno in arrivo che sosta in un impianto e riparte come altro treno
// numero. La periodicità usa "LV" (lavorativo) + range giorni 1-6, "F" per festivo, ed
// eventuali stili di spaziatura diversi attorno al trattino ("LV 1 -5", "LV 1 - 5", "LV1-5"
// sono equivalenti). Più condizioni unite da virgola o punto e virgola sono alternative (OR).

function parkingNormalizeToken(raw){
  // Uniforma gli stili di spaziatura: "LV 1 -5", "LV 1 - 5", "LV 1-5" -> "LV1-5"
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/^LV/, 'LV');
}

function parkingExpandDays(spec){
  const m = spec.match(/^(\d)(?:-(\d))?$/);
  if (!m) return [];
  const a = +m[1], b = m[2] ? +m[2] : +m[1];
  const days = [];
  for (let i=a;i<=b;i++) days.push(i);
  return days;
}

// Ritorna un array di condizioni: [{kind:'weekday', days:[...]}, {kind:'festivo'}, ...]
function parkingParsePeriodicita(raw){
  const parts = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  const conditions = [];
  for (const part of parts) {
    const tok = parkingNormalizeToken(part);
    if (tok === 'F') { conditions.push({ kind: 'festivo' }); continue; }
    const m = tok.match(/^LV(\d)(?:-(\d))?$/);
    if (m) { conditions.push({ kind: 'weekday', days: parkingExpandDays(m[2] ? `${m[1]}-${m[2]}` : m[1]) }); continue; }
    conditions.push({ kind: 'unknown', raw: part });
  }
  return conditions;
}

function parkingMatches(conditions, d, m, y){
  const festivo = isFestivoDMY(d, m, y); // riusa da logic.js
  const dow = new Date(y, m-1, d).getDay();
  const code = dow === 0 ? 7 : dow;
  let anyUnknown = false;
  for (const c of conditions) {
    if (c.kind === 'festivo' && festivo) return true;
    if (c.kind === 'weekday' && !festivo && c.days.includes(code)) return true;
    if (c.kind === 'unknown') anyUnknown = true;
  }
  return anyUnknown ? null : false;
}
