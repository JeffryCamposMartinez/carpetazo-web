// Correo de aviso simple con el estilo de Carpetazo (azul y amarillo), hecho con tablas para que se vea igual en Gmail, Outlook y el celular.
import { escapeHtml } from './mail.js';

const SITE = 'https://carpetazo.cl';
const LOGO = `${SITE}/images/email/logo-carpetazo.png`;
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

// steps: lista opcional de { title, text } que se muestra con viñetas numeradas
export const noticeEmailHtml = ({ subject, title, intro, steps = [], cta, ctaUrl, footer }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:480px){.px{padding-left:16px!important;padding-right:16px!important}.h1{font-size:22px!important}}</style></head>
<body style="margin:0;padding:0;background:#dbeafe">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#dbeafe">${escapeHtml(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#dbeafe"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td align="center" bgcolor="#12315f" style="padding:26px 20px 22px;border-bottom:5px solid #facc15"><a href="${SITE}"><img src="${LOGO}" width="92" alt="Carpetazo.cl" style="display:block;width:92px;height:auto;border:0"></a></td></tr>
<tr><td class="px" align="center" style="padding:30px 28px 18px;font-family:${FONT}">
<h1 class="h1" style="margin:0 0 10px;font-size:26px;line-height:1.25;color:#12315f">${escapeHtml(title)}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:#475569">${escapeHtml(intro)}</p></td></tr>
${steps.map((step, index) => `<tr><td class="px" style="padding:10px 28px;font-family:${FONT}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="36" valign="top"><div style="width:28px;height:28px;border-radius:14px;background:#facc15;color:#12315f;font-size:14px;font-weight:800;line-height:28px;text-align:center">${index + 1}</div></td>
<td valign="top"><div style="font-size:15px;font-weight:700;color:#12315f">${escapeHtml(step.title)}</div><div style="margin-top:2px;font-size:14px;line-height:1.5;color:#64748b">${escapeHtml(step.text)}</div></td></tr></table></td></tr>`).join('')}
<tr><td align="center" style="padding:26px 20px 30px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#facc15;color:#12315f;font-family:${FONT};font-size:16px;font-weight:800;text-decoration:none;padding:15px 34px;border-radius:999px">${escapeHtml(cta)}</a></td></tr>
<tr><td class="px" align="center" bgcolor="#f1f5f9" style="padding:20px 28px;font-family:${FONT};font-size:12px;line-height:1.6;color:#64748b">${escapeHtml(footer)} <a href="${SITE}" style="color:#1e40af;text-decoration:none">Carpetazo.cl</a>, el mercado de cartas TCG de Chile.</td></tr>
</table></td></tr></table></body></html>`;
