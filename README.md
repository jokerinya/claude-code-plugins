# Agentlemen Claude Code plugins

The shared home for the Agentlemen team's Claude Code plugins and skills. This repo is a **plugin marketplace** called `agentlemen`: Claude Code reads the catalog in `.claude-plugin/marketplace.json` and installs the plugins it lists.

## What's here

| Plugin | What it does |
|---|---|
| [`reviewer-tieto`](plugins/reviewer-tieto/) | Earned-trust AI review (Junction 2026 · Tieto): explainable risk routing, six evidence-based lenses, an adversarial verifier and a Trust Dossier a named human signs, with outcome metrics |

## Getting the plugins

**If the organisation has rolled this out through managed settings**, there's nothing to do. Claude Code registers the marketplace and enables the plugins at your next start. Run `/plugin` to check.

**Manually**, in a Claude Code session:

```
/plugin marketplace add <your-org>/claude-code-plugins
/plugin install reviewer-tieto@agentlemen
```

The repo is private, so your machine needs git access to the repository. If you clone over HTTPS, run `gh auth login` and then `gh auth setup-git` once.

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
4. **Open a PR.** After merge, people with auto-update get the change within a day; others run `/plugin marketplace update agentlemen`.

## Conventions

- **No `version` field** in `plugin.json` or the catalog. Installs follow the latest commit on `main`, so every merge is a release.
- **Never change a plugin's `name`.** It breaks existing installs. Change `displayName` instead, or add a `renames` entry to the catalog.
- **No secrets, tokens or customer data.** Everything here is copied to every engineer's machine.
- **Executables** go in a `scripts/` folder, never a top-level `bin/`, which claude.ai organisation sync rejects.
- **`lens-*` skills** are plain rule sets, so they can also be uploaded as skills for a hosted PR pipeline (for example Claude Managed Agents).
