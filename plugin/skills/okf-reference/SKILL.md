---
name: okf-reference
description: Passive reference primer on the Open Knowledge Format (OKF). Load this before reading, producing, editing, validating, or reasoning about an OKF knowledge bundle — a directory tree of markdown files with YAML frontmatter. Covers bundle structure and layout, required/recommended frontmatter fields (type, title, description, resource, tags, timestamp), reserved filenames (index.md, log.md, .directory.md), conventional section headings (Schema, Examples, Citations), bundle-relative and file-relative linking, consumer tolerance rules, and okf_version semantic versioning. Also defines the local okf.config.json project config and bundle.config.json per-bundle config that actor skills read. Use whenever you encounter a knowledge bundle, wiki, okf.config.json, bundle.config.json, or a request mentioning OKF.
user-invocable: true
skillmancy-version: "0.2.0"
---

# OKF reference

## Task

This skill is a passive primer: it equips you to read, produce, or reason about an OKF bundle. Internalize the OKF model in Resources and apply it to the bundle work that follows.

---

## Resources

### OKF model

**What OKF is** — Open Knowledge Format: an open, human- and agent-friendly format for representing knowledge (metadata, context, curated insight around data and systems). A bundle is a directory of markdown files with YAML frontmatter — no central schema registry, no specialized tooling.

**Bundle layout** — A hierarchical markdown directory tree, flexible and domain-independent:

```
bundle/
├── index.md              # Optional directory listing / bundle root
├── log.md                # Optional change history
├── concept.md            # A concept document (any .md file)
└── subdirectory/         # Arbitrary grouping
    └── concept.md
```

Bundles distribute as git repositories (preferred, for history/attribution), tarballs, or subdirectories within a larger repo.

**Documents and frontmatter** — Each document is YAML frontmatter (delimited by `---`) followed by a free-form markdown body. Only `type` is required — a short string naming the kind of concept (e.g. `BigQuery Table`, `API Endpoint`, `Metric`, `Playbook`). Type values are not centrally registered; producers choose descriptive names and consumers MUST tolerate unknown types gracefully. Recommended fields: `title`, `description`, `resource` (canonical URI), `tags` (list), `timestamp` (ISO 8601 last-modified). Custom fields are permitted.

**Reserved filenames** — `index.md` and `log.md` have defined purposes and MUST NOT be used for concept documents. Every other `.md` file is a concept. Local extensions MAY reserve additional names. See [Local extensions](#local-extensions-outside-okf).

**Conventional section headings** — Convention-only, never required: OKF mandates no heading. But when a concept needs to express one of these kinds of content, use the shared heading rather than coining a new one:

| Heading       | Purpose                                  |
|---------------|------------------------------------------|
| `# Schema`    | Structured description of columns/fields |
| `# Examples`  | Concrete usage examples                  |
| `# Citations` | External sources backing claims          |

**Linking** — Two forms connect concepts. Bundle-relative: `[text](/path/to/concept.md)` — starts with `/`, stable when documents move. Relative: `[text](./other.md)` — standard markdown relative path. Links assert a relationship; the semantic type emerges from the surrounding prose. Consumers MUST tolerate broken links gracefully.

**Tolerance (consumer mandate)** — Degrade gracefully, never refuse. A consumer MUST tolerate unknown `type` values, broken links, and missing recommended fields, and SHOULD attempt best-effort consumption rather than rejecting a bundle.

### Versioning

**Scheme** — Semantic versioning `<major>.<minor>`. Current spec version: **0.1**.

**Declaration** — A bundle MAY declare its target version with `okf_version: "0.1"` in the frontmatter of the bundle-root `index.md`. Producers SHOULD declare it when distributing. If absent, assume the current version.

**Bump semantics** — A minor bump adds backward-compatible features (new optional fields, new conventional section headings). A major bump may introduce breaking changes.

**Unknown versions** — A consumer that does not understand the declared version SHOULD attempt best-effort consumption rather than refusing the bundle. Never refuse a bundle solely because of its `okf_version`.

### Local extensions (outside OKF)

Everything in this section is a local addition and is **NOT part of the OKF specification**. Do not assume these conventions exist in third-party bundles. Use them only if there is a config file from the ones defined below.

**`okf.config.json`** — A JSON configuration file at the **project root** that codifies user preferences for one or more bundles, each either defined inline or referenced by path to a standalone `bundle.config.json`. It MUST be defined. Authoritative shape: JSON Schema [`references/okf.config.schema.json`](./references/okf.config.schema.json).

**`bundle.config.json`** — Configuration for a single bundle sitting at bundle root. It may be defined for a knowledge bundle. Authoritative shape: JSON Schema [`references/bundle.config.schema.json`](./references/bundle.config.schema.json).

**`.directory.md`** — An optional, protected file holding frontmatter properties scoped to its containing directory. It MUST NOT be treated as a concept document. It MUST conform to properties defined for the bundle it's used in to describe the directory itself.

**Bundle depth** — A bundle's configured max depth caps how deeply directories may nest within that bundle, measured from the bundle roo, starting at depth 0. Actor skills MUST NOT create concepts or subdirectories beyond this depth.

**Index generation** — Each directory in a bundle carries its own `index.md` that maps only the concepts and immediate subdirectories. A concept entry's is structured like this:

```markdown
* [<concept `title` prop falling back on file basename>](<concept-path>) [- <`description` prop> if present]
```

Subdir entries use the props found in the respective `.directory.md`.

Links honor the configured link format. Two sections, each omitted when empty:

```markdown
# Concepts

* [Item 1](item-1-path) - description of item 1
* [Item 2](item-2-path) - description of item 2

# Subdirectories

* [Subdir](subdir-path) - description of the subdir
```

A single recursive **full index** may also be generated, listing every concept and subdirectory in the bundle with 4-space indentation per nesting level. Its position is configured in `okf.config.json`:

```markdown
# Full Index

* [Item 1](item-1-path) - description of item 1
* [Item 2](item-2-path) - description of item 2
* [Subdir 1](subdir-1-path) - description of subdir 1
    * [Item 3](item-3-path) - description of item 3
    * [Subdir 2](subdir-2-path) - description of subdir 2
        * ...
* [Subdir 3](subdir-3-path) - description of the subdir 3
```

Indices are generated by [`scripts/genIndex.js`](./scripts/genIndex.js): run `node scripts/genIndex.js` from the project root. It overwrites current indices wholesale. It fails with messages on unreadable concepts, invalid frontmatter, missing required properties and missing `.directory.md` if enabled. An unreadable directory is the one case it tolerates silently.

**Wikilinks**: Additional link type added for compatibility with *Obsidian.md*.