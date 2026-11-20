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
