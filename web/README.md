# Queue Cartography: website

Vite + React + TypeScript exhibit. See the [project README](../README.md) for the full story.

| Path | What's there |
|---|---|
| `src/three/` | 3-D wait landscape (React Three Fiber): surface, contours, beacons, test visits, label layer |
| `src/components/` | Page sections and hand-built SVG charts (d3 scales) |
| `src/lib/` | ONNX Runtime Web session, predictor with precomputed fallback, interpolation/contour math |
| `src/chat/` | Guide bot: capability probe + `chooseTier`, model catalog, retrieval (BM25 over the guide), prompt, state machine |
| `src/chat/engines/` | One interface, three engines: WebLLM (in `llm.worker.ts`), wllama CPU mode, guide search; post-load sanity check |
| `src/tour/` | Onboarding tour: welcome card, steps (several learn-by-doing), spotlight + popover overlay |
| `src/content/guide.md` | The guide the chatbot reads (numbers filled from `src/data/metrics.json`) |
| `src/data/` | Artifacts written by the training notebook |
| `public/model/wait_mlp.onnx` | The trained network |
| `tests/` | vitest (ONNX parity, math, guide, prompt) and Playwright e2e (Firefox) |
| `tools/chat-eval/` | Harness that runs the site's engines/retrieval/prompt against 12 test questions × 3 seeds; `score.ts` pre-screens answers |

```bash
npm ci && npm run dev    # http://localhost:5173/neural-network/
npm test                 # vitest
npm run test:e2e         # Playwright (Firefox)
```
