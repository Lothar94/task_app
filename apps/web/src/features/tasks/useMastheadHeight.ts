import { useEffect, useState } from 'react';

const DEFAULT_MASTHEAD_PX = 52;

/** Height of the app masthead (it wraps to several rows on narrow screens), so the workspace fits below it. */
export function useMastheadHeight() {
  const [height, setHeight] = useState(DEFAULT_MASTHEAD_PX);
  useEffect(() => {
    const masthead = document.querySelector('body header');
    if (!masthead) return;
    const measure = () => setHeight(Math.ceil(masthead.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(masthead);
    return () => observer.disconnect();
  }, []);
  return height;
}
