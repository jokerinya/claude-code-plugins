---
name: trust-review
description: Run the full earned-trust review on the current branch and produce a Trust Dossier for a named human owner. It runs risk triage, six lenses in parallel (intent, correctness, security, compatibility, documentation, verifiability), an adversarial verifier, then shows what the AI found, what it refused to decide, what it did not check, and how deeply the owner must read. Never approves.
disable-model-invocation: true
argument-hint: "<requirement-id> [base-branch] [--owner \"Name\"] [requirement text or path to a requirement file]"
---

# Trust review

Arguments: $ARGUMENTS

**The AI's output is advice with evidence. The approval is a named human's signature.** Never print "approved", "LGTM" or "safe to merge".

**Run every shell command as one simple command with absolute paths.** Never chain with `&&`, `;` or `|` and never `cd` first: permission allow-lists (headless or in CI) match only simple commands.

## 0. Parse the arguments

- **Requirement id** (required): for example `#1234`, `REQ-12` or `TIETO-FR-3`. If it is missing, ask for it and stop: a change with no requirement cannot be traced.
- **Base:** the next argument, if it names a branch that exists. Otherwise use the default from the `evidence-protocol` skill (`origin/HEAD`). Show the base you chose, because it changes the diff. **If the requested base and `origin/HEAD` give different merge bases**, list the commits that differ (`git log --oneline <mb-default>..<mb-requested>` and the reverse), pass them to every lens as "base-branch commits, not this change's own work", and add a base-branch question for the owner as the first abstention. (Lesson log: a bot commit already on the default branch was once mistaken for part of the change and flagged as blocking.)
- **Owner:** `--owner "Name"`. If it is missing, use `git config user.name` and mark it "(assumed: confirm at sign-off)".
- **Requirement text:** the rest. If it is a file path, read it. If it is a GitHub issue, fetch it in step 1 with `fetch_requirement.py` (never by reading the issue freehand).

## 1. Find the change, the repo profile, and triage

0. **Repo profile:** run `python3 <this skill's base directory>/scripts/resolve_profile.py --repo <repo>`. It returns the profile directory (the team's own `.trust-review/profile/`, or a bundled one from the plugin's `profiles/`), or none. Show which one applies. Without a profile the review runs on generic rules only, and the dossier says so in "What was not checked".

1. Work out the merge base (see `evidence-protocol`). Run `git diff --stat <merge-base>` and `git status --porcelain`. If there is nothing to review, say so and stop.
2. Set `REVIEW_ID=<req-id without #>-<short HEAD sha>` and `OUT=<repo>/.trust-review/reviews/$REVIEW_ID`. Create `OUT`. Check `.trust-review/` is git-ignored or meant to be committed, and ask the user once if unclear. The ledger is meant to be committed: the team's track record.
2b. **Requirement with provenance.** For a GitHub issue run `python3 <this skill's base directory>/scripts/fetch_requirement.py --issue <n> --repo <repo> --out-dir $OUT` (add `--repo-slug owner/name` when the issue lives upstream). It writes `requirement.md` with **BINDING** parts (issue body, comments by OWNER/MEMBER/COLLABORATOR) and **NON-BINDING** parts (everyone else), plus `requirement.json`. For pasted text or a file, copy it to `$OUT/requirement.md` as one binding part.
2c. **Criteria, once, for every lens.** Write `$OUT/criteria.json` as `{"criteria": [{"id": "R1", "text": "...", "source": "issue-body|maintainer|other|derived", "binding": true|false|"derived"}]}`:
   - criteria from BINDING parts get `binding: true`;
   - proposals from NON-BINDING parts may be listed, always with `binding: false` (they can raise questions, never block);
   - implicit criteria such as "existing behaviour outside the change stays the same" get `binding: "derived"`;
   - **if `requirement.json` has `regression: true` or reported versions**, add `R0`: "The reported scenario reproduces on the reported version (<versions>) before the change and is fixed there after it", `binding: true`. If the merge base does not contain the reported version, R0 is checked on that version (the verifier runs it there when the profile allows execution).
   Every lens and the verifier use these ids. A lens may add derived criteria (`binding: "derived"`), never binding ones.
3. Area trust: if `<repo>/.trust-review/ledger.jsonl` exists, run `python3 <sign-off base dir>/scripts/trust_ledger.py --repo <repo> area-trust [--policy <profile dir>/policy.json] > <repo>/.trust-review/area-trust.json`.
4. Run `risk-triage` (`risk_triage.py --repo <repo> --base <merge-base> [--profile <profile dir>] [--area-trust ...]`) and save its output to `$OUT/triage.json`.

