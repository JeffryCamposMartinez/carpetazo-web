import { Fragment, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { termsBlocks, privacyBlocks } from '../legal/content';
import { TERMS_VERSION, PRIVACY_VERSION, LEGAL_UPDATED_LABEL } from '../legal/versions';

const DOCS = {
  terminos: {
    title: 'Términos y Condiciones',
    blocks: termsBlocks,
    version: TERMS_VERSION,
    other: { to: '/privacidad', label: 'Política de Privacidad' }
  },
  privacidad: {
    title: 'Política de Privacidad',
    blocks: privacyBlocks,
    version: PRIVACY_VERSION,
    other: { to: '/terminos', label: 'Términos y Condiciones' }
  }
};

// Texto con **negrita** y [enlaces](url); el resto se muestra tal cual (nunca como HTML)
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-extrabold text-[#12315f]">{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} className="font-bold text-[#1e40af] underline-offset-2 hover:underline">{link[1]}</a>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

// Los textos son de largo fijo y generados desde el documento legal del proyecto (frontend/src/legal/content.js)
export default function LegalPage({ kind }) {
  const doc = DOCS[kind] || DOCS.terminos;
  const sections = doc.blocks.filter((block) => block.t === 'h2');

  useEffect(() => {
    const previous = document.title;
    document.title = `${doc.title} · Carpetazo`;
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, [doc.title]);

  return (
    <div className="mx-auto w-full max-w-[920px] px-3 py-3 sm:px-6 sm:py-6">
      <article className="rounded-[1.6rem] border border-white/70 bg-white/95 p-5 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem] md:p-10">
        <header className="mb-6 border-b border-slate-200 pb-5">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-[#12315f] md:text-4xl">{doc.title}</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Versión {doc.version} · Vigente desde el {LEGAL_UPDATED_LABEL}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Lee también la <Link to={doc.other.to} className="font-bold text-[#1e40af] underline-offset-2 hover:underline">{doc.other.label}</Link>.
            Si tienes dudas, escríbenos a <a href="mailto:carpetazo.soporte@gmail.com" className="font-bold text-[#1e40af] underline-offset-2 hover:underline">carpetazo.soporte@gmail.com</a>.
          </p>
        </header>

        {sections.length > 3 && (
          <nav aria-label="Contenido" className="mb-8 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="mb-2 text-sm font-extrabold text-[#12315f]">Contenido</p>
            <ol className="columns-1 gap-6 text-sm sm:columns-2">
              {sections.map((section) => (
                <li key={section.id} className="mb-1 break-inside-avoid">
                  <a href={`#${section.id}`} className="text-slate-600 hover:text-[#1e40af] hover:underline">{section.x.replace(/^\d+\.\s*/, '')}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="space-y-4 text-[15px] leading-relaxed text-slate-700">
          {doc.blocks.map((block, index) => {
            if (block.t === 'h2') {
              return <h2 key={index} id={block.id} className="scroll-mt-24 pt-6 text-xl font-extrabold leading-snug text-[#12315f]">{block.x}</h2>;
            }
            if (block.t === 'ul') {
              return (
                <ul key={index} className="list-disc space-y-1.5 pl-6">
                  {block.items.map((item, i) => <li key={i}><Inline text={item} /></li>)}
                </ul>
              );
            }
            if (block.t === 'table') {
              return (
                <div key={index} className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#12315f] text-left text-white">
                        {block.head.map((cell, i) => <th key={i} className="px-3 py-2 font-bold"><Inline text={cell} /></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, r) => (
                        <tr key={r} className="border-t border-slate-200 align-top odd:bg-white even:bg-slate-50">
                          {row.map((cell, i) => <td key={i} className="px-3 py-2"><Inline text={cell} /></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            return <p key={index}><Inline text={block.x} /></p>;
          })}
        </div>
      </article>
    </div>
  );
}
