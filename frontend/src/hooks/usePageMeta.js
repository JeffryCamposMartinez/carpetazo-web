import { useEffect } from 'react';

const SITE = 'https://carpetazo.cl';

const setMeta = (selector, create, value) => {
  let element = document.head.querySelector(selector);
  if (!element) { element = create(); document.head.appendChild(element); }
  const previous = element.getAttribute(element.tagName === 'LINK' ? 'href' : 'content');
  element.setAttribute(element.tagName === 'LINK' ? 'href' : 'content', value);
  return previous;
};

// Título, descripción y dirección canónica de la página actual (lo que leen Google y las pestañas); al salir de la página vuelven los de la portada.
// `path` es la dirección oficial, por ejemplo "/carta/<id>"; sin título no hace nada (mientras carga se queda lo anterior).
export default function usePageMeta({ title, description, path, noindex }) {
  useEffect(() => {
    if (!title) return undefined;
    const previousTitle = document.title;
    document.title = title;
    const restore = [];
    if (description) {
      const previous = setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), description);
      restore.push(() => setMeta('meta[name="description"]', () => document.createElement('meta'), previous ?? ''));
    }
    if (path) {
      const previous = setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), `${SITE}${path}`);
      restore.push(() => setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), previous ?? `${SITE}/`));
    }
    if (noindex) {
      const robots = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' });
      document.head.appendChild(robots);
      restore.push(() => robots.remove());
    }
    return () => { document.title = previousTitle; restore.forEach((run) => run()); };
  }, [title, description, path, noindex]);
}
