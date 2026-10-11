import { createRoot } from 'react-dom/client';
import { ReactLenis } from 'lenis/react';
import { LazyMotion, MotionConfig, domAnimation } from 'motion/react';
import 'lenis/dist/lenis.css';
import App from './App.tsx';
import './index.css';

// Lenis honours prefers-reduced-motion by itself (respectReducedMotion defaults to true).
// Anchor links land below the header via scroll-padding-top on <html>, which Lenis reads.
// LazyMotion + domAnimation keeps the motion bundle small: components use `m.*`, never `motion.*`
// (strict mode throws if a full `motion.*` component slips in).
createRoot(document.getElementById('root')!).render(
  <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">
      <ReactLenis root options={{ lerp: 0.08, anchors: true }}>
        <App />
      </ReactLenis>
    </MotionConfig>
  </LazyMotion>
);
