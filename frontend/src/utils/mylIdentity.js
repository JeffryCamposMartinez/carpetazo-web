// Los ids del catálogo de Mitos se guardan con namespace para que nunca
// colisionen con los ids numéricos de TCGplayer.
export const MYL_TCG = 'Mitos y Leyendas';
export const MYL_ID_PREFIX = 'myl:';

export const isMylTcg = (tcg) => String(tcg || '').trim() === MYL_TCG;

export const rawMylId = (value) => {
  const id = String(value ?? '').trim();
  return id.startsWith(MYL_ID_PREFIX) ? id.slice(MYL_ID_PREFIX.length) : id;
};

export const storedCardId = (tcg, value) => {
  const id = String(value ?? '').trim();
  if (!isMylTcg(tcg) || !id || id.startsWith(MYL_ID_PREFIX)) return id;
  return `${MYL_ID_PREFIX}${id}`;
};
