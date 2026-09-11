# Draw Steel Rule Term Linker

An Obsidian plugin that auto-detects Draw Steel rule terms in your notes and renders a `[[wikilink]]` pointing to a note with their definition stored. Hover over a rendered link and quickly see a definition. Uses the glossary from Chapter 1 of the Draw Steel Heroes rulebook as a built-in default, but also allows for user-defined terms and locations of their definitions.

## Prerequisites

- **Obsidian ≥ 1.13.0**
- **[Draw Steel Elements](https://github.com/SteelCompendium/draw-steel-elements)** — not required to enable this plugin, but it's built with the intent of being used alongside it, with the rule Compendium installed through its settings. Some default terms (e.g. "Surges") link directly into that Compendium.

## Features

- Creates and maintains a read-only glossary note (`ds-glossary.md`) as a stable link target, pre-filled from the DS Compendium.
- Automatically links every mention of a known rule term to its definition, live at view time, with native hover preview — no note content is ever edited.
- Ships with a default set of rule terms and aliases (e.g. "XP" → "Experience"), fully customizable in settings.
- Skips code, existing links, headings, and other non-prose content, and avoids re-linking the same term repeatedly within one Ability.

See [DOCUMENTATION.md](DOCUMENTATION.md) for the full details on how linking, terms, and aliases work.

## Limitations

- Term matching is literal text, case-insensitive — it does not understand plurals, inflections, or synonyms unless you add them as separate term entries.
- Reading view / Live Preview rendering only — raw source mode and non-Obsidian renderers (e.g. GitHub) show the plain term text.

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

1. Enable the plugin — a `ds-glossary.md` note is created automatically if you don't already have one.
2. Open or reload any note; matching terms render as links automatically.
3. In settings, remove any default terms you don't want linked, or add your own.

## Settings

- **Glossary note location** — where the glossary note lives, with auto-detect.
- **Subtle Styling** — reduce this plugin's own links to just a dotted underline, without affecting any other link styling.
- **Restore default glossary note** — recreate it from the bundled default.
- **Blacklisted folders** — folders never scanned for rule terms (defaults to `DS Compendium`).
- **Rule terms** — the term → target table used for linking.
- **Term aliases** — terms that link wherever another term does.
- **Advanced settings** — troubleshooting tools, collapsed by default.

See [DOCUMENTATION.md](DOCUMENTATION.md) for what each setting actually does.

## Building from source

```
npm install
npm run dev    # watch build
npm run build  # production build
npm run lint   # eslint-plugin-obsidianmd (developer guideline checks)
npm test       # Obsidian community-directory compliance checks (tests/)
```

`esbuild.config.mjs` writes `main.js` into this folder, so if the repo lives in
your vault's `.obsidian/plugins/` directory, no copy step is needed — just reload
Obsidian.

## License

MIT