## 2. Run six lenses in parallel (one message)

Start these agents from the reviewer-tieto plugin (they may be listed as `reviewer-tieto:<name>`):
`intent-reviewer`, `correctness-reviewer`, `security-reviewer`, `compatibility-reviewer`, `documentation-reviewer`, `verifiability-reviewer`.

Give each the same prompt: repo path, base, merge base, review id, **the paths of `$OUT/requirement.md` and `$OUT/criteria.json`**, **the profile directory (or "no profile")**, any **base-branch commits** from step 0, and a compact triage digest (overall tier, review units, high-risk files with rule ids, notes). Do not pass a model or effort level: the agent definitions set them.

If the change has more than 3 review units, tell the lenses to cover units in tier order, T2 first, and to list any unit they did not get to under `not_checked`.

## 3. Validate, then verify

1. Write each lens's JSON block **verbatim** to `$OUT/lenses/<lens>.json`. Never summarise or reformat lens output: the validator and the citation check need it as returned.
2. Run `python3 <evidence-protocol base dir>/scripts/validate_lens_output.py $OUT/lenses/<each>.json --criteria $OUT/criteria.json --write` and save its report as `$OUT/validation.json`. It fixes wrong verdicts, turns blocking-on-E3 into abstentions and **blocking-on-non-binding criteria into notes plus api-owner questions**. Every violation goes into the dossier appendix.
3. Run `python3 <evidence-protocol base dir>/scripts/check_citations.py` on the merged list and save `$OUT/citation-check.json`.
4. Start `finding-verifier` with the validated lens files, `citation-check.json`, `criteria.json`, the repo, the merge base, the review id and the profile directory. Wait for it, and save its JSON verbatim to `$OUT/lenses/verifier.json`.

A lens that fails, or returns no JSON, counts as **not run**. Its topic goes into "What was not checked". For a blocking lens, the recommendation is at least T2 for every unit.

## 4. Decide the routing (rules, not judgment)

Start from the triage tiers per review unit, then:

- a **binding** criterion (`binding: true`, including R0) whose final status is `missing` or `not met`, confirmed by the verifier → overall outcome `NOT-FIX`: the change does not do what the requirement asks (also when the evidence is an executed abstention such as "the patch does not fix the reported version");
- a **confirmed blocking** finding in a unit → that unit is `BLOCK` (after validation, blocking findings only rest on binding or derived criteria, or on defects);
- an `unsettled` finding, any abstention citing the unit, or a `weakened`/`refuted` supporting claim → at least `T1`;
- a refuted deletion proof for a criterion → at least `T1` for the units implementing it;
- a security abstention → `T2`, with `security-champion` co-sign.

The overall recommendation is the highest unit tier:
`NOT-FIX` → "Does not meet <req-id>: send back or retarget" · `BLOCK` → "Do not merge yet" · `T2` → "Owner full read of listed units" · `T1` → "Owner focused read of listed hunks" · `T0` → "Ready for owner evidence check".

Findings `refuted` by the verifier are dropped from the main sections and listed in an appendix ("AI findings rejected by the verifier"), because they measure lens noise.

## 5. Write the dossier

Write `$OUT/dossier.md` in exactly this order, with short sections and `path:line` everywhere:

```
# Trust Dossier · <REQ-ID> · <branch> @ <short sha>
Owner: <Name> · Status: UNSIGNED · Recommendation: <one line> · Est. owner time: <min>

## 1. The change in its own words
<the intent lens's story, one row per unit: what · why (R#) · touches · evidence class>

## 2. Requirement trace
| R# | Criterion | Code | Test | Status | Evidence | Verifier |

## 3. What the AI found
<confirmed findings first (blocking, then notes), each: id, lens, title, path:line, trigger → impact, fix, evidence class>

## 4. What the AI refused to decide, and why
| Id | Question | Why the AI did not decide | Evidence that would settle it | Decider |

## 5. What was not checked, and why
<union of all not_checked, plus lenses that did not run, plus "not executed" reasons>

## 6. Where the owner should look
| Unit | Area | Files | Lines | Tier | Why (rule ids) | Read these hunks |

## 7. Residual risk the owner would accept by signing
<plain sentences built from sections 4–5 and the T1/T2 units the owner chooses not to read fully>

## 8. Sign-off
Run: /reviewer-tieto:sign-off <REVIEW_ID> ...

## Appendix: verifier rejections and executed commands
```

