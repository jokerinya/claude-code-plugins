# Agentlemen Claude Code plugins

The shared home for the Agentlemen team's Claude Code plugins and skills. This repo is a **plugin marketplace** called `agentlemen`: Claude Code reads the catalog in `.claude-plugin/marketplace.json` and installs the plugins it lists.

## What's here

| Plugin | What it does |
|---|---|
| [`reviewer-tieto`](plugins/reviewer-tieto/) | Earned-trust AI review (Junction 2026 · Tieto): explainable risk routing, six evidence-based lenses, an adversarial verifier and a Trust Dossier a named human signs, with outcome metrics |

Also here, not a plugin: [`review-map/`](review-map/), a Node tool and GitHub Actions workflow that runs an agent-written change on real inputs before and after, and records the evidence. `reviewer-tieto` imports its measurements as executed evidence.

## Getting the plugins

The repo is **private** for now (it goes public when we submit for Junction 2026). Ask the repo owner to add your GitHub account as a collaborator first.

**One-time git setup** so Claude Code can clone a private repo:

```bash
gh auth login
gh auth setup-git
```

**Install**, in a Claude Code session:

```
/plugin marketplace add jokerinya/claude-code-plugins
/plugin install reviewer-tieto@agentlemen
```

Run `/plugin` to check it's enabled. Then try it on the sample repo, see the [`reviewer-tieto` README](plugins/reviewer-tieto/).

**Get updates:**

```
/plugin marketplace update agentlemen
```

**Report problems:** open a GitHub issue with the command you ran, the plugin version (from `/plugin`) and what went wrong.

## Layout

```
.claude-plugin/marketplace.json     catalog of every plugin in this repo
plugins/<plugin-name>/
  .claude-plugin/plugin.json        plugin name and description
  skills/<skill-name>/SKILL.md      skills, also usable as /<plugin-name>:<skill-name>
  agents/<agent-name>.md            subagents with their own model and effort
  README.md                         how to use the plugin
```

## Adding a plugin or skill

1. **New plugin:** create `plugins/<name>/` with `.claude-plugin/plugin.json`, then add an entry to `.claude-plugin/marketplace.json`:
   ```json
   { "name": "<name>", "source": "./plugins/<name>", "description": "<one line>" }
   ```
2. **New skill in an existing plugin:** add `plugins/<plugin>/skills/<skill-name>/SKILL.md` with `name` and `description` frontmatter. The description decides when Claude uses the skill, so say what it does and when to use it.
3. **Check it:** run `claude plugin validate .` in the repo root, then try it with `claude --plugin-dir ./plugins/<name>`.
4. **Bump the version** in the plugin's `plugin.json` (see Conventions), then **open a PR.** After merge, testers run `/plugin marketplace update agentlemen`.

## Conventions

- **`version` lives in `plugin.json` only** (semver, e.g. `0.1.0`), never in the catalog entry. Claude Code only ships an update to testers when this number changes, so **bump it on every change you want people to get**: patch for fixes, minor for new skills or behaviour.
- **Never change a plugin's `name`.** It breaks existing installs. Change `displayName` instead, or add a `renames` entry to the catalog.
- **No secrets, tokens or customer data.** Everything here is copied to every engineer's machine.
- **Executables** go in a `scripts/` folder, never a top-level `bin/`, which claude.ai organisation sync rejects.
- **`lens-*` skills** are plain rule sets, so they can also be uploaded as skills for a hosted PR pipeline (for example Claude Managed Agents).
