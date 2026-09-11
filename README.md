# Draw Steel Rule Term Linker

Backlinks Draw Steel rule terms in your notes to their entries in the DS Compendium.

## Prerequisites

- **Obsidian ≥ 1.5.0**
- **[Draw Steel Elements](https://github.com/SteelCompendium/draw-steel-elements)** — required. Its Settings tab downloads the DS Compendium, the folder of rule notes this plugin links against.

## Features

- Scans the DS Compendium and builds a term → note index from its file titles (e.g. `Prone.md` → the term "Prone").
- Renders every mention of a known rule term as a link to its Compendium note, live at view time — no note content is ever edited, so it works on hand-written notes, imported hero notes, and the Compendium's own entries alike, and stays current the moment the term index changes.
- Links get Obsidian's native hover preview and click-to-navigate, same as a hand-written `[[wikilink]]`.
- Skips code blocks/spans and text already inside a link, so it never double-links or mangles fenced code.
- Settings let you point at a non-default Compendium location, blacklist folders that should never be scanned, and edit the term list by hand (add aliases or override a term's target).
- Notes inside the Compendium folder itself are never linked (they're the link targets).

## Limitations

- Term matching is literal text, case-insensitive — it does not understand plurals, inflections, or synonyms unless you add them as separate term entries.
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

1. Install **Draw Steel Elements** and download the DS Compendium from its settings if you haven't already.
2. Open this plugin's settings and click **Rebuild from Compendium** to index rule terms (it also auto-indexes once on first load if it finds the Compendium at the default location).
3. Open or reload any note — matching terms render as links automatically.

## Settings

- **Compendium location** — vault path to the DS Compendium folder. Defaults to `DS Compendium` at the vault root; use **Auto-detect** to search the vault for it by name.
- **Rebuild term index** — rescans the Compendium and merges any new/renamed notes into the term list.
- **Blacklisted folders** — notes under these folders (and subfolders) are never scanned or linked.
- **Rule terms** — the term → Compendium note path table used for linking. Edit or delete entries, or add your own for terms that need a custom target.

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
