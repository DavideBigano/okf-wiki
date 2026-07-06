---
name: okf-reference
description: Passive reference primer on the Open Knowledge Format (OKF). Load this before reading, producing, editing, validating, or reasoning about an OKF knowledge bundle — a directory tree of markdown files with YAML frontmatter. Covers bundle structure and layout, required/recommended frontmatter fields (type, title, description, resource, tags, timestamp), reserved filenames (index.md, log.md, .directory.md), conventional section headings (Schema, Examples, Citations), bundle-relative and file-relative linking, consumer tolerance rules, and okf_version semantic versioning. Also defines the local okf.config.json project config (bundleRoot, linkFormat, logging, requiredProperties, maxBundleDepth) that actor skills read. Use whenever you encounter a knowledge bundle, wiki, okf.config.json, or a request mentioning OKF.
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

**Reserved filenames** — `index.md` (optional directory listing / bundle root) and `log.md` (optional change history) have defined purposes and MUST NOT be used for concept documents. Every other `.md` file is a concept. (Local extensions reserve additional names — see [Local extensions](#local-extensions-outside-okf).)

**Conventional section headings** — Convention-only, never required: OKF mandates no heading. But when a concept needs to express one of these kinds of content, use the shared heading rather than coining a new one:

| Heading       | Purpose                                  |
|---------------|------------------------------------------|
| `# Schema`    | Structured description of columns/fields |
| `# Examples`  | Concrete usage examples                  |
| `# Citations` | External sources backing claims          |

**Linking** — Two forms connect concepts. Absolute (bundle-relative): `[text](/path/to/concept.md)` — starts with `/`, stable when documents move. Relative: `[text](./other.md)` — standard markdown relative path. Links assert a relationship; the semantic type emerges from the surrounding prose. Consumers MUST tolerate broken links gracefully.

**Tolerance (consumer mandate)** — Degrade gracefully, never refuse. A consumer MUST tolerate unknown `type` values, broken links, and missing recommended fields, and SHOULD attempt best-effort consumption rather than rejecting a bundle.

### Versioning

**Scheme** — Semantic versioning `<major>.<minor>`. Current spec version: **0.1**.

**Declaration** — A bundle MAY declare its target version with `okf_version: "0.1"` in the frontmatter of the bundle-root `index.md`. Producers SHOULD declare it when distributing. If absent, assume the current version.

**Bump semantics** — A minor bump adds backward-compatible features (new optional fields, new conventional section headings). A major bump may introduce breaking changes.

**Unknown versions** — A consumer that does not understand the declared version SHOULD attempt best-effort consumption rather than refusing the bundle. Never refuse a bundle solely because of its `okf_version`.

### Local extensions (outside OKF)

**Status** — Everything in this section is a local addition and is **NOT part of the OKF specification**. Do not assume these conventions exist in third-party bundles: external producers will not emit them, and external consumers will not understand them. Use them only within bundles produced and consumed under this workflow, and never rely on them for interoperability.

**`okf.config.json`** — A JSON configuration file at the **project root** (not inside a bundle) that codifies user preferences. It is read by the actor skills that operate on knowledge bundles (producers, consumers); this primer only defines its shape. Every path value is a system path — absolute, or relative to the working directory the actor runs from — never relative to the config file's location. Properties:

| Property | Type | Required | Default | Meaning |
|---|---|---|---|---|
| `bundleRoot` | string — system path (absolute, or relative to the working directory) | required | — | Location of the primary bundle. |
| `directoryMd` | boolean | optional | — | Whether `.directory.md` directory-property files are used. |
| `fullIndexPosition` | `"none"` \| `"bundleRoot"` \| system path | optional | `"none"` | Where the recursive full index is written: `none` → not generated; `bundleRoot` → `fullIndex.md` at the bundle root; a system path → that location. See [Index generation](#local-extensions-outside-okf). |
| `linkFormat` | `"rootRelative"` \| `"fileRelative"` | required | `"rootRelative"` | Link style actor skills emit: `rootRelative` → bundle-relative `/path.md`; `fileRelative` → relative `./path.md`. See [Linking](#okf-model). |
| `logging` | `"file"` \| `"git"` \| `"none"` | required | `"file"` | How changes are recorded: `file` → maintain `log.md`; `git` → rely on git history; `none` → no change log. |
| `maxBundleDepth` | number | optional | — | Maximum directory nesting depth allowed within a bundle. |
| `requiredProperties` | string[] | optional | — | Frontmatter properties every concept must carry. `type` is always required by OKF and is ignored if listed here. |

Example:

```json
{
  "bundleRoot": "./wiki",
  "directoryMd": true,
  "fullIndexPosition": "bundleRoot",
  "linkFormat": "rootRelative",
  "logging": "file",
  "maxBundleDepth": 3,
  "requiredProperties": ["title", "timestamp"]
}
```

**`.directory.md`** — An optional, protected file holding frontmatter properties scoped to its containing directory. The leading dot marks it as meta: like `index.md` and `log.md` it is reserved and MUST NOT be treated as a concept document. It uses the same fields as a concept's frontmatter (`title`, `description`, `resource`, `tags`, `timestamp`, and custom fields) to describe the directory itself rather than a single concept. Enabled by `directoryMd` in `okf.config.json`.

**Bundle depth** — `maxBundleDepth` in `okf.config.json` caps how deeply directories may nest within a bundle, measured from `bundleRoot` (depth 0). Actor skills MUST NOT create concepts or subdirectories beyond this depth.

**Index generation** — Each directory in the bundle, from `bundleRoot` down, carries its own `index.md` that maps **only its own level** — the concepts and immediate subdirectories in that directory, nothing deeper. A concept entry's text and description come from the concept's `title` and `description` frontmatter (title falls back to the filename); a subdirectory entry's come from that subdirectory's `.directory.md` (falling back to the directory name). Links honor `linkFormat`. Two sections, each omitted when empty:

```markdown
# Concepts

* [Title 1](relative-url-1) - short description of item 1
* [Title 2](relative-url-2) - short description of item 2

# Subdirectories

* [**Subdirectory/**](subdir/) - short description of the subdirectory
```

A single recursive **full index** may also be generated, listing every concept and subdirectory in the bundle with 4-space indentation per nesting level. Its position is set by `fullIndexPosition` in `okf.config.json`:

```markdown
# Full Index

* [Title 1](relative-url-1) - short description of item 1
* [Title 2](relative-url-2) - short description of item 2
* [**Subdirectory/**](subdir/) - short description of the subdirectory
    * [Title 3](relative-url-3) - short description of item 3
    * [Title 4](relative-url-4) - short description of item 4
    * [**Subdirectory/**](subdir/nested/) - short description of the subdirectory
        * ...
* [**Subdirectory/**](other/) - short description of the subdirectory
```

The generator is [`scripts/genIndex.js`](./scripts/genIndex.js): run `node scripts/genIndex.js` from the project root. It overwrites every `index.md` (and the full index) wholesale. It fails loudly (non-zero exit) when a concept is unreadable, has no or invalid YAML frontmatter, or lacks the required `type`; and, when `directoryMd` is enabled, when any subdirectory is missing its `.directory.md`. An unreadable directory is the one case it tolerates silently.
