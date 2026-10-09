// NOTE: no JSX in this file on purpose, so it works as plain .js in Vite.
import { createElement as h, Fragment, useEffect, useRef, useState } from 'react';

export function useTilt(max = 10) {
  const ref = useRef(null);
  return {
    ref,
    onMouseMove: (e) => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `rotateX(${-y * max}deg) rotateY(${x * max}deg) translateZ(8px)`;
    },
    onMouseLeave: () => { if (ref.current) ref.current.style.transform = ''; },
  };
}

export function Count({ to, pre = '', suf = '', dec = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let s, raf;
    const f = (t) => { s = s || t; const p = Math.min((t - s) / 1000, 1); setV(to * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return h(Fragment, null, pre + v.toFixed(dec) + suf);
}

export const Cube = ({ faces = ['AP', 'AI', 'PO', 'GRN', 'TAX', 'PAY'] }) =>
  h('div', { className: 'cube-wrap' }, h('div', { className: 'cube' }, faces.map((f) => h('div', { key: f }, f))));
