---
name: verify-findings
description: Adversarial second pass over all lens output before a human sees it. Mechanically checks every citation, tries to refute each finding and each supporting claim, runs the verification plan and deletion proof in a throwaway worktree when the SDK is available, and re-labels evidence classes. Used by the reviewer-tieto finding-verifier agent.
---

# Verify findings (the AI checks the AI)

Lens agents hallucinate in both directions: invented bugs, and confident "this is fine". Your job is to **refute**, not to agree. Only what survives reaches the owner as fact. Everything else is clearly labelled as unproven.

## Steps

1. **Citations (mechanical).** Write all lens JSON blocks, as a list, to a temp file outside the repo (`$TMPDIR`), then run:
   `python3 <evidence-protocol base directory>/scripts/check_citations.py <file> --repo <repo>`
   Any item whose citations fail is `refuted-citation`, unless you can find the real location yourself. Then fix the citation and note it.
2. **Refute each blocking finding and each abstention marked "suspected".** Read the cited code and its callers. Look for the guard, the earlier check, or the caller that makes the problem impossible. Result: `confirmed`, `refuted` (with the counter-citation) or `unsettled`.
3. **Challenge each supporting claim.** Is the cited test really asserting the criterion? Is there a path the claim ignores? Result: `confirmed`, `weakened` or `refuted`.
4. **Execute when possible** (this is what turns E2 into E1):
   - Run the repo profile's `test.sdk_check` command (from `profile.json`). If it fails, or there is no profile, record "not executed: <reason>" under `not_checked` and skip this step.
   - Create a throwaway worktree, never in the user's tree: `git -C <repo> worktree add --detach "$TMPDIR/trust-wt-<id>" HEAD`. Copy uncommitted changes into it if there are any (`git -C <repo> diff <merge-base> | git -C <wt> apply` after checking it out at the merge base, or review HEAD only and say so).
   - Run the verifiability lens's `verification_plan` commands there, each with a timeout of 10 minutes or less. Quote the last lines of the output.
   - **Deletion proof:** in the worktree, `git checkout <merge-base> -- <production files>` (keep the new tests), re-run the named tests, and expect them to **fail**. If they still pass, the tests do not prove the change: that is a finding (`VER`, note).
   - Always clean up: `git -C <repo> worktree remove --force "$TMPDIR/trust-wt-<id>"`.
5. **Re-label.** Set each surviving item's evidence class to what *you* could establish. Never upgrade without new evidence.

## Rules

- Do not invent new findings, except a deletion-proof failure or an obvious refutation of a supporting claim. You are a filter, not a sixth lens.
- Never touch the user's working tree, branches or stash. Only the throwaway worktree.

## Output

A short summary (counts per status), then one `json` block:

```json
{
  "lens": "verifier",
  "citation_check": {"items": 0, "ok": 0, "failed": 0},
  "executed": [{"command": "...", "exit_code": 0, "tail": "last lines", "purpose": "R1 test | deletion proof R1"}],
  "verdicts": [{"id": "COR-1", "status": "confirmed | refuted | unsettled | refuted-citation | weakened",
                "evidence_class": "E1-executed | E2-traced | E3-inferred",
                "reason": "...", "counter_citations": []}],
  "new_findings": [],
  "not_checked": [{"what": "...", "why": "..."}]
}
```
