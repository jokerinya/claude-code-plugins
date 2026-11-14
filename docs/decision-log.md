# Decision log: reviewer-tieto (Junction 2026, Tieto "Earned Trust in AI Code")

Short entries, newest last. Each says what we decided, why, and what we gave up.

| # | Date | Decision | Why | Trade-off |
|---|---|---|---|---|
| 1 | 2026-11-14 | Start from our existing five-lens PR reviewer instead of building from scratch | The lens split and the read-only agents already worked | It inherited a web-stack bias that had to be removed |
| 2 | 2026-11-14 | Output a **Trust Dossier** for a named owner; the AI never says "approved" | The challenge rule: the AI review is advice, never the approval | The process is slower than an auto-merge, on purpose |
| 3 | 2026-11-14 | Confidence = **evidence class** (E1 executed, E2 traced, E3 inferred), not a model score | "Confidence without evidence" is explicitly not accepted | A blocker needs at least E2, so some real bugs arrive as abstentions |
| 4 | 2026-11-14 | Risk routing by **explainable rules** (`policy.json`); the model can raise a tier, never lower it | "A risk score nobody can explain" is not accepted. It also stops the AI talking itself into less review | Rules are coarse. Earned per-area trust is the only way to go lighter |
| 5 | 2026-11-14 | Add an **adversarial verifier** and a mechanical citation check | Vendors: "verify findings before posting". It caught a hallucinated line number on the first run | Extra cost of one Opus pass per review |
| 6 | 2026-11-14 | **Append-only ledger** for sign-offs and outcomes; area trust earned and withdrawn from it | Trust must be earned per area and withdrawn after escapes, and measured on outcomes | It needs history. A new team starts neutral, which is conservative |
| 7 | 2026-11-14 | First real run (#2283) against `master`; the verifier showed the "blocking" Roslyn change came from the base branch | The base-branch choice changes the verdict | Rule added: compare with `origin/HEAD` and flag base mismatches up front |
| 8 | 2026-11-14 | **Split core and repo profile**; removed demo-derived examples from prompts; tagged learned rules with provenance | The lens examples described the demo bugs (#2283, #2129, PolySharp), and a checklist line came from the #2234 title. That primes the answers and makes results untrustworthy | Generic examples teach less. Repo knowledge now lives in a profile the team must maintain |
| 9 | 2026-11-14 | Branches 2234 and 2297 are **holdouts**; 2283 (reviewed) and 2129 (seen) are calibration | Only results on unseen changes show how the reviewer generalises | Fewer samples to tune on |
