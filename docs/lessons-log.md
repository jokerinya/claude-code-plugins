# Lessons log: Earned Trust Review

Junction 2026 · Tieto challenge "Earned Trust in AI Code" · Team Agentlemen

What went wrong while we built and ran the concept, what we changed, and what we would tell the next team. The longer record, with every decision and its trade-off, is in [`decision-log.md`](decision-log.md). The concept itself is on the [concept card](concept-card.html).

## Failure modes we saw

Each row is something that actually happened on the sample changes.

| # | Seen in | What went wrong | What we changed |
|---|---|---|---|
| 1 | #2283 | The AI quoted a line number that did not exist (1 of 37 citations) | A script compares every quoted `path:line` with the code, on every review. It caught this one |
| 2 | #2283 | A commit already on the base branch was blamed on the change and marked blocking | The review compares against the default branch, and asks the owner when two bases give different diffs |
| 3 | #2234 | Criteria were graded against the base branch, so "met" hid an unfixed bug. The base never had the bug | A new binding criterion for regressions: the bug reproduces on the reported version and is fixed there |
| 4 | #2234 | The rules had no outcome for "this is a fine change, but it is not the fix". The most important fact sat in a question, under a T1 label | A new outcome, `NOT-FIX`: the change does not do what the requirement asks |
| 5 | #2234 | 10 new tests looked like strong proof. Only 4 fail without the change | Tests are run without the change. Only those that fail count as proof |
| 6 | A run on a second repository | A comment from a passer-by on the issue was treated as a requirement. The same change got "focused read" on one run and "do not merge" on the next | The requirement's source is read from GitHub. Only the issue author and maintainers can set a binding criterion |
| 7 | All early runs | Lenses drifted from the agreed output format, run after run, despite instructions | A script enforces the format. A prompt did not |
| 8 | Both tools | Two reviewers posted two comments on one PR. One was 50,000 characters, and nobody would read it | One pipeline and one card. The evidence tool feeds the dossier and no longer posts |
| 9 | #2297 | The API credit ran out halfway through a review | The run failed loudly and posted nothing, so no half-finished dossier reached a PR. Only the unfinished jobs were re-run |
| 10 | #2234 | The same change was reviewed twice and got two labels: T1 with a strong warning, then `NOT-FIX`. The conclusion was the same | Consistency across repeat reviews is now a tracked metric |

## What we learned

1. **A rule in a script holds. A rule in a prompt drifts.** Citation checks, the output format, who may set a requirement, and who may sign all moved from instructions into code, each after a failure.
2. **"All tests pass" says little about an agent-written change.** Every test passed on all four samples. The review still found one change that does not fix its bug and one that breaks the requested behaviour.
3. **The most valuable output was a question, not a finding.** On #2234 the AI refused to decide whether the change was aimed at the right branch, and gave the owner the evidence. A reviewer that must always produce a verdict would have missed it.
4. **Evidence needs a commit attached.** Evidence recorded on one commit says nothing about the next. The pipeline rejects it, and a signature covers one commit only.
5. **Readable beats complete.** The first dossier was accurate and 8.7 KB long. The card that people read fits on one screen and folds the rest away.
6. **A named human needs a real moment to decide.** A slash command on a laptop was invisible. A comment on the PR, with the merge blocked until it arrives, is the same decision made where the team can see it.
7. **Routing by risk works on a large change.** On the 237-file change the owner was sent to 52 of 1,494 lines, because 223 files were test snapshots.

## What we would do next

- **Run the reported version in the pipeline.** Today nothing is executed on the version the bug was reported on, so one headline rests on traced evidence, not on a run.
- **Collect outcomes.** The ledger holds reviews and sign-offs. Area trust only starts to move once reverts and incidents are recorded against them.
- **Measure cost and time per review.** We know the pipeline takes 15 to 18 minutes. We have not measured the price.
- **Give the reviewing agent fewer permissions.** It runs unattended with an API key while it reads untrusted text.
- **A second codebase and a frontend sample.** The concept is generic; the profile and the adapter exist for one C# library.

## Answers to the questions judges will ask

**What would make you not trust your own output?**
A quoted line that does not match the code. A finding the verifier refutes. A rerun that gives a different outcome. Evidence recorded on a different commit. A review where nothing was executed, or a lens that did not run. Each of these is printed on the dossier, and most raise the tier.

**Who owns the decision?**
The engineer assigned to the pull request, by name. Only they can sign, and the merge is blocked until they do. They can overrule the AI, but have to say why, and the reason is recorded. Questions the AI refused to decide go to named roles, such as the API owner. Every signature is in the ledger.

**How would this scale?**
Humans read by tier, not by line count. On the 237-file sample change the owner was sent to 52 of 1,494 lines, and the review took about 18 minutes. Lenses run in parallel. Areas that earn trust route lighter over time.
