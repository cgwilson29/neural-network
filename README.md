# Queue Cartography: a clinic wait-time simulator

An interactive health-data exhibit for CAI5735 (M14 Health Data Exhibit). A small neural network learned how
**staffing, queue length and time of day** shape clinic wait times. Visitors set up a clinic and the network
predicts the wait live in the browser on a 3-D "wait landscape". A WebGPU chatbot answers questions about what
the model learned, using only a written guide.

- **Live exhibit:** https://cgwilson29.github.io/neural-network/
- **Training notebook:** [`training/train_wait_model.ipynb`](training/train_wait_model.ipynb)
- **Website source:** [`web/`](web/)
- **Chatbot test log:** [`docs/chatbot-test-log.md`](docs/chatbot-test-log.md)

![Queue Cartography: the 3-D wait landscape with the simulator controls](docs/screenshot.png)

## The question and the data

*How do staffing and queue size affect wait times?* (the "Clinic Wait-Time Simulator" idea from the
[exercise page](https://snsie.github.io/neural-networks/exercise.html)).

Data: [`clinic-wait-times.csv`](https://snsie.github.io/neural-networks/data/clinic-wait-times.csv) from the course
site, a copy of which is in [`data/`](data/). It holds **2,000 synthetic (simulated) visits**: no real patients or
clinics are described anywhere in this project.

| Column | Range | Role |
|---|---|---|
| `hour` | 8–17 | input |
| `day_of_week` | Mon–Fri | input |
| `staff_on_shift` | 1–5 | input |
| `patients_in_queue` | 0–20 | input |
| `wait_minutes` | 0–324 | **target** |

## Model and evaluation

- **Split:** 70 / 15 / 15 (1,400 train / 300 validation / 300 test), stratified by staff, seed 42. The test set
  was used once, at the end. Hyper-parameters and early stopping used validation only.
- **Network:** PyTorch MLP, raw inputs → one-hot hour (10) + one-hot day (5) + standardized staff & queue = 17
  → 16 → 8 → 1 (ReLU), **433 weights**. Preprocessing is built into the model, so the exported ONNX file takes the
  four raw inputs. The network is *not* given the queue ÷ staff ratio; it has to discover that relationship.
- **Baseline (required):** always predict the training median wait (59.5 min).

| Model (test set, 300 visits) | MAE (min) | 95% CI | R² | Within ±10 min |
|---|---|---|---|---|
| Median baseline | 46.14 | 40.3–52.2 | −0.07 | 23% |
| Linear regression (same 17 features) | 26.11 | 23.7–28.7 | 0.76 | 21% |
| Queue ÷ staff formula (reference) | 5.60 | 5.2–6.0 | 0.99 | 87% |
| **Neural network** | **4.49** | **4.1–4.9** | **0.99** | **92%** |

The network's error is **90% lower than the baseline** (bootstrap 95% CI of the difference: −47.7 to −35.8 min).

**What it learned (the exhibit's discovery):** staffing has diminishing returns. With 12 patients waiting on
Monday at 9 am, the 2nd staff member cuts the predicted wait by ~98 minutes, while the 5th saves ~7. It also
picked up the busier hours (9–10 am and 4–5 pm) and a ~5% Monday bump.

**One mistake:** the largest test error was a Wednesday 1 pm visit (3 staff, 9 queued) that took 35.2 min. The
network said 53.3 min, close to the 6 similar training visits (51.8–69.3 min). The visit was simply faster than
all of them: random variation the four inputs can't explain. More informative inputs (visit type, arrivals,
no-shows), range predictions, or more data for sparse settings would help. Details are in notebook §8 and on the
site.

## The exhibit

| Part | What it does |
|---|---|
| **3-D wait landscape** (three.js / React Three Fiber) | Predicted wait for every staff × queue setting at the chosen hour and day, with glowing equal-wait contours. A beacon marks your clinic, a ghost beacon shows "+1 staff", and the 300 test visits float at their actual waits with stems to the prediction. |
| **Simulator controls** | Day, hour, staff and queue. Every change runs the ONNX model in the browser (ONNX Runtime Web, WASM). |
| **Discovery** | Staffing curve, minutes saved per added staff member, pinned A-vs-B comparison, hour × weekday heatmap. |
| **How good is it?** | Model comparison with confidence intervals, predicted-vs-actual scatter (click a visit to load it), residual strips, training curve, the biggest miss. |
| **Network X-ray** | Live neuron activations for your scenario, read from the ONNX model's hidden-layer outputs. |
| **Guide + guide bot** | The guide is filled from `metrics.json`, so its numbers always match. The chatbot (WebLLM, Qwen3) runs on-device after the visitor clicks **Enable chat**, shows loading progress, and says "The guide doesn't cover that." when the guide has no answer. If WebGPU is unavailable, the rest of the exhibit is unaffected and recorded answers are shown. |

**Chat models:** Standard = Qwen3-1.7B (~1 GB) or Lite = Qwen3-0.6B (~350 MB). The q4f16 build is used when the GPU
supports `shader-f16`, otherwise q4f32. Firefox reports a WebGPU storage-buffer limit of 9 where WebLLM's
pre-check demands 10, so [`web/src/chat/gpuShim.ts`](web/src/chat/gpuShim.ts) reports 10 to WebLLM while
requesting only the real limit from the device. Both Qwen3 models were verified to load and answer in Firefox 160.

## Run it locally

```bash
# Train + export (writes web/public/model/wait_mlp.onnx and web/src/data/*.json)
cd training
uv sync
uv run jupyter nbconvert --to notebook --execute --inplace train_wait_model.ipynb
uv run pytest -q

# Website
cd ../web
npm ci
npm run dev            # http://localhost:5173/neural-network/
npm test               # unit + ONNX parity tests (vitest)
npx playwright install firefox && npm run test:e2e   # end-to-end in Firefox

# Chatbot evaluation harness (opens the real guide/prompt against the test questions; needs WebGPU)
npx vite --config tools/chat-eval/vite.config.ts     # then open http://localhost:5198/
```

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): tests → build → GitHub Pages.

## Tests

- **pytest** (`training/tests`): split integrity, torch vs NumPy encoding, ONNX vs saved grid, artifact checks.
- **vitest** (`web/tests`): ONNX parity in ONNX Runtime (300 test visits, all 5,250 grid inputs, hidden activations
  to 1e-4), interpolation and contour math, guide/metrics consistency and context budget, prompt assembly,
  model selection, Firefox shim.
- **Playwright** (`web/tests/e2e`, Firefox): the model loads in-browser and visitor inputs change predictions;
  chat is gated and the exhibit stays usable without WebGPU; findings render.

## Limitations

Synthetic data only; inputs limited to the trained ranges; no testing on any other dataset or real clinic;
patterns, not causes; not medical or staffing advice. The small chatbot can still make mistakes, so its answers
were checked against the site (see the test log).

## Credits

Data and assignment: CAI5735 course site. Built with PyTorch, ONNX / ONNX Runtime Web, React, three.js, React
Three Fiber + drei, d3, and WebLLM (MLC) running Qwen3.
