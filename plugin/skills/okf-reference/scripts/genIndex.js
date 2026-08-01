#!/usr/bin/env node

// genIndex.js — OKF index generator (local extension, not part of OKF).
// Regenerates a per-directory index.md across every configured bundle, and
// optionally a single recursive fullIndex. Config comes from okf.config.json
// discovered upward from the working directory; each bundle in its `bundles`
// array is either defined inline (bundleRoot required there) or referenced by
// path to a standalone bundle.config.json file, which lives at that bundle's
// root — the directory containing it IS the bundle root.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const RESERVED = new Set(['index.md', 'log.md', '.directory.md']);

// --- helpers ---------------------------------------------------------------

const toPosix = (p) => p.replaceAll(path.sep, path.posix.sep);
const esc = (s) => String(s).replace(/]/g, '\\]');
const rel = (p) => toPosix(path.relative(process.cwd(), p)) || '.';

function fail(msg) {
  console.error(`genIndex: ${msg}`);
  process.exit(1);
}
// Percent-encode the characters that break a markdown link target `[](…)`.
// Spaces and parentheses are the ones that actually appear in filenames;
// separators and the `.`/`/` prefixes are left intact.
const encodeLink = (p) => p.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');

function findConfig(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, 'okf.config.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Every config path is a system path: absolute, or relative to the cwd.
function resolveSystemPath(p) {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function readJson(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(`cannot read ${label} at ${rel(filePath)}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`${label} at ${rel(filePath)} is not valid JSON: ${err.message}`);
  }
}

// Read and parse a file's YAML frontmatter. Structural problems are fatal: an
// unreadable file, a missing frontmatter block, or invalid YAML all stop the
// run with a message rather than degrading silently.
function readFrontmatter(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    fail(`cannot read ${rel(filePath)}: ${err.message}`);
  }
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) fail(`${rel(filePath)}: missing YAML frontmatter.`);
  let data;
  try {
    data = YAML.parse(m[1]);
  } catch (err) {
    fail(`${rel(filePath)}: invalid YAML frontmatter — ${err.message.split('\n')[0]}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    fail(`${rel(filePath)}: frontmatter must be a YAML mapping.`);
  }
  return data;
}

// List a directory's own concept files and subdirectories (dotfiles, reserved
// names, and generated full-index files excluded).
function listDir(dir, excludedFiles) {
  const concepts = [];
  const subdirs = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { concepts, subdirs };
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) {
      subdirs.push(e.name);
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      if (RESERVED.has(e.name)) continue;
      if (excludedFiles.has(path.resolve(path.join(dir, e.name)))) continue;
      concepts.push(e.name);
    }
  }
  return { concepts, subdirs };
}

const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

// --- config ------------------------------------------------------------

const configPath = findConfig(process.cwd());
if (!configPath) {
  console.error('okf.config.json not found (searched from the working directory upward).');
  process.exit(1);
}

const okfConfig = readJson(configPath, 'okf.config.json');

if (!Array.isArray(okfConfig.bundles) || okfConfig.bundles.length === 0) {
  console.error(`bundles (a non-empty array) is required in ${configPath}.`);
  process.exit(1);
}

// Resolve each `bundles` entry into { bundleRoot, linkFormat, directoryMd }.
// A string entry points to a standalone bundle.config.json; that file's own
// directory is the bundle root. An inline object carries bundleRoot itself.
function resolveBundle(entry) {
  if (typeof entry === 'string') {
    const bundleConfigPath = resolveSystemPath(entry);
    const bundleConfig = readJson(bundleConfigPath, 'bundle.config.json');
    if (!bundleConfig.linkFormat) fail(`linkFormat is required in ${rel(bundleConfigPath)}.`);
    return {
      bundleRoot: path.dirname(bundleConfigPath),
      linkFormat: bundleConfig.linkFormat,
      directoryMd: bundleConfig.directoryMd === true,
    };
  }
  if (!entry || typeof entry !== 'object') {
    fail(`each entry in "bundles" must be a path string or an object (got ${JSON.stringify(entry)}).`);
  }
  if (!entry.bundleRoot) fail(`bundleRoot is required for each inline bundle in ${configPath}.`);
  if (!entry.linkFormat) fail(`linkFormat is required for each inline bundle in ${configPath}.`);
  return {
    bundleRoot: resolveSystemPath(entry.bundleRoot),
    linkFormat: entry.linkFormat,
    directoryMd: entry.directoryMd === true,
  };
}

const bundles = okfConfig.bundles.map(resolveBundle);

for (const b of bundles) {
  if (!fs.existsSync(b.bundleRoot) || !fs.statSync(b.bundleRoot).isDirectory()) {
    console.error(`bundleRoot does not resolve to a directory: ${b.bundleRoot}`);
    process.exit(1);
  }
}

const fullIndexPosition = okfConfig.fullIndexPosition || 'none';
const fullIndexAbs = fullIndexPosition !== 'none' ? resolveSystemPath(fullIndexPosition) : null;

// Generated full-index file is never listed as a concept in any bundle.
const excludedFiles = new Set();
if (fullIndexAbs) excludedFiles.add(path.resolve(fullIndexAbs));