Also write `$OUT/dossier.json` with `review_id`, `requirement`, **`outcome`** (one of `T0`, `T1`, `T2`, `BLOCK`, `NOT-FIX`), `profile` (id and plugin version or commit), `base`, `merge_base`, `head`, `owner`, `recommendation`, `units` (with tiers), and the merged findings, supporting claims and abstentions (each with verifier status and evidence class). Save the raw lens and verifier JSON in `$OUT/lenses.json`.

The appendix lists every validator violation from `$OUT/validation.json` (count per lens): contract drift is measured, not hidden.

Record the review in the ledger:
`python3 <sign-off base dir>/scripts/trust_ledger.py --repo <repo> record-review $OUT/dossier.json`

## 5b. Write the PR comment

`dossier.md` is the full record. Reviewers read the PR, so also write `$OUT/pr-comment.md`: GitHub-flavoured markdown that a named owner can act on from the **first screen**, with everything else folded. Build it only from `dossier.json`, `citation-check.json`, `lenses/verifier.json`, `area-trust.json` and `trust_ledger.py metrics --json`: no new claims.

Rules:
- **First screen = the card.** Header, recommendation, the most important refused decision, the "checked by" table, not checked, read these hunks, you accept, sign-off. Everything else goes inside `<details>`.
- **Use these headings, in the challenge's words:** "What the AI found", "What the AI refused to decide, and why", "What was checked, and by whom or what", "What was not checked, and why", "Residual risk you accept by signing".
- **No score, gauge or percentage confidence.** Confidence is shown only as an evidence class tag on each row (`E1 executed`, `E2 traced`, `E3 inferred`) and as counts anyone can check.
- **Alerts:** `> [!CAUTION]` for an outcome of `NOT-FIX` or `BLOCK`, or for an abstention backed by E1 evidence against a binding criterion; `> [!IMPORTANT]` for the other abstentions shown on the card (at most 2); `> [!NOTE]` for residual risk.
- **Hunks are links** when the repo slug and head sha are known: `[TypeCollector.cs:1008](https://github.com/<slug>/blob/<sha>/<path>#L1008)`.
- **Area trust comes from the ledger only.** With no signed history, write `neutral (no signed history)`. Never invent a track record; mark seeded history `synthetic`.
- Leave out the parts written for evaluators (holdout scorecards, lessons logs): they belong in `docs/`.
- Stay under 60,000 characters (GitHub's comment limit is 65,536). If longer, cut the folded sections and link to `dossier.md`.

Template:

```
### 🔍 Trust Dossier · <REQ-ID> · `<short sha>` · <STATUS>
**Owner:** <name> · **Recommendation:** <one line> · **Est. owner time:** ~<n> min

> [!CAUTION]
> **<the decisive fact or refused decision>.** <one sentence of evidence, with class>. Decider: <role>.

**Evidence:** citations <ok>/<total> ✓ · <n> commands executed · verifier: <c> confirmed · <w> weakened · <r> refuted · <u> left to humans · highest class <E#>

#### What was checked, and by whom or what
| Check | By | Result | Evidence |

#### What was not checked, and why
- <one line each, max 5; the rest folded>

#### Read these hunks (<tier>, <n> of <total> changed lines)
- **U#** <area> · <why, rule ids> · <linked hunks>

#### Residual risk you accept by signing
> [!NOTE]
> - <plain sentences>

**Area trust (ledger):** <area>: <state> (<signed reviews> signed, <escapes> escapes) · …

**Sign off:** `/reviewer-tieto:sign-off <REVIEW_ID>` · The AI does not approve. A named human signs.

<details><summary><b>What the AI found</b> (<n> confirmed · <n> blocking)</summary> table: Id · Lens · Severity · Finding · path:line · Evidence · Verifier </details>
<details><summary><b>What the AI refused to decide, and why</b> (<n>)</summary> table: Id · Question · Why the AI did not decide · Evidence that would settle it · Decider </details>
<details><summary><b>Requirement trace</b> (R0–R#)</summary> … </details>
<details><summary><b>The change in its own words</b> (<n> units)</summary> … </details>
<details><summary>Verifier log and rejected AI findings</summary> … </details>

<sub>reviewer-tieto <version> · profile <id> · review <REVIEW_ID> · full record: `.trust-review/reviews/<REVIEW_ID>/dossier.md`</sub>
```

To post it on the PR (only when the user asks): `gh pr comment <pr> --body-file $OUT/pr-comment.md`.

## 6. Print to the user

Print sections 1 (header), 3, 4 and 6 of the dossier, plus the path to the full file. Then give the exact sign-off command. Do not change code. If there are confirmed blocking findings, offer to fix them. A fix is a new change and gets a new review.
