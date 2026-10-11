import { createRoot } from 'react-dom/client';
import { ReactLenis } from 'lenis/react';
import { MotionConfig } from 'motion/react';
import 'lenis/dist/lenis.css';
import App from './App.tsx';
import './index.css';

// Lenis honours prefers-reduced-motion by itself (respectReducedMotion defaults to true).
// Anchor links land below the header via scroll-padding-top on <html>, which Lenis reads.
createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">
    <ReactLenis root options={{ lerp: 0.08, anchors: true }}>
      <App />
    </ReactLenis>
  </MotionConfig>
);
