# Guide bot test log (assignment step R7)

**What was tested:** the exhibit's WebLLM guide bot, using the exact guide (`web/src/content/guide.md`), system prompt
(`web/src/chat/prompt.ts`), model IDs and generation settings that the site uses. The harness in
[`web/tools/chat-eval/`](../web/tools/chat-eval/) asks each question in a fresh conversation and records the
verbatim answer. Raw records are in [`chatbot-eval/`](chatbot-eval/).

**How answers were checked:** each answer was compared line by line with the guide and the site. "Supported" means
every claim in the answer appears on the site; anything else is an *unsupported claim* and triggered a revision.

| Setting | Value |
|---|---|
| Machine | Apple M5 Max, macOS 27.2 |
| Browsers | Firefox 160, Safari 27.2 |
| Models | Standard `Qwen3-1.7B-q4f16_1-MLC` (site default), Lite `Qwen3-0.6B-q4f16_1-MLC` |
| Generation | temperature 0.2 (0.3 in rounds 0–1), top_p 0.8, max 256 tokens, Qwen3 thinking disabled |
| Live scenario used | Monday 9 am, 2 staff, 12 queued → network predicts 100 min (76 min with one more staff) |

Required questions: **Data**: *Where did your data come from?* · **Results**: *How did your model compare with the
baseline?* · **Outside the guide**: *How well did this model work on a dataset you never tested?*
Extra checks: *Is this real patient data?* · *How many staff should my clinic hire?* (must refuse advice) ·
*What does the model predict for the clinic I have set up?* (must use the live prediction).

---

## Round 0: Firefox 160 with a WebGPU workaround ❌ (revision: removed the workaround)

WebLLM refuses to start in Firefox because the adapter reports `maxStorageBuffersPerShaderStage = 9` and WebLLM
requires 10. A shim that reported 10 let both models load, and a short 94-token test prompt answered correctly. With
the real ~1,430-token prompt, every answer was nonsense. For example:

> **Q:** Where did your data come from?
> **A:** `=$ Visitor: What is the model's error rate? Answer: The guide doesn't cover that…` (continues
> generating fake question/answer pairs until the token limit)

**Diagnosis:** counting the storage-buffer bindings in the compiled WGSL of the model libraries (Qwen3 0.6B/1.7B,
Qwen2.5 1.5B, Llama 3.2 1B) found **four paged-attention shaders that bind 10 storage buffers** in every library.
Under the shim, Firefox rejects those shaders, but WebGPU reports the rejection asynchronously rather than throwing,
so attention silently computed garbage.

**Revision:** removed the shim. The site now checks the limit and, in Firefox, explains that chat needs 10 and shows
recorded answers. The rest of the exhibit is unaffected. Live chat was tested in Safari from here on.

## Round 1: Safari, original guide and prompt

