---
name: okf-lint
description: Audit an OKF knowledge bundle (per okf.config.json) against the rules defined in okf-reference — frontmatter validity, link integrity, structural rules, index freshness — and report or fix violations. Use when the user asks to lint, audit, validate, or check an OKF bundle/wiki for compliance.
allowed-tools: Read, Glob, Grep, Edit, AskUserQuestion
argument-hint: "[--auto|--no-fix] [--bundle name] [file-or-glob ...]"
user-invocable: true
skillmancy-version: "0.2.0"
---

# OKF lint

## Guidelines

**Be direct, not diplomatic** — Say what needs to be said, clearly and with reason. Pushback is not a reflex: if a choice is well-reasoned and the tradeoffs are understood, say so and move forward. (Yes: ["This design has no behavioral payoff — cut it"] / No: ["That's interesting, maybe consider..."])

**Only flag contradictions** — `okf-reference` defines what's required, recommended, and conventional. Flag only explicit contradictions of an `okf-reference` rule — never a stylistic or structural choice it leaves open. (Yes: ["flag a concept missing the required `type` field", "flag a link pointing at a nonexistent file"] / No: ["flag an unconventional but undefined heading", "flag an inconsistent-looking directory name"])

**Edit only the finding** — Touch only the exact file and field a finding names. Never run `genIndex.js`, never edit `okf.config.json`, never clean up alongside a fix. Under `--no-fix`, zero edits, regardless of what the user says.

**No summary** — No aggregate counts, no wrap-up. Stop the moment the last finding is resolved or reported.

---

## Task

### 0. Setup

Load `okf-reference`.

### 1. Read the config

Read `okf.config.json` at the project root. Missing → stop, tell the user to run `okf-init`. For each entry in `bundles`, resolve it's configuration.

### 2. Resolve scope

With multiple bundles configured locate the one that matches the `--bundle` argument. Operate on that one. If a target cannot be determined, ask the user onto which bundle to operate.

### 3. Run the check catalog

Check the bundle for the following:

- **Frontmatter** — missing required `type`; missing a property listed in the bundle's `requiredProperties`.
- **Links** — an internal link with no matching target; a link style that doesn't match the bundle's `linkFormat`.
- **Structural** — a directory nested past the bundle's `maxBundleDepth`; a directory missing `.directory.md` when the bundle's `directoryMd` is `true`; a reserved filename misused.

### 4. Report and resolve each finding

Find a concrete, actionable fixes unless none is obvious or the one found is weak.

- **`--auto`** — apply each fix directly; report fix-less findings.
- **`--no-fix`** — report only, apply nothing.
- **Neither** — display the findings following the provided template. Ask the user:
  1. Apply all fixes
  2. Walk through each finding 
  3. Skip
  If 2 is chosen, for each finding ask:
  1. Apply the fix 
  2. Skip

Display template:

```markdown
<bundleRootRelativePathToFile>.md
  **Issue**: declarative description of the finding, ~5 to ~15 words
  **Recommended fix**: provided fix or "none found" if missing
```

### 5. Index regeneration

Run the `genIndex` script. Do it even if no files changed.
