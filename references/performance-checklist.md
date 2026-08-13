# Performance Checklist

Quick reference for web application performance. Use alongside the `performance-optimization` and `review-code` skills.

## Core Web Vitals Targets

| Metric                          | Good    | Needs Work | Poor    |
| ------------------------------- | ------- | ---------- | ------- |
| LCP (Largest Contentful Paint)  | ≤ 2.5s  | ≤ 4.0s     | > 4.0s  |
| INP (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms    | > 500ms |
| CLS (Cumulative Layout Shift)   | ≤ 0.1   | ≤ 0.25     | > 0.25  |

## TTFB Diagnosis

When TTFB is slow (> 800ms), check DevTools Network waterfall:

- [ ] **DNS resolution** slow → add `<link rel="dns-prefetch">` or `<link rel="preconnect">`
- [ ] **TCP/TLS handshake** slow → enable HTTP/2, check edge deployment, verify keep-alive
- [ ] **Server processing** slow → profile backend, check slow queries, add caching

## Frontend Checklist

### Images

- [ ] Images use modern formats (WebP, AVIF)
- [ ] Images are responsively sized (`srcset` and `sizes`)
- [ ] Images and `<source>` elements have explicit `width` and `height` (prevents CLS)
- [ ] Below-the-fold images use `loading="lazy"` and `decoding="async"`
- [ ] Hero/LCP images use `fetchpriority="high"` and no lazy loading

### JavaScript

- [ ] Bundle size under 200KB gzipped (initial load)
- [ ] Code splitting with dynamic `import()` for routes and heavy features
- [ ] Tree shaking enabled (verify dependency ships ESM and marks `sideEffects: false`)
- [ ] No blocking JavaScript in `<head>` (use `defer` or `async`)
- [ ] `React.memo()` on expensive components that re-render with same props
- [ ] `useMemo()` / `useCallback()` only where profiling shows benefit
- [ ] Long tasks (> 50ms) broken up to keep the main thread available — main lever for INP
- [ ] Third-party scripts loaded with `async` / `defer`, audited for size

### CSS

- [ ] Critical CSS inlined or preloaded
- [ ] No render-blocking CSS for non-critical styles
- [ ] No CSS-in-JS runtime cost in production (use extraction)

### Fonts

- [ ] Limited to 2–3 font families, 2–3 weights each
- [ ] WOFF2 format only (smallest, universal support)
- [ ] Self-hosted when possible (third-party CDNs add round-trips)
- [ ] LCP-critical fonts preloaded: `<link rel="preload" as="font" type="font/woff2" crossorigin>`
- [ ] `font-display: swap` (or `optional` for non-critical) to avoid FOIT
- [ ] System font stack considered before any custom font

### Network

- [ ] Static assets cached with long `max-age` + content hashing
- [ ] API responses cached where appropriate (`Cache-Control`)
- [ ] HTTP/2 or HTTP/3 enabled
- [ ] Resources preconnected for known origins
- [ ] No unnecessary redirects

### Rendering

- [ ] No layout thrashing (forced synchronous layouts)
- [ ] Animations use `transform` and `opacity` (GPU-accelerated)
- [ ] Long lists use virtualization (e.g., `react-window`)
- [ ] No unnecessary full-page re-renders
- [ ] Off-screen sections use `content-visibility: auto`

## Backend Checklist

### Database

- [ ] No N+1 query patterns (use eager loading / joins)
- [ ] Queries have appropriate indexes
- [ ] List endpoints paginated (never `SELECT * FROM table`)
- [ ] Connection pooling configured
- [ ] Slow query logging enabled

### API

- [ ] Response times < 200ms (p95)
- [ ] No synchronous heavy computation in request handlers
- [ ] Bulk operations instead of loops of individual calls
- [ ] Response compression (gzip/brotli)
- [ ] Appropriate caching (in-memory, Redis, CDN)

### Infrastructure

- [ ] CDN for static assets
- [ ] Server located close to users (or edge deployment)
- [ ] Health check endpoint for load balancer

## Performance Budget

```
JavaScript bundle: < 200KB gzipped (initial load)
CSS: < 50KB gzipped
Images: < 200KB per image (above the fold)
Fonts: < 100KB total
API response time: < 200ms (p95)
Time to Interactive: < 3.5s on 4G
Lighthouse Performance score: ≥ 90
```

## Measurement Commands

```bash
# Lighthouse CLI
npx lighthouse https://localhost:3000 --output json --output-path ./report.json

# Bundle analysis (for Vite/Next.js)
npx vite-bundle-visualizer
# or: ANALYZE=true pnpm build

# Web Vitals in code
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

## Common Anti-Patterns

| Anti-Pattern         | Impact                         | Fix                                      |
| -------------------- | ------------------------------ | ---------------------------------------- |
| N+1 queries          | Linear DB load growth          | Use joins, includes, or batch loading    |
| Unbounded queries    | Memory exhaustion, timeouts    | Always paginate, add LIMIT               |
| Missing indexes      | Slow reads as data grows       | Add indexes for filtered/sorted columns  |
| Layout thrashing     | Jank, dropped frames           | Batch DOM reads, then batch writes       |
| Unoptimized images   | Slow LCP, wasted bandwidth     | Use WebP, responsive sizes, lazy load    |
| Large bundles        | Slow Time to Interactive       | Code split, tree shake, audit deps       |
| Blocking main thread | Poor INP, unresponsive UI      | Chunk long tasks, offload to Web Workers |
| Memory leaks         | Growing memory, eventual crash | Clean up listeners, intervals, refs      |
