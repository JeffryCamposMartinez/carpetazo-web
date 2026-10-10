// Correo de avisos de la lista de deseos: diseño con el estilo de Carpetazo (azul y amarillo), hecho con tablas para que se vea igual en Gmail, Outlook y el celular.
import { escapeHtml } from './mail.js';
import { isAllowedProxyImageUrl } from './validation.js';

const SITE = 'https://carpetazo.cl';
const LOGO = `${SITE}/images/email/logo-carpetazo.png`;
const clp = (value) => `$${Math.round(Number(value) || 0).toLocaleString('es-CL')}`;
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

const headline = (events) => {
  if (events.length > 1) return { title: `${events.length} novedades en tus cartas deseadas`, sub: 'Mira lo que cambió en tu lista antes de que se agoten.' };
  const [event] = events;
  return event.kind === 'drop'
    ? { title: '¡Bajó el precio de una carta que buscas!', sub: 'Un vendedor la rebajó. Entra a verla antes de que cambie.' }
    : { title: '¡Apareció una carta que buscas!', sub: 'Ya hay un vendedor que la tiene a la venta.' };
};

const row = (event) => {
  const image = event.best.imageUrl && isAllowedProxyImageUrl(event.best.imageUrl) ? event.best.imageUrl : null;
  const drop = event.kind === 'drop';
  const percent = drop ? Math.round((1 - event.best.price / event.previous) * 100) : 0;
  const badge = drop ? `Bajó ${percent}%` : 'Disponible ahora';
  const badgeColor = drop ? '#15803d' : '#1e40af';
  const badgeBg = drop ? '#dcfce7' : '#dbeafe';
  const link = escapeHtml(`${SITE}/carta/${event.best.cardId}`);
  return `<tr><td style="padding:16px 20px;border-top:1px solid #e2e8f0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="84" valign="top" style="padding-right:14px">${image ? `<a href="${link}"><img src="${escapeHtml(image)}" width="84" alt="${escapeHtml(event.item.name)}" style="display:block;width:84px;height:auto;border-radius:8px;border:1px solid #e2e8f0"></a>` : ''}</td>
<td valign="top" style="font-family:${FONT}">
<span style="display:inline-block;background:${badgeBg};color:${badgeColor};font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px">${escapeHtml(badge)}</span>
<div style="margin:8px 0 2px;font-size:17px;line-height:1.3;font-weight:700"><a href="${link}" style="color:#12315f;text-decoration:none">${escapeHtml(event.item.name)}</a></div>
<div style="font-size:13px;color:#64748b">Vende ${escapeHtml(event.best.seller)}</div>
<div style="margin-top:8px;font-size:22px;font-weight:800;color:#12315f">${escapeHtml(clp(event.best.price))}${drop ? ` <span style="font-size:14px;font-weight:600;color:#94a3b8;text-decoration:line-through">${escapeHtml(clp(event.previous))}</span>` : ''}</div>
<div style="margin-top:10px"><a href="${link}" style="color:#1e40af;font-size:14px;font-weight:700;text-decoration:none">Ver carta &rsaquo;</a></div>
</td></tr></table></td></tr>`;
};

export const alertEmailHtml = ({ events, shown, extra, listUrl, unsubscribe, subject }) => {
  const { title, sub } = headline(events);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:480px){.px{padding-left:16px!important;padding-right:16px!important}.h1{font-size:22px!important}}</style></head>
<body style="margin:0;padding:0;background:#dbeafe">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#dbeafe">${escapeHtml(title)} ${escapeHtml(sub)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#dbeafe"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td align="center" bgcolor="#12315f" style="padding:26px 20px 22px;border-bottom:5px solid #facc15"><a href="${SITE}"><img src="${LOGO}" width="92" alt="Carpetazo.cl" style="display:block;width:92px;height:auto;border:0"></a></td></tr>
<tr><td class="px" align="center" style="padding:30px 28px 22px;font-family:${FONT}">
<h1 class="h1" style="margin:0 0 8px;font-size:26px;line-height:1.25;color:#12315f">${escapeHtml(title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.5;color:#475569">${escapeHtml(sub)}</p></td></tr>
${shown.map(row).join('')}
${extra > 0 ? `<tr><td align="center" style="padding:14px 20px;border-top:1px solid #e2e8f0;font-family:${FONT};font-size:14px;color:#475569">y ${extra} más en tu lista</td></tr>` : ''}
<tr><td align="center" style="padding:26px 20px 30px;border-top:1px solid #e2e8f0"><a href="${escapeHtml(listUrl)}" style="display:inline-block;background:#facc15;color:#12315f;font-family:${FONT};font-size:16px;font-weight:800;text-decoration:none;padding:15px 34px;border-radius:999px">Ver mi lista de deseos</a></td></tr>
<tr><td class="px" align="center" bgcolor="#f1f5f9" style="padding:20px 28px;font-family:${FONT};font-size:12px;line-height:1.6;color:#64748b">Recibes este correo porque tienes estas cartas en tu lista de deseos de <a href="${SITE}" style="color:#1e40af;text-decoration:none">Carpetazo.cl</a>, el mercado de cartas TCG de Chile.<br><a href="${escapeHtml(unsubscribe)}" style="color:#64748b">Dejar de recibir estos avisos</a></td></tr>
</table></td></tr></table></body></html>`;
};
