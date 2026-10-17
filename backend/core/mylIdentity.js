// Identidad de cartas de Mitos y Leyendas.
// Los ids numéricos de este catálogo pueden coincidir con ids de TCGplayer,
// por eso la identidad que se guarda en publicaciones usa un namespace propio.

export const MYL_TCG = 'Mitos y Leyendas';
export const MYL_ID_PREFIX = 'myl:';

export const isMylTcg = (tcg) => String(tcg || '').trim() === MYL_TCG;

export const rawMylId = (value) => {
  const id = String(value ?? '').trim();
  return id.startsWith(MYL_ID_PREFIX) ? id.slice(MYL_ID_PREFIX.length) : id;
};

export const storedMylId = (value) => {
  const id = String(value ?? '').trim();
  if (!id) return '';
  return id.startsWith(MYL_ID_PREFIX) ? id : `${MYL_ID_PREFIX}${id}`;
};

export const storedCardId = (tcg, value) => (isMylTcg(tcg) ? storedMylId(value) : String(value ?? '').trim());
