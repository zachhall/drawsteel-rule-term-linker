# Draw Steel Rule Term Linker

Backlinks Draw Steel rule terms in your notes to their definitions in a glossary note.

## Prerequisites

- **Obsidian ≥ 1.5.0**

## Features

- Creates `ds-glossary.md` at your vault root the first time you enable the plugin, if no glossary note already exists — one heading per term (e.g. `### Prone`), transcribed from the DS Compendium's Introduction chapter. Runs once only; it never overwrites an existing note, even if you later delete or rename the one it created.
- Locks the glossary note against normal editing (typing, paste, drag-and-drop, cut, undo all become no-ops in its editor) — it's meant to be a stable backlink target, not something you add content to directly. Reading view, Page Preview, and backlinks are all unaffected, since none of those depend on the editor being writable. To add a new term, point a "Rule terms" entry (below) at any note in your vault instead of editing this one.
- Ships with a default term list — the ~240 bolded glossary entries from the Compendium's Introduction chapter — resolved against the headings actually present in your glossary note.
- Supports aliases — a term with no heading of its own that links wherever another term does (e.g. "XP" links to `### Experience`, ships as a default alias).
- Renders every mention of a known rule term as a link straight to its heading in the glossary note (`ds-glossary#Prone`), live at view time — no note content is ever edited, so it works on hand-written notes, imported hero notes, and the glossary note itself alike, and stays current the moment a heading changes.
- Links get Obsidian's native Page Preview (which scopes the hover popup to that heading) and click-to-navigate, same as a hand-written `[[wikilink#Heading]]`.
- Skips code blocks/spans and text already inside a link, so it never double-links or mangles fenced code.
- Skips headings (H2/H3), a draw-steel-elements Ability's flavor text and its `Source:` attribution line (added by drawsteel-hero-importer), and the contents of `ds-skills`/`ds-stamina` blocks — none of those are meant to be read as rule-term prose.
- Within a single Ability block, only the first mention of each term links — later repeats of e.g. "Prone" in the same Ability's effect text stay plain. Outside Ability blocks, every mention still links.
- Settings let you point at a non-default glossary note location, blacklist folders that should never be scanned, and remove/add terms from the list (custom additions resolve to a matching heading on the next rebuild too).
- The glossary note itself is never linked (it's the link target).

## Limitations

- Term matching is literal text, case-insensitive — it does not understand plurals, inflections, or synonyms unless you add them as separate term entries.
- A term only links if a heading with that exact name exists in the glossary note; renaming or removing a heading silently drops the link for that term until you rebuild.
- Reading view / Live Preview rendering only, per Obsidian's markdown post-processor — raw source mode and non-Obsidian renderers (e.g. GitHub) show the plain term text.

## Installation

### Recommended: BRAT

1. Install and enable the **BRAT** community plugin (Settings → Community plugins → Browse).
2. Run **BRAT: Add a beta plugin for testing** and add `zachhall/drawsteel-rule-term-linker`.
3. BRAT downloads `main.js`, `manifest.json`, and `styles.css` from the latest [release](../../releases) and enables the plugin. Run **BRAT: Check for updates to all beta plugins** to pull in future releases.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from a [release](../../releases).
2. Copy them into `<your vault>/.obsidian/plugins/drawsteel-rule-term-linker/`.
3. Reload Obsidian and enable **Draw Steel Rule Term Linker** under Settings → Community plugins.

## Usage

1. Enable the plugin. If no glossary note exists in your vault yet, `ds-glossary.md` is created at the vault root automatically (skip this if you'd rather write your own — just make sure it exists before enabling, one `### Term` heading per entry).
2. Open this plugin's settings and click **Rebuild from glossary** to resolve the default term list against your glossary's headings (it also auto-resolves once on first load).
3. Open or reload any note — matching terms render as links automatically.
4. In settings, delete any default terms you don't want linked, or add your own.

## Settings

- **Glossary note location** — vault path to the glossary note. Defaults to `ds-glossary.md` at the vault root; use **Auto-detect** to search the vault for a note named `ds-glossary` by name.
- **Restore default glossary note** — recreates the default glossary note at the configured location. The note is locked against normal editing (see Features), so this is mainly an edge-case recovery tool rather than something you'd need routinely. Warns and asks for confirmation first if a note already exists there, since continuing overwrites it.
- **Rebuild term index** — resolves the default term list, plus anything you've added, against headings currently in the glossary note. Also drops any term that used to point at a glossary heading that's since been renamed or removed, so it stops linking to a dead heading. Since the note itself is locked, you'll mainly need this after using Restore default glossary note above, after adding a new alias, or if the note's headings changed some other way (e.g. before the note existed, or edited outside Obsidian).
- **Blacklisted folders** — notes under these folders (and subfolders) are never scanned or linked.
- **Rule terms** — the term → glossary heading table used for linking, seeded from the default list. Delete entries you don't want, edit a target (`ds-glossary#Heading`), or add your own term.
- **Term aliases** — a term → canonical-term table for terms with no heading of their own (e.g. `XP` → `Experience`). Resolved to the canonical term's actual target automatically when added (a rebuild runs behind the scenes), so it stays in sync if that target changes and links right away without a separate manual rebuild.

## Building from source

```
npm install
npm run dev    # watch build
npm run build  # production build
npm test       # Obsidian community-directory compliance checks (tests/)
```

`esbuild.config.mjs` writes `main.js` into this folder, so if the repo lives in
your vault's `.obsidian/plugins/` directory, no copy step is needed — just reload
Obsidian.

## License

MIT
