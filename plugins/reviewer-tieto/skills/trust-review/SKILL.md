---
name: trust-review
description: Run the full earned-trust review on the current branch and produce a Trust Dossier for a named human owner. It runs risk triage, six lenses in parallel (intent, correctness, security, compatibility, documentation, verifiability), an adversarial verifier, then shows what the AI found, what it refused to decide, what it did not check, and how deeply the owner must read. Never approves.
disable-model-invocation: true
argument-hint: "<requirement-id> [base-branch] [--owner \"Name\"] [requirement text or path to a requirement file]"
---

# Trust review

Arguments: $ARGUMENTS

**The AI's output is advice with evidence. The approval is a named human's signature.** Never print "approved", "LGTM" or "safe to merge".

## 0. Parse the arguments

- **Requirement id** (required): for example `#1234`, `REQ-12` or `TIETO-FR-3`. If it is missing, ask for it and stop: a change with no requirement cannot be traced.
- **Base:** the next argument, if it names a branch that exists. Otherwise use the default from the `evidence-protocol` skill (`origin/HEAD`). Show the base you chose, because it changes the diff. **If the requested base and `origin/HEAD` give different merge bases**, list the commits that differ (`git log --oneline <mb-default>..<mb-requested>` and the reverse), pass them to every lens as "base-branch commits, not this change's own work", and add a base-branch question for the owner as the first abstention. (Lesson log: a bot commit already on the default branch was once mistaken for part of the change and flagged as blocking.)
- **Owner:** `--owner "Name"`. If it is missing, use `git config user.name` and mark it "(assumed: confirm at sign-off)".
- **Requirement text:** the rest. If it is a file path, read it. If it is only a GitHub issue number, the intent lens fetches it with `gh issue view`.

## 1. Find the change, the repo profile, and triage

0. **Repo profile:** run `python3 <this skill's base directory>/scripts/resolve_profile.py --repo <repo>`. It returns the profile directory (the team's own `.trust-review/profile/`, or a bundled one from the plugin's `profiles/`), or none. Show which one applies. Without a profile the review runs on generic rules only, and the dossier says so in "What was not checked".

1. Work out the merge base (see `evidence-protocol`). Run `git diff --stat <merge-base>` and `git status --porcelain`. If there is nothing to review, say so and stop.
2. Set `REVIEW_ID=<req-id without #>-<short HEAD sha>` and `OUT=<repo>/.trust-review/reviews/$REVIEW_ID`. Create `OUT`. Check `.trust-review/` is git-ignored or meant to be committed, and ask the user once if unclear. The ledger is meant to be committed: the team's track record.
3. Area trust: if `<repo>/.trust-review/ledger.jsonl` exists, run `python3 <sign-off base dir>/scripts/trust_ledger.py --repo <repo> area-trust [--policy <profile dir>/policy.json] > <repo>/.trust-review/area-trust.json`.
4. Run `risk-triage` (`risk_triage.py --repo <repo> --base <merge-base> [--profile <profile dir>] [--area-trust ...]`) and save its output to `$OUT/triage.json`.

## 2. Run six lenses in parallel (one message)

Start these agents from the reviewer-tieto plugin (they may be listed as `reviewer-tieto:<name>`):
`intent-reviewer`, `correctness-reviewer`, `security-reviewer`, `compatibility-reviewer`, `documentation-reviewer`, `verifiability-reviewer`.

Give each the same prompt: repo path, base, merge base, review id, requirement id and text, **the profile directory (or "no profile")**, any **base-branch commits** from step 0, and a compact triage digest (overall tier, review units, high-risk files with rule ids, notes). Do not pass a model or effort level: the agent definitions set them.

If the change has more than 3 review units, tell the lenses to cover units in tier order, T2 first, and to list any unit they did not get to under `not_checked`.

## 3. Verify

Start `finding-verifier` with all six JSON blocks (verbatim), the repo, the merge base, the review id and the profile directory. Wait for it.

A lens that fails, or returns no JSON, counts as **not run**. Its topic goes into "What was not checked". For a blocking lens, the recommendation is at least T2 for every unit.

## 4. Decide the routing (rules, not judgment)

Start from the triage tiers per review unit, then:

- a **confirmed blocking** finding in a unit → that unit is `BLOCK`;
- an `unsettled` finding, any abstention citing the unit, or a `weakened`/`refuted` supporting claim → at least `T1`;
- a refuted deletion proof for a criterion → at least `T1` for the units implementing it;
- a security abstention → `T2`, with `security-champion` co-sign.

The overall recommendation is the highest unit tier:
`BLOCK` → "Do not merge yet" · `T2` → "Owner full read of listed units" · `T1` → "Owner focused read of listed hunks" · `T0` → "Ready for owner evidence check".

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

Also write `$OUT/dossier.json` with `review_id`, `requirement`, `profile` (id and plugin version or commit), `base`, `merge_base`, `head`, `owner`, `recommendation`, `units` (with tiers), and the merged findings, supporting claims and abstentions (each with verifier status and evidence class). Save the raw lens and verifier JSON in `$OUT/lenses.json`.

**Validate before writing:** every lens JSON uses an allowed verdict for its lens (blocking lenses: `pass`/`needs_fixes`; advisory lenses: `advisory`). Normalise anything else, and list each normalisation in the appendix as a contract violation.

Record the review in the ledger:
`python3 <sign-off base dir>/scripts/trust_ledger.py --repo <repo> record-review $OUT/dossier.json`

## 6. Print to the user

Print sections 1 (header), 3, 4 and 6 of the dossier, plus the path to the full file. Then give the exact sign-off command. Do not change code. If there are confirmed blocking findings, offer to fix them. A fix is a new change and gets a new review.
