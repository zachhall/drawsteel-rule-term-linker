# Documentation

Detailed behavior notes for Draw Steel Rule Term Linker, split out of the README to keep that concise. See the README for installation and quick usage.

## The glossary note

The plugin creates `ds-glossary.md` at your vault root the first time you enable it, if no glossary note already exists — one heading per term (e.g. `### Prone`), transcribed from the DS Compendium's Introduction chapter. This runs once only; it never overwrites an existing note, even if you later delete or rename the one it created.

That note is locked against normal editing — typing, paste, drag-and-drop, cut, and undo all become no-ops in its editor. It's meant to be a stable backlink target, not something you add content to directly. Reading view, Page Preview, and backlinks are all unaffected, since none of those depend on the editor being writable. To add a new term, point a "Rule terms" entry at any note in your vault instead of editing this one.

The glossary note itself is never scanned for rule terms (it's the link target, not a source), so it's excluded from linking regardless of the blacklist.

## How linking works

Every mention of a known rule term renders as a link straight to its target (`ds-glossary#Prone`, or anywhere else a term's target points), live at view time — no note content is ever edited. This means it works uniformly on hand-written notes, imported hero notes, and the glossary note's own definitions, and stays current the moment a term's target changes, without needing to re-save anything.

Links get Obsidian's native Page Preview (scoped to the target heading) and click-to-navigate, the same as a hand-written `[[wikilink#Heading]]`.

The following are skipped and never linked:
- Code blocks and inline code spans, and text already inside a link — so it never double-links or mangles fenced code.
- Headings (H2/H3).
- A draw-steel-elements Ability's own name and flavor text.
- The `Source:` attribution line drawsteel-hero-importer appends to every Ability (identified by its effect-key text, since it shares generic classes with real effects rather than having its own).
- The contents of `ds-skills`/`ds-stamina` blocks.

Within a single Ability block, only the first mention of each term links — later repeats of e.g. "Prone" in the same Ability's effect text stay plain, so a roll's tier1/tier2/tier3 lines don't each re-link the same word. Outside Ability blocks, every mention still links.

Reading view / Live Preview rendering only, per Obsidian's markdown post-processor — raw source mode and non-Obsidian renderers (e.g. GitHub) show the plain term text. Term matching is also literal text, case-insensitive; it does not understand plurals, inflections, or synonyms unless you add them as separate term entries. A term only links if its target still exists — renaming or removing a glossary heading silently drops the link for that term until the index is rebuilt.

## Default terms, target overrides, and aliases

The default term list is the ~240 bolded glossary entries from the Compendium's Introduction chapter, resolved by matching each term's name to a heading of the same name in the glossary note.

A few defaults need an explicit target instead, because the desired term text differs from its heading's title, or the target isn't in the glossary at all:

- `Charge` → `ds-glossary#Charge Main Action`
- `Surges` → `DS Compendium/Rules/Chapters/Classes#Surges`
- `Disengage` → `ds-glossary#Disengage Move Action`

These are merged in on every rebuild at the same trust level as a manually-typed Rule terms entry — not re-verified against current headings.

Aliases are terms with no heading of their own that link wherever another (canonical) term does — e.g. `XP` ships as a default alias resolving to wherever `Experience` links. Adding an alias doesn't immediately create a working link on its own; it only stores the alias → canonical mapping, and the settings UI triggers a rebuild automatically right after so the actual target gets resolved and it links immediately.

## Settings reference

**Glossary note location** — vault path to the glossary note. Defaults to `ds-glossary.md` at the vault root. **Auto-detect** searches the vault for a note named `ds-glossary` by name if the configured path doesn't resolve — this is the only place the plugin ever scans the full list of files in your vault, and only runs when you click the button. Every other lookup (rendering links, indexing terms, the read-only lock) resolves the configured path directly and does nothing further if it isn't found there.

**Subtle Styling** — off by default (the theme's normal internal-link styling). When on, this plugin's own links are reduced to just a dotted underline, switching to solid on hover, applied via a class toggled on `<body>` so it takes effect immediately for links already on screen, no reload needed. Scoped to the `.ds-rule-term-link` class this plugin's links carry specifically — manually written `[[wikilinks]]` and links from any other plugin are untouched either way.

**Restore default glossary note** — recreates the default glossary note at the configured location and rebuilds the term index against it. The note is locked against normal editing (see above), so this is mainly an edge-case recovery tool — if a note already exists there, you'll be asked to confirm before it's overwritten, since continuing discards its current content.

**Blacklisted folders** — notes under these folders (and subfolders) are never scanned for rule terms. Defaults to `DS Compendium` on a new install (an existing vault's setting isn't retroactively changed), since the Compendium is reference material that already cross-references itself; this doesn't affect notes elsewhere linking *into* the Compendium (e.g. the default "Surges" term still resolves there — the blacklist only gates scanning a folder's own notes, not being a link target).

**Rule terms** — the term → target table used for linking, seeded from the default list. A manually-added entry's target is used exactly as typed and is immediately live, since it's a direct target the user supplied rather than something resolved from the glossary. Deleting a default term (or default target override) doesn't stick across a rebuild, since the defaults are always re-merged in — same for a manually-added term whose name happens to collide with an existing glossary heading, which will get reset back to pointing at that heading on the next rebuild.

**Term aliases** — the alias → canonical-term table. Resolved to the canonical term's actual target automatically when added (a rebuild runs behind the scenes), so it stays in sync if that target changes.

**Advanced settings** (collapsed by default, at the bottom of the pane) — currently just **Rebuild term index**, which resolves the default term list, target overrides, and aliases against the glossary note's current headings, and drops any term whose target no longer resolves. Adding an alias and restoring the default glossary note already trigger this automatically, so it's only needed by hand for troubleshooting — e.g. the glossary note's headings changed some other way (edited outside Obsidian, or synced in from a device without this plugin).
