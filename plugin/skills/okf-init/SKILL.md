---
name: okf-init
description: Initialize a new OKF knowledge bundle for a project — creates okf.config.json at the project root (filled in under the user's direction) and the bundle folder itself. Use when a project has no okf.config.json yet and the user wants to start a bundle, or explicitly asks to "init OKF" / "create a knowledge bundle".
allowed-tools: Read, Write, Bash, AskUserQuestion
user-invocable: true
skillmancy-version: "0.2.0"
---

# OKF init

## Task

Load the `okf-reference` skill first if its model isn't already in context — this skill relies on the `okf.config.json` shape and bundle conventions it defines.

### 1. Check for an existing config

Look for `okf.config.json` at the project root (the working directory, not inside any bundle). If it already exists, show its contents and ask the user whether to abort or overwrite before doing anything else. Do not overwrite silently.

### 2. Ask default vs. personalized

Ask the user whether they want a default installation or a personalized one:

- **Default** — use the default value for every `okf.config.json` property as given in the `okf-reference` skill, asking the user only for the values that reference marks as required with no default (e.g. `bundleRoot`).
- **Personalized** — walk through each property defined in the `okf-reference` skill's `okf.config.json` table and let the user set it explicitly, offering that property's documented default as the suggested choice.

Don't invent answers for required fields with no default; omit optional fields the user has no opinion on rather than writing `null` or empty placeholders.

### 3. Write `okf.config.json`

Write it at the project root with the gathered properties, in the key order shown in the reference skill.

### 4. Create the bundle folder

Create the `bundleRoot` directory if it doesn't already exist. Do not create an `index.md` or any other file inside it — index generation is handled elsewhere, not by this skill.

### 5. Create `log.md` if logging is `file`

If `logging` was set to `file`, create an empty `log.md` at `bundleRoot`.

### 6. Report

Report the `okf.config.json` path and the bundle root path that were created.
