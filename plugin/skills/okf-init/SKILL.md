---
name: okf-init
description: Initialize a new OKF knowledge bundle for a project — creates okf.config.json at the project root (filled in under the user's direction) and the bundle folder itself. Use when a project has no okf.config.json yet and the user wants to start a bundle, or explicitly asks to "init OKF" / "create a knowledge bundle".
allowed-tools: Read, Write, Bash, AskUserQuestion
user-invocable: true
skillmancy-version: "0.2.0"
---

# OKF init

## Task

### 0. Setup

Load the `okf-reference` skill.

### 0. Setup

Load `okf-reference`.

### 1. Read the config

Read `okf.config.json` at the project root. Missing → stop, tell the user to run `okf-init`. For each entry in `bundles`, resolve it's configuration. If any is defined, tell the user and stop.

### 2. Ask how many bundles, and default vs. personalized

1. Ask whether the user wants a default installation or a personalized one.
2. Ask how many bundles this project needs (almost always one, to start). 
3. For each bundle:
  1. Ask whether it should be defined inline in `okf.config.json` or as a standalone `bundle.config.json` file referenced by path.
  2. Define the bundle config:
    - **Default installation** — `bundleRoot` => ask user, `linkFormat` and `logging` => use defaults.
    - **Personalized installation** — walk through each property in both schemas and let the user set it explicitly or skip it, offering the schema's `default` as the suggested choice where present.
  Don't invent answers for required properties with no default. Omit properties not defined.
4. Determine the full index position (optional).

### 3. Write the config file(s)

Write `okf.config.json` and `bundle.config.json` following the schemas and rules defined in `okf-reference`.

### 4. Create the bundle folder(s)

For each bundle, create its `bundleRoot` directory if it doesn't already exist.
For standalone bundles, this is the directory holding its `bundle.config.json`.

### 5. Create `log.md` where logging is `log.md`

For each bundle whose `logging` is `"log.md"`, create an empty `log.md` at that bundle's `bundleRoot`.

### 6. Report

Report the `okf.config.json` path, any standalone `bundle.config.json` paths, and the bundle root path(s) that were created.

### 7. Document usage for future agents

Check which of `AGENTS.md` / `CLAUDE.md` exist at the project root.

- If neither exists, ask the user:
  1. Create `AGENTS.md` and add the snippet 
  2. Create `CLAUDE.md` and add the snippet
  3. Skip
- If one exists, ask:
  1. Add the snippet to that one
  2. Create the other one and add the snippet to it
  3. Skip
- If both exist, ask:
  1. Add the snippet to `AGENTS.md` 
  2. Add the snippet to `CLAUDE.md`
  3. Skip

If the snippet is already present, skip this step.

**Snippet**:
```markdown
## Project knowledge

This project maintains one or more OKF knowledge bundles — check `bundles` in `okf.config.json` for their locations (each entry is either inline or a path to a standalone `bundle.config.json`). At the start of a session, read `fullIndex.md` at `fullIndexPosition` if configured, otherwise each bundle's `<bundleRoot>/index.md`, for an overview of the project's documentation.
```
