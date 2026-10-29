// Fusión de evidencia: combina similitud visual (candidatos) con lo impreso leído por OCR y decide un ESTADO,
// no una "probabilidad". Un coseno alto no es una probabilidad estadística; por eso no se expone un porcentaje de confianza.
//
// Estados: sin_coincidencias · ambiguo · probable · confirmado
//   confirmado = lo impreso (número) coincide exactamente con un candidato visualmente razonable y lo distingue de los demás.
//   probable   = solo visual, con margen suficiente sobre el siguiente candidato.
//   ambiguo    = varias impresiones posibles: se muestran como alternativas para elegir.
import { compareCanon, constrainToCandidates } from './games/common.js';
import { normalizeName, nameSimilarity } from './games/common.js';

// Umbrales PROVISIONALES. minVisual/margen salen de scripts/calibrate_thresholds.mjs (consultas sintéticas sobre el índice real);
// los pesos de la evidencia OCR están por calibrar con lecturas OCR de fotos reales (docs/EVALUACION.md).
export const THRESHOLDS = {
  minVisual: 0.7, // medido (Pokémon, q8): reales p05 = 0.81; cartas ajenas al índice p50 = 0.74, máx 0.84 → el coseno solo NO separa ajenas de propias
  trustScore: 0.8, // bajo este coseno, candidatos de nombres distintos y sin ventaja = ruido (fondo, mano), no una carta
  probableMargin: 0.04, // ventaja mínima del primero sobre el segundo (ya fusionados) para declararlo probable
  window: 0.12, // candidatos a menos de esto del primero participan de la corrección de OCR
  nameMatch: 0.12, nameMin: 0.78, // nombre impreso leído por OCR ≈ nombre del candidato
  numberExact: 0.12, numberPartial: 0.04, numberMismatch: -0.03, // el OCR solo promueve: las lecturas erróneas existen (medido 3-23 % según juego) y la confianza de Tesseract no las distingue
  setMatch: 0.06, setMismatch: -0.06,
};

/**
 * @param {object} p
 * @param {{id:string, score:number, meta:object}[]} p.candidates ordenados por similitud visual (mayor primero)
 * @param {{number:string|null, setCode:string|null}|null} p.ocr lectura OCR ya interpretada por el adaptador del juego
 * @param {object} p.adapter adaptador del juego (games/adapters.js)
 * @param {object} [p.thresholds]
 */
export const fuse = ({ candidates, ocr = null, adapter, thresholds = THRESHOLDS }) => {
  const T = thresholds;
  if (!candidates?.length || candidates[0].score < T.minVisual) return { status: 'sin_coincidencias', best: null, alternatives: [], reasons: [candidates?.length ? 'similitud visual insuficiente' : 'sin candidatos'] };

  const top = candidates[0].score, near = candidates.filter((c) => c.score >= top - T.window);
  const canon = (c) => adapter.canonNumber(c.meta.number);
  let readNumber = ocr?.number || null, corrected = false; const reasons = [];
  // Corrección de OCR restringida a los números de los candidatos visuales (nunca se inventa uno)
  if (readNumber && !near.some((c) => canon(c) === readNumber)) {
    const fix = constrainToCandidates(readNumber, near.map(canon));
    if (fix) { reasons.push(`número leído «${readNumber}» corregido a «${fix.value}» por coherencia con los candidatos`); readNumber = fix.value; corrected = true; }
  }

  // Nombre base: sin « - 095/167», sin variantes entre paréntesis ((Cosmos Holo), (Dusk Ball)…): son impresiones de la misma carta
  const base = (c) => normalizeName(String(c.meta.name).split(' - ')[0].replace(/\([^)]*\)/g, ' '));
  const ocrName = ocr?.name ? normalizeName(ocr.name) : null;
  const ranked = candidates.filter((c, i) => i < 40 || c.rescued).map((c) => {
    const evidence = []; let bonus = 0;
    if (readNumber) {
      const m = compareCanon(readNumber, canon(c));
      if (m === 'exact' && corrected) { bonus += T.numberPartial; evidence.push('número parecido al leído'); } // un número «corregido» a la fuerza no confirma: pudo ser otra carta cuyo número no está entre los candidatos
      else if (m === 'exact') { bonus += T.numberExact; evidence.push('número impreso coincide'); }
      else if (m === 'partial') { bonus += T.numberPartial; evidence.push('número parcialmente coincide'); }
      else if (m === 'none') { bonus += T.numberMismatch; evidence.push('número impreso distinto'); }
    }
    if (ocr?.setCode) {
      const s = adapter.setMatches(ocr.setCode, c.meta);
      if (s === true) { bonus += T.setMatch; evidence.push('código de expansión coincide'); } else if (s === false) { bonus += T.setMismatch; evidence.push('código de expansión distinto'); }
    }
    if (ocrName) { const sim = nameSimilarity(ocrName, base(c)); if (sim >= T.nameMin) { bonus += T.nameMatch; evidence.push('nombre impreso coincide'); } }
    return { ...c, fused: c.score + bonus, evidence };
  }).sort((a, b) => b.fused - a.fused);

  const [first, second] = ranked, margin = second ? first.fused - second.fused : Infinity;
  const printedHit = first.evidence.includes('número impreso coincide');
  // ¿Otro candidato cercano con el mismo número exacto? Entonces lo impreso no desambigua (p. ej. alt art con el mismo número)
  const rivalSameNumber = printedHit && ranked.slice(1).some((c) => c.evidence.includes('número impreso coincide') && first.score - c.score < 0.05);
  const rivalOtherCard = ranked.slice(1, 8).filter((c) => first.fused - c.fused < T.probableMargin && base(c) !== base(first)).length >= 2; // ≥2 cartas distintas pegadas al primero = ruido
  const nameHit = first.evidence.includes('nombre impreso coincide');
  if (first.score < T.trustScore && rivalOtherCard && !printedHit && !nameHit) // No se afirma nada: se ofrecen los mejores candidatos como «dudosos» y la persona decide (nunca se registran solos)
    return { status: 'dudosa', best: null, alternatives: ranked.slice(0, 6), reasons: ['varias cartas distintas igual de parecidas: no hay una coincidencia clara'] };
  let status;
  if (printedHit && !rivalSameNumber && margin >= T.probableMargin / 2) status = first.rescued ? 'probable' : 'confirmado'; // rescatada solo por el número: la imagen no la respalda
  else if (margin >= T.probableMargin && !rivalSameNumber) status = 'probable';
  else status = 'ambiguo';
  if (status === 'ambiguo') reasons.push(rivalSameNumber ? 'varias impresiones con el mismo número impreso' : 'candidatos demasiado parecidos');
  if (!readNumber) reasons.push('sin lectura de número: solo evidencia visual');
  // Alternativas: TODAS las impresiones del mismo nombre que la mejor (hasta 24), no solo las 5 primeras; si hay pocas, se completa con las más parecidas
  const sameCard = ranked.filter((c) => base(c) === base(first)).slice(0, 24);
  const alternatives = sameCard.length >= 3 ? sameCard : ranked.slice(0, 5);
  return { status, best: first, alternatives, reasons, margin };
};