// Build a link honoring a bundle's linkFormat.
//   bundleRootRelative → bundle-relative, starting with "/"
//   fileRelative → relative to baseDir (the dir holding the index being written)
//   absolute → absolute system path
//   wikilink → [[title]] syntax, using the link title rather than a URL
// isDir appends a trailing slash (ignored for wikilink).
function linkFor(bundle, targetAbs, isDir, baseDir) {
  let target;
  switch (bundle.linkFormat) {
    case 'fileRelative':
      target = toPosix(path.relative(baseDir, targetAbs));
      if (!target.startsWith('.')) target = `./${target}`;
      break;
    case 'absolute':
      target = toPosix(targetAbs);
      break;
    case 'wikilink':
      target = null; // handled by the caller via bullet()
      break;
    default:
      target = `/${toPosix(path.relative(bundle.bundleRoot, targetAbs))}`;
      break;
  }
  if (target != null && isDir && !target.endsWith('/')) target += '/';
  return target != null ? encodeLink(target) : null;
}

// --- entry building ----------------------------------------------------

function conceptEntry(bundle, dir, name, baseDir) {
  const fpath = path.join(dir, name);
  const fm = readFrontmatter(fpath);
  if (fm.type == null || String(fm.type).trim() === '') {
    fail(`${rel(fpath)}: frontmatter is missing the required 'type' field.`);
  }
  return {
    title: fm.title != null ? String(fm.title) : name.replace(/\.md$/i, ''),
    description: fm.description != null ? String(fm.description) : '',
    link: linkFor(bundle, fpath, false, baseDir),
  };
}

function subdirEntry(bundle, dir, name, baseDir) {
  const link = linkFor(bundle, path.join(dir, name), true, baseDir);
  // When directory metadata is off, never touch .directory.md; the entry is
  // just the directory name.
  if (!bundle.directoryMd) {
    return { title: name, description: '', link, isDir: true };
  }
  // With directoryMd on, every subdirectory must carry a .directory.md.
  const dpath = path.join(dir, name, '.directory.md');
  if (!fs.existsSync(dpath)) {
    fail(
      `${rel(dpath)} is missing. With "directoryMd": true every subdirectory needs a .directory.md — ` +
        `add it, or set "directoryMd" to false for this bundle.`,
    );
  }
  const dm = readFrontmatter(dpath);
  return {
    title: dm.title != null ? String(dm.title) : name,
    description: dm.description != null ? String(dm.description) : '',
    link,
    isDir: true,
  };
}

const bullet = (e) => {
  const text = e.isDir ? `**${esc(e.title)}/**` : esc(e.title);
  if (e.link == null) return `* [[${esc(e.title)}]]${e.description ? ` - ${e.description}` : ''}`;
  return `* [${text}](${e.link})${e.description ? ` - ${e.description}` : ''}`;
};

// --- per-directory indices ----------------------------------------------

const written = [];

function writeDirIndex(bundle, dir) {
  const { concepts, subdirs } = listDir(dir, excludedFiles);

  const conceptEntries = concepts.map((n) => conceptEntry(bundle, dir, n, dir)).sort(byTitle);
  const subdirEntries = subdirs.map((n) => subdirEntry(bundle, dir, n, dir)).sort(byTitle);

  const parts = [];
  if (conceptEntries.length) parts.push(`# Concepts\n\n${conceptEntries.map(bullet).join('\n')}`);
  if (subdirEntries.length) parts.push(`# Subdirectories\n\n${subdirEntries.map(bullet).join('\n')}`);

  const body = parts.length ? `${parts.join('\n\n')}\n` : '';
  const target = path.join(dir, 'index.md');
  fs.writeFileSync(target, body);
  written.push(target);

  for (const name of subdirs) writeDirIndex(bundle, path.join(dir, name));
}

// --- full index ----------------------------------------------------------

function walkFull(bundle, dir, indent, lines, baseDir) {
  const { concepts, subdirs } = listDir(dir, excludedFiles);
  const pad = '    '.repeat(indent);

  for (const e of concepts.map((n) => conceptEntry(bundle, dir, n, baseDir)).sort(byTitle)) {
    lines.push(pad + bullet(e));
  }
  for (const name of subdirs
    .map((n) => ({ name: n, entry: subdirEntry(bundle, dir, n, baseDir) }))
    .sort((a, b) => byTitle(a.entry, b.entry))) {
    lines.push(pad + bullet(name.entry));
    walkFull(bundle, path.join(dir, name.name), indent + 1, lines, baseDir);
  }
}

// --- run -------------------------------------------------------------------

for (const bundle of bundles) writeDirIndex(bundle, bundle.bundleRoot);

if (fullIndexAbs) {
  const lines = [];
  const baseDir = path.dirname(fullIndexAbs);
  for (const bundle of bundles) walkFull(bundle, bundle.bundleRoot, 0, lines, baseDir);
  const body = `# Full Index\n\n${lines.join('\n')}${lines.length ? '\n' : ''}`;
  fs.mkdirSync(path.dirname(fullIndexAbs), { recursive: true });
  fs.writeFileSync(fullIndexAbs, body);
  written.push(fullIndexAbs);
}

for (const f of written) console.log(`wrote ${toPosix(path.relative(process.cwd(), f))}`);
console.log(`${written.length} file(s) written.`);