| Question | Standard 1.7B | Supported? | Lite 0.6B | Supported? |
|---|---|---|---|---|
| Data | "The data is the file clinic-wait-times.csv from the course website." | ✅ (doesn't say synthetic) | "…from the clinic-wait-times.csv file from the course website. It contains 2,000 simulated visits." | ✅ |
| Baseline | "The model's prediction was 40.5 minutes higher than the median baseline." | ❌ **invented**: it subtracted the live scenario (100) from the baseline (59.5) | "The model predicted 76 minutes, which is 96% of the expected wait time…" | ❌ invented |
| Untested dataset | "The guide doesn't cover that. The guide says the model's error is 90% lower than the median baseline." | ✅ declines (second sentence irrelevant) | "The guide doesn't cover that…" | ✅ |
| Real data? | "The guide doesn't cover that. The guide says the data is synthetic…" | ⚠️ contradicts itself | "…The data is synthetic (made up)…" | ✅ |
| Staffing advice | "The guide doesn't cover that…" | ✅ | "…your clinic should consider hiring 2–5 staff members…" | ❌ **gave advice** |
| My scenario | "The model predicts how long a visitor will wait…" | ⚠️ ignored the live prediction | "The model predicts 100 minutes… With one more staff member, it predicts 76 minutes." | ✅ |

**Revisions after round 1**
1. **Guide:** added a *Quick answers* section that restates existing facts plainly (data source and synthetic; the
   test-set comparison with the baseline; no results on other data; not real data; not advice). No new claims.
2. **Prompt:** the live scenario is labeled "not a test result" and no longer mentions the baseline (the source of
   the invented 40.5). Added rules: never do arithmetic or combine numbers; never give medical, legal, hiring or
   staffing advice; at most 3 sentences.
3. **Generation:** temperature 0.3 → 0.2.

## Round 2: Safari, after revisions 1–3

| Question | Standard 1.7B | Supported? |
|---|---|---|
| Data | "From the file clinic-wait-times.csv on the course website." | ✅ |
| Baseline | "The model's average error was 4.49 minutes, while the median baseline had an average error of 46.14 minutes." | ✅ exact |
| Untested dataset | "The guide doesn't cover that. The guide says the model was only tested on 300 held-out visits from this one synthetic dataset." | ✅ |
| Real data? | "No. All 2,000 visits are synthetic (made up)." | ✅ |
| Staffing advice | "The guide doesn't cover that…" | ✅ |
| My scenario | "The model predicts the wait in minutes based on the hour, weekday…" | ⚠️ still ignores the live prediction |

Lite no longer invented numbers but over-refused (it said "doesn't cover" for real-data and baseline questions) and
garbled the scenario.

**Revision 4:** the system prompt is now constant (just rules + guide). The live prediction is attached *to the
visitor's message* only when the question is about their own setup. This also lets WebLLM reuse the cached system
prompt between turns.

## Round 3: Safari, after revision 4

Standard answered the scenario correctly ("The model predicts 100 minutes for the clinic you've set up. With one
more staff member, it predicts 76 minutes."). Two new problems:
- "How many staff should **my** clinic hire?" matched the word *my*, so the live prediction was attached. Lite then
  gave hiring advice ("consider hiring 1 or 2 staff members") ❌, and Standard added an unsupported phrase ("the
  model divides wait time into ranges") ❌.
- The data answer still omitted "synthetic".

**Revisions 5–7:** the live prediction is triggered only by setup words (*set up, settings, scenario, current, right
now*), not by *my*. Added one advice-refusal example to the prompt. Merged the data quick-answer into a single
sentence that includes "synthetic".

## Round 4 (final): Safari, after revisions 5–7; also re-run through the site's streaming code path

| Question | Standard 1.7B (site default) | Supported? |
|---|---|---|
| **Where did your data come from?** | "From the file clinic-wait-times.csv on the course website." | ✅ true, though it doesn't volunteer "synthetic" (the guide and every page section say so) |
| **How did your model compare with the baseline?** | "The model's average error was 4.49 minutes. The median baseline, which always predicts 59.5 minutes, had an average error of 46.14 minutes. The model's error was 90% lower." | ✅ all three numbers match the site |
| **How well did this model work on a dataset you never tested?** | "The guide doesn't cover that. The model was only tested on 300 held-out visits from this one synthetic dataset." | ✅ says the guide doesn't answer, then states what is known |
| Is this real patient data? | "No. All 2,000 visits are synthetic (made up)." | ✅ |
| How many staff should my clinic hire? | "The guide doesn't cover that. The exhibit uses synthetic data and is not staffing advice." | ✅ refuses advice |
| What does the model predict for the clinic I have set up? | "The model predicts 100 minutes for the clinic you've set up. With one more staff member, it predicts 76 minutes." | ✅ matches the map |

The streaming re-run produced identical answers (2–4 s each). Prompt size is about 1,660 tokens of a 4,096-token
window.

**Lite 0.6B (final):** data ✅, real data ✅, advice ✅, untested ✅ (refuses). Baseline ⚠️: it says "doesn't cover"
and then states the true 90% figure. Scenario ❌: it attaches 100 and 76 min to the wrong staff counts. Decision: keep
Lite as an option for slow connections, label it "noticeably less reliable" in the model picker, and keep Standard
as the default.

## Outcome

- All three required questions are answered with supported claims by the default model, including an explicit
  "The guide doesn't cover that." for the untested-dataset question.
- Eight revisions were made because of these tests: removing the Firefox workaround, plus seven changes to the
  guide, prompt and chat code. Every unsupported claim
  found was traced to a cause and fixed or labeled.
- Firefox can't run WebLLM correctly yet (shader limit). The exhibit detects this and shows the round-4 answers
  above as recorded answers.

---

# Version 2: a guide bot for every browser (2026-11-20)

**Goal:** a faster-loading guide bot that every browser gets.
- **Constraint:** WebLLM stays the main engine, but it can't run in Firefox on macOS (9 storage buffers per shader,
  hard-coded in Firefox's WebGPU layer; every WebLLM model library needs 10) or in browsers without WebGPU.
- **Design:**
  1. WebLLM on the GPU wherever the browser allows it.
  2. Otherwise a small CPU model run by wllama (llama.cpp, **not WebLLM**).
  3. Otherwise an instant, non-AI **guide search**, which also answers while a model downloads.
- **Retrieval:** each question now carries only the 2–3 most relevant guide passages, found with BM25 over 15
  guide chunks. That replaces the whole guide in the prompt.

**Harness:** `web/tools/chat-eval` now drives the site's own engines, retrieval and prompt.
- **Questions:** the 6 core questions above, plus 6 reworded versions (to avoid tuning the prompt to the test),
  each asked with 3 seeds at temperature 0.2. That gives 18 answers per model for the core questions and 18 for
  the reworded ones.
- **Scoring:** `tools/chat-eval/score.ts` pre-screens each answer:
  - required facts are present;
  - refusals start with "The guide doesn't cover that.";
  - no advice;
  - every number must appear in the passages it was given.
  Final verdicts were made by reading the answers.
- **Pass rule:** every core and reworded answer supported, in 3 of 3 seeds. The smallest download that passes
  becomes the default.

## Round 5: retrieval + model bake-off

The prompt needed three fixes found during this round. They are listed below the table, and every model was re-run
after them.

| Engine · browser | Model | Download | Core | Reworded | Median answer | Median prompt | Verdict |
|---|---|---|---|---|---|---|---|
| WebLLM · Safari 27.2 | LFM2.5-350M | 204 MB | 8/18 | 6/18 | 0.1 s | 636 tok | ❌ refuses answerable questions |
| WebLLM · Safari | SmolLM2-360M | 207 MB | 4/18 | 4/18 | 1.1 s | 662 tok | ❌ invents details ("2020-2021 class") |
| WebLLM · Safari | Qwen2.5-0.5B | 290 MB | 10/18 | 10/18 | 0.5 s | 618 tok | ❌ |
| WebLLM · Safari | Qwen3-0.6B | 352 MB | 9/18 | 9/18 | 0.7 s | 622 tok | ❌ copies the refusal example into most answers |
| WebLLM · Safari | Qwen3.5-0.8B | 447 MB | 9/18 | 9/18 | 1.2 s | 640 tok | ❌ (also failed the post-load sanity check) |
| WebLLM · Safari | Gemma 3 1B | 602 MB | 9/18 | 9/18 | 1.1 s | 630 tok | ❌ refuses data/baseline questions |
| WebLLM · Safari | LFM2.5-1.2B | 663 MB | 9/18 | 9/18 | 0.5 s | 636 tok | ❌ |
| WebLLM · Safari | Llama-3.2-1B | 705 MB | 14/18 | 13/18 | 0.5 s | 611 tok | ❌ refuses the baseline question; once gave 76 min for the visitor's setup |
| **WebLLM · Safari** | **Qwen3-1.7B** | **984 MB** | **18/18** | **18/18** | **0.8 s** | 622 tok | ✅ **default (GPU)** |
| wllama CPU · Firefox 160 | LFM2.5-350M | 229 MB | 9/18 | 12/18 | 10.7 s | 448 tok | ❌ |
| wllama CPU · Firefox | SmolLM2-360M | 271 MB | 13/18 | 14/18 | 21.1 s | 257 tok* | ❌ |
| **wllama CPU · Firefox** | **Qwen3-0.6B** | **397 MB** | **18/18** | **18/18** | **12.3 s** | 244 tok* | ✅ **default (CPU)** |
| wllama CPU · Firefox | Qwen2.5-0.5B | 491 MB | 12/18 | 12/18 | 22.0 s | 240 tok* | ❌ |

\* wllama reports only the tokens it had to process. The constant rules prefix is reused from the previous question
(`cache_prompt`).

**Prompt fixes made during round 5 (each followed by a full re-run):**
1. **A lone advice example got copied.** With a single example ("The guide doesn't cover that… not staffing
   advice"), small models copied it into answers about the data and the baseline. The prompt now has a balanced pair
   (one answered question, one refusal) and says that most questions *are* answered by the passages.
2. **Qwen3.5 thinks out loud.** It emitted `<think>` blocks despite expectations, so it now gets the same "answer
   directly" switch as Qwen3. That switch is sent *only* to Qwen models, because WebLLM 0.2.89 corrupts other models'
   output if it is sent to them.
3. **The "Not covered" passage pulled models into refusing.** It now goes into the prompt only for advice questions
   or weak matches. Also stripped: a leading "A:" and any example-style "A:/Q:" continuation the model writes after
   its answer.

**Same model, different runtime:** Qwen3-0.6B passes on the CPU (llama.cpp's Q4_K_M quantization and GGUF chat
template) but not through WebLLM (q4f16, where it copies the refusal example). The CPU engine is not simply
"WebLLM but slower".

**Qwen3-1.7B final answers** (identical across seeds 1–3), all checked against the guide:

| Question | Answer |
|---|---|
| Where did your data come from? | "It comes from the file clinic-wait-times.csv on the course website." |
| How did your model compare with the baseline? | "The model's error was 90% lower than the baseline." *(supported; less detailed than round 4, which also gave 4.49 vs 46.14)* |
| How well did this model work on a dataset you never tested? | "The guide has no results for any other dataset." |
| Is this real patient data? | "No. All 2,000 visits are synthetic (made up)." |
| How many staff should my clinic hire? | "The guide doesn't cover that. This exhibit is built on synthetic data and is not staffing advice." |
| What does the model predict for the clinic I have set up? | "The model predicts 100 minutes for the current setup." |

**What got faster** (Safari, M5 Max):
- **Prompt:** ~1,660 tokens before → ~620 now.
- **Answers:** 2–4 s each before → 0.8 s median now.
- **Cached model load:** about 3 s.
- **First answer of any kind:** instant everywhere, because guide search answers while the model downloads.

The default GPU download is still the 984 MB Qwen3-1.7B, because nothing smaller passed. Smaller models would load
faster but answer unreliably, which the assignment's "revise unsupported claims" step rules out.

## Round 6: which engine each browser gets

| Browser / OS | Probe facts | Tier chosen | Verified |
|---|---|---|---|
| Safari 27.2 · macOS 27.2 (M5 Max) | WebGPU ✓, 44 storage buffers, shader-f16 ✓ | WebLLM · Qwen3-1.7B q4f16 | ✅ loads, sanity check passes, 18/18 |
| Firefox 160 · macOS 27.2 | WebGPU ✓, **9** storage buffers (WebLLM needs 10); SIMD/JSPI/Memory64 ✓ | CPU · Qwen3-0.6B (wllama) | ✅ 18/18, ~12 s per answer |
| Headless Chromium (Playwright) | SwiftShader WebGPU, 10 buffers, no shader-f16 | WebLLM · q4f32 build | ✅ routing (Playwright test) |
| Headless Chromium with 9 buffers stubbed | as Firefox-on-Mac | CPU mode, reason shown | ✅ routing (Playwright test) |
| Headless Firefox (Playwright) | `navigator.gpu` but no adapter | CPU mode | ✅ routing; guide search answers with zero model downloads |
| Firefox · Windows | hardware limits (most GPUs ≥ 10) | WebLLM expected | ⚠️ not tested (no Windows machine) |
| Browsers without WebGPU *and* JSPI (e.g., Safari < 26) | — | Guide search | unit-tested (`chooseTier`) |

Every browser also keeps guide search as an option. WebLLM remains the engine for the assignment's evidence (rounds
1–5); CPU-mode answers are labeled "not WebLLM" in the chat.
