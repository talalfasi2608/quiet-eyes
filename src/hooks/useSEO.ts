import { useEffect } from 'react';

const DEFAULT_TITLE = 'Quieteyes | מודיעין עסקי ומעקב מתחרים אוטומטי לעסקים קטנים';

export default function useSEO(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', description);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
    return () => { document.title = DEFAULT_TITLE; };
  }, [title, description]);
}
