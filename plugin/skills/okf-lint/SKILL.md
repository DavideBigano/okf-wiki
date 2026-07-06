---
name: okf-lint
description: Audit an OKF knowledge bundle (per okf.config.json) against the rules defined in okf-reference — frontmatter validity, link integrity, structural rules, index freshness — and report or fix violations. Use when the user asks to lint, audit, validate, or check an OKF bundle/wiki for compliance.
allowed-tools: Read, Glob, Grep, Edit, AskUserQuestion
argument-hint: "[--auto|--no-fix] [file-or-glob ...]"
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

Load `okf-reference` first if not already in context — every rule checked here is defined there; never restate it.

### 1. Read the config

Read `okf.config.json` at the project root, not inside a bundle. Missing → stop, tell the user to run `okf-init`. Never guess `bundleRoot` or any other value.

### 2. Resolve scope

Check the invocation arguments for file paths or glob patterns (anything that isn't `--auto` or `--no-fix`):

- **None given** — scope is the full bundle, walked from `bundleRoot`.
- **One or more given** — resolve each (relative, absolute, or glob); scope is exactly the matched files. Ignore any argument that resolves to a directory — this mode targets files, not a subtree.

### 3. Run the check catalog

Against the resolved scope, cite the `okf-reference` rule each check enforces — never re-explain the rule, only report the violation:

- **Frontmatter** — missing required `type`; missing a property listed in `requiredProperties`; a reserved filename (`index.md`, `log.md`, `.directory.md`) written as a concept.
- **Links** — an internal link with no matching target; a link style that doesn't match `okf.config.json`'s `linkFormat`.
- **Structural** — a directory nested past `maxBundleDepth`; a directory missing `.directory.md` when `directoryMd` is `true`; a reserved filename misused.
- **Index freshness** — `index.md` or `fullIndex.md` entries stale, missing, or mislinked against the bundle's actual contents.

### 4. Report and resolve each finding

Find a concrete, actionable fix unless none is obvious or the one found is weak.

- **`--auto`** — apply each fix directly; report fix-less findings.
- **`--no-fix`** — report only, apply nothing.
- **neither (default, interactive)** — call `AskUserQuestion` per finding with exactly three options: apply the recommended fix, skip, or let the user supply their own fix (freeform).

Report format:

```
[type] path/to/file.md — concise, declarative description of the violation
  recommended fix: <provided fix or "none" if missing>
```
