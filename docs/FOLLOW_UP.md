# Follow-up tasks

Tasks that need human/cousin input (e.g. cousin scoring and marking posts) or are intentionally deferred. Do these after launch or once we have enough labeled data.

- [ ] **Structured scoring log and feedback loop** — Persist post id, prompt hash, model output summary, final_score, used_on_episode; use for tuning prompts/weights. *Requires cousin to save and mark-used posts first so we have data.*
- [ ] **Human calibration** — Use saved + used_on_episode as labels to compare system scores vs human behavior and tune prompts/weights; optional hand-labeled set (50–200 posts). *Requires cousin to save and mark-used posts first.*
- [ ] **Cousin workflow / in-app doc note** — Short note: "Save posts you're considering; after the episode, mark the ones you used." *Cousin needs to use Save and Mark as used consistently so we get signals for the above.*
- [ ] **Few-shot examples in scoring prompt** — Add 1–2 few-shot examples (short post → full JSON) to improve consistency; optional for token cost. *Best examples come from cousin’s labeled data (saved / used_on_episode).*
- [ ] **Two-pass scoring** — Pass 1: cheap keep/drop; Pass 2: full LLM scoring on survivors. Do as a follow-up so we don’t drop posts that would have scored well in full scoring.
- [ ] **Optional: negative dimension weights** — Support penalization dimensions; define how final_score is bounded (e.g. clamp after weighted sum) and document in UI.
- [ ] **Optional: dedicated backfill job for new dimension** — If we want “backfill only missing dimension X,” would need a prompt that returns only that dimension and an update path that merges into existing `llm_scores.scores`. See docs/IMPROVEMENTS_BACKFILL_EMBEDDER_STORAGE.md.
