#!/usr/bin/env node

// genIndex.js — OKF index generator (local extension, not part of OKF).
// Regenerates a per-directory index.md across a bundle, and optionally a
// recursive fullIndex. Config, link style, and full-index position come from
// okf.config.json discovered upward from the working directory.

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

// --- config ----------------------------------------------------------------

const configPath = findConfig(process.cwd());
if (!configPath) {
  console.error('okf.config.json not found (searched from the working directory upward).');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error(`Could not read ${configPath}: ${err.message}`);
  process.exit(1);
}

if (!config.bundleRoot) {
  console.error(`bundleRoot is required in ${configPath}.`);
  process.exit(1);
}

const bundleRoot = resolveSystemPath(config.bundleRoot);
if (!fs.existsSync(bundleRoot) || !fs.statSync(bundleRoot).isDirectory()) {
  console.error(`bundleRoot does not resolve to a directory: ${bundleRoot}`);
  process.exit(1);
}

const linkFormat = config.linkFormat || 'rootRelative';
const fullIndexPosition = config.fullIndexPosition || 'none';
const directoryMd = config.directoryMd === true;

let fullIndexAbs = null;
if (fullIndexPosition !== 'none') {
  fullIndexAbs =
    fullIndexPosition === 'bundleRoot'
      ? path.join(bundleRoot, 'fullIndex.md')
      : resolveSystemPath(fullIndexPosition); // <path> is a system path (absolute or cwd-relative)
}

// Generated full-index files are never listed as concepts. A `fullIndex.md` at
// the bundle root is always excluded (even when generation is off, so a stale
// artifact is never mistaken for a concept); the configured target, if any, too.
const excludedFiles = new Set([path.resolve(path.join(bundleRoot, 'fullIndex.md'))]);
if (fullIndexAbs) excludedFiles.add(path.resolve(fullIndexAbs));

// Build a link honoring linkFormat.
//   rootRelative → bundle-relative, starting with "/"
//   fileRelative → relative to baseDir (the dir holding the index being written)
// isDir appends a trailing slash.
function linkFor(targetAbs, isDir, baseDir) {
  let rel;
  if (linkFormat === 'fileRelative') {
    rel = toPosix(path.relative(baseDir, targetAbs));
    if (!rel.startsWith('.')) rel = './' + rel;
  } else {
    rel = '/' + toPosix(path.relative(bundleRoot, targetAbs));
  }
  if (isDir && !rel.endsWith('/')) rel += '/';
  return encodeLink(rel);
}

// --- entry building --------------------------------------------------------

function conceptEntry(dir, name, baseDir) {
  const fpath = path.join(dir, name);
  const fm = readFrontmatter(fpath);
  if (fm.type == null || String(fm.type).trim() === '') {
    fail(`${rel(fpath)}: frontmatter is missing the required 'type' field.`);
  }
  return {
    title: fm.title != null ? String(fm.title) : name.replace(/\.md$/i, ''),
    description: fm.description != null ? String(fm.description) : '',
    link: linkFor(fpath, false, baseDir),
  };
}

function subdirEntry(dir, name, baseDir) {
  const link = linkFor(path.join(dir, name), true, baseDir);
  // When directory metadata is off, never touch .directory.md; the entry is
  // just the directory name.
  if (!directoryMd) {
    return { title: name, description: '', link, isDir: true };
  }
  // With directoryMd on, every subdirectory must carry a .directory.md.
  const dpath = path.join(dir, name, '.directory.md');
  if (!fs.existsSync(dpath)) {
    fail(
      `${rel(dpath)} is missing. With "directoryMd": true every subdirectory needs a .directory.md — ` +
        `add it, or set "directoryMd" to false in okf.config.json.`,
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
  return `* [${text}](${e.link})` + (e.description ? ` - ${e.description}` : '');
};

// --- per-directory indices -------------------------------------------------

const written = [];

function writeDirIndex(dir) {
  const { concepts, subdirs } = listDir(dir, excludedFiles);

  const conceptEntries = concepts.map((n) => conceptEntry(dir, n, dir)).sort(byTitle);
  const subdirEntries = subdirs.map((n) => subdirEntry(dir, n, dir)).sort(byTitle);

  const parts = [];
  if (conceptEntries.length) parts.push('# Concepts\n\n' + conceptEntries.map(bullet).join('\n'));
  if (subdirEntries.length) parts.push('# Subdirectories\n\n' + subdirEntries.map(bullet).join('\n'));

  const body = parts.length ? parts.join('\n\n') + '\n' : '';
  const target = path.join(dir, 'index.md');
  fs.writeFileSync(target, body);
  written.push(target);

  for (const name of subdirs) writeDirIndex(path.join(dir, name));
}

// --- full index ------------------------------------------------------------

function walkFull(dir, indent, lines, baseDir) {
  const { concepts, subdirs } = listDir(dir, excludedFiles);
  const pad = '    '.repeat(indent);

  for (const e of concepts.map((n) => conceptEntry(dir, n, baseDir)).sort(byTitle)) {
    lines.push(pad + bullet(e));
  }
  for (const name of subdirs
    .map((n) => ({ name: n, entry: subdirEntry(dir, n, baseDir) }))
    .sort((a, b) => byTitle(a.entry, b.entry))) {
    lines.push(pad + bullet(name.entry));
    walkFull(path.join(dir, name.name), indent + 1, lines, baseDir);
  }
}

// --- run -------------------------------------------------------------------

writeDirIndex(bundleRoot);

if (fullIndexAbs) {
  const lines = [];
  walkFull(bundleRoot, 0, lines, path.dirname(fullIndexAbs));
  const body = '# Full Index\n\n' + lines.join('\n') + (lines.length ? '\n' : '');
  fs.mkdirSync(path.dirname(fullIndexAbs), { recursive: true });
  fs.writeFileSync(fullIndexAbs, body);
  written.push(fullIndexAbs);
}

for (const f of written) console.log(`wrote ${toPosix(path.relative(process.cwd(), f))}`);
console.log(`${written.length} file(s) written.`);
