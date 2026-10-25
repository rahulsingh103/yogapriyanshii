import { useEffect, useRef, useState } from 'react';

/**
 * True while the element scrolls sideways (its content is wider than its box). Used to make a native
 * snap track a keyboard tab stop only while there is something to scroll.
 */
export function useOverflowsX<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, overflows] as const;
}
