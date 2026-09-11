import { MarkdownPostProcessorContext, Notice, Plugin, TFile, normalizePath } from "obsidian";
import { DEFAULT_ALIASES } from "./aliases";
import { DEFAULT_TERMS } from "./default-terms";
import GLOSSARY_TEMPLATE from "./ds-glossary.md";
import { reportError } from "./errors";
import { locateGlossaryFile, resolveTermHeadings } from "./glossary";
import { findTermMatches } from "./linker";
import { createGlossaryReadOnlyExtension } from "./readonly-glossary";
import {
	DEFAULT_GLOSSARY_BASENAME,
	DEFAULT_GLOSSARY_PATH,
	DEFAULT_SETTINGS,
	RuleLinkerSettingTab,
	RuleLinkerSettings,
} from "./settings";

const SKIP_PARENT_SELECTOR = [
	"code",
	"pre",
	"a",
	"button",
	"input",
	"textarea",
	"select",
	"h2",
	"h3",
	// draw-steel-elements code blocks whose content shouldn't be linked.
	".block-language-ds-skills",
	".block-language-ds-stamina",
	// The Ability block's flavor text (draw-steel-elements' FeatureView).
	".ds-feature-flavor-value",
].join(", ");

// The "Source: <origin>" line drawsteel-hero-importer appends as the last
// effect on every Ability — an effect entry like any other, so it shares
// draw-steel-elements' generic effect classes and needs a content check
// (its key text) rather than a selector to tell it apart from a real effect.
const EFFECT_KEY_SELECTOR = ".ds-pr-effect-key";

// Term-detection scope for "first occurrence only" dedup: one Ability block.
const FEATURE_CONTAINER_SELECTOR = ".ds-feature-container";

function isSourceEffect(parent: Element): boolean {
	const container = parent.closest(".ds-effect-container");
	const key = container?.querySelector(EFFECT_KEY_SELECTOR);
	return key?.textContent?.trim().replace(/:$/, "").toLowerCase() === "source";
}

function isWithinFolder(filePath: string, folderPath: string): boolean {
	if (!folderPath) return false;
	const normalizedFolder = normalizePath(folderPath);
	return filePath === normalizedFolder || filePath.startsWith(`${normalizedFolder}/`);
}

export default class RuleTermLinkerPlugin extends Plugin {
	settings: RuleLinkerSettings = DEFAULT_SETTINGS;

	/**
	 * Keyed by `.ds-feature-container` element rather than created fresh per
	 * `processNode` call: draw-steel-elements renders an Ability's pieces
	 * (each tier line, each effect, flavor, etc.) via separate
	 * `MarkdownRenderer.render()` calls, each of which triggers this plugin's
	 * post-processor independently — a per-call Map would reset "already
	 * linked" state between e.g. tier1 and tier2 of the same roll, linking
	 * "damage" or "push" again in each. A WeakMap survives across those
	 * calls for as long as the container itself exists, and re-renders
	 * naturally get a fresh container (and so a fresh entry) instead of manual
	 * cleanup.
	 */
	private linkedTermsByFeature = new WeakMap<Element, Set<string>>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new RuleLinkerSettingTab(this.app, this));

		if (!this.settings.glossarySeeded) {
			await this.seedGlossaryNote().catch(reportError("seed default glossary note"));
			this.settings.glossarySeeded = true;
			await this.saveSettings();
		}

		if (Object.keys(this.settings.terms).length === 0) {
			this.tryAutoIndex().catch(reportError("auto-index glossary on load"));
		}

		this.addCommand({
			id: "rebuild-term-index",
			name: "Rebuild rule term index from glossary",
			callback: () => {
				this.rebuildTermIndex(true).catch(reportError("rebuild term index"));
			},
		});

		this.registerMarkdownPostProcessor((el, ctx) => {
			this.processNode(el, ctx);
		});

		this.registerEditorExtension(createGlossaryReadOnlyExtension((path) => this.isGlossaryPath(path)));
	}

	onunload(): void {
		// No resources held outside the plugin lifecycle to release.
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<RuleLinkerSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			blacklistedFolders: data?.blacklistedFolders ?? [],
			terms: data?.terms ?? {},
			aliases: data?.aliases ?? {},
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private getGlossaryFile(): TFile | null {
		return locateGlossaryFile(this.app, this.settings.glossaryPath, DEFAULT_GLOSSARY_BASENAME);
	}

	/**
	 * Runs once, on the first ever enable (see the `glossarySeeded` guard in
	 * onload): if no glossary note exists anywhere in the vault yet, creates
	 * one at the default path from the bundled template. Never overwrites an
	 * existing note, and never runs again afterward even if that note is
	 * later deleted or moved.
	 */
	private async seedGlossaryNote(): Promise<void> {
		if (this.getGlossaryFile()) return;

		const path = normalizePath(this.settings.glossaryPath || DEFAULT_GLOSSARY_PATH);
		if (this.app.vault.getAbstractFileByPath(path)) return;

		await this.app.vault.create(path, GLOSSARY_TEMPLATE);
		this.settings.glossaryPath = path;
		new Notice(`Draw Steel Rule Term Linker: created "${path}" with the default glossary. See settings to move it.`);
	}

	/**
	 * Recreates the glossary note at its configured path from the bundled
	 * default template, overwriting whatever is there, then rebuilds the
	 * term index against the freshly-written headings. Callers (the
	 * settings tab) are responsible for confirming with the user first when
	 * a note already exists at that path.
	 */
	async restoreDefaultGlossaryNote(): Promise<void> {
		const path = normalizePath(this.settings.glossaryPath || DEFAULT_GLOSSARY_PATH);
		const existing = this.app.vault.getAbstractFileByPath(path);

		let file: TFile;
		if (existing instanceof TFile) {
			await this.app.vault.process(existing, () => GLOSSARY_TEMPLATE);
			file = existing;
		} else {
			file = await this.app.vault.create(path, GLOSSARY_TEMPLATE);
		}

		this.settings.glossaryPath = path;
		await this.saveSettings();

		// Obsidian re-parses a file's headings asynchronously after a write;
		// resolving against metadataCache immediately could still see the
		// old content, so wait for that file's own "changed" event (with a
		// timeout fallback in case it never fires) before rebuilding.
		await this.waitForMetadataCacheUpdate(file);
		await this.rebuildTermIndex(false, file);

		new Notice(`Restored the default glossary note at "${path}" and rebuilt the term index.`);
	}

	private waitForMetadataCacheUpdate(file: TFile, timeoutMs = 2000): Promise<void> {
		return new Promise((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				this.app.metadataCache.offref(eventRef);
				clearTimeout(timer);
				resolve();
			};
			const eventRef = this.app.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path === file.path) finish();
			});
			const timer = setTimeout(finish, timeoutMs);
		});
	}

	private async tryAutoIndex(): Promise<void> {
		const file = this.getGlossaryFile();
		if (!file) return;
		await this.rebuildTermIndex(false, file);
	}

	/**
	 * Resolves the default (plus any user-added) terms and aliases against
	 * the glossary note's current headings. Shared by the first-load
	 * auto-index, the command palette, and the settings tab's button, so
	 * they all prune stale entries and resolve aliases the same way.
	 */
	async rebuildTermIndex(notify: boolean, knownFile?: TFile): Promise<void> {
		const file = knownFile ?? this.getGlossaryFile();
		if (!file) {
			if (notify) {
				new Notice(
					`Could not find the glossary note (looked for "${this.settings.glossaryPath}"). Set its location in settings.`
				);
			}
			return;
		}

		// Default aliases are merged in every rebuild, same as DEFAULT_TERMS.
		this.settings.aliases = { ...this.settings.aliases, ...DEFAULT_ALIASES };

		const wantedNames = new Set([
			...DEFAULT_TERMS,
			...Object.keys(this.settings.terms),
			...Object.values(this.settings.aliases),
		]);
		const resolvedTerms = resolveTermHeadings(this.app, file, wantedNames);

		// An alias (e.g. "XP") has no heading of its own — it links wherever
		// its canonical term (e.g. "Experience") does, so it's resolved from
		// that term's target rather than by heading lookup.
		const resolvedAliases: Record<string, string> = {};
		for (const [alias, canonical] of Object.entries(this.settings.aliases)) {
			const target = resolvedTerms[canonical];
			if (target) resolvedAliases[alias] = target;
		}

		const resolved = { ...resolvedTerms, ...resolvedAliases };

		// A term pointing at this glossary note whose heading is no longer
		// there (renamed, deleted) is pruned rather than left dangling —
		// otherwise it keeps matching and linking to a heading that doesn't
		// exist. Terms pointing elsewhere (a manual custom target) are left
		// alone regardless of what this resolve pass found. An alias whose
		// canonical term stopped resolving is pruned the same way, since it
		// won't be in `resolved` either.
		const glossaryBase = normalizePath(file.path.endsWith(".md") ? file.path.slice(0, -3) : file.path);
		const kept = Object.fromEntries(
			Object.entries(this.settings.terms).filter(([term, target]) => {
				const pointsAtGlossary = normalizePath(target.split("#")[0]) === glossaryBase;
				return !pointsAtGlossary || term in resolved;
			})
		);

		const prunedCount = Object.keys(this.settings.terms).length - Object.keys(kept).length;
		this.settings.terms = { ...kept, ...resolved };
		this.settings.glossaryPath = file.path;
		await this.saveSettings();
		if (notify) {
			const prunedNote = prunedCount > 0 ? `, dropped ${prunedCount} stale` : "";
			new Notice(
				`Resolved ${Object.keys(resolved).length} of ${wantedNames.size} rule terms from "${file.path}"${prunedNote}.`
			);
		}
	}

	private isGlossaryPath(filePath: string): boolean {
		const glossaryPath = this.getGlossaryFile()?.path ?? this.settings.glossaryPath;
		return normalizePath(filePath) === normalizePath(glossaryPath);
	}

	private isExcluded(filePath: string): boolean {
		if (this.isGlossaryPath(filePath)) return true;
		return this.settings.blacklistedFolders.some((folder) => isWithinFolder(filePath, folder));
	}

	/**
	 * Renders rule-term mentions as links straight to their heading in the
	 * glossary note, at view time — no note content is ever edited, so
	 * editing the glossary or the term list takes effect on the next render.
	 */
	private processNode(root: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		const sourcePath = ctx.sourcePath;
		if (this.isExcluded(sourcePath) || Object.keys(this.settings.terms).length === 0) return;

		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode: (node) => {
				const parent = node.parentElement;
				if (!parent || parent.closest(SKIP_PARENT_SELECTOR)) return NodeFilter.FILTER_REJECT;
				if (isSourceEffect(parent)) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			},
		});

		const targets: Text[] = [];
		let current: Node | null;
		while ((current = walker.nextNode())) {
			if (findTermMatches(current.textContent ?? "", this.settings.terms).length > 0) {
				targets.push(current as Text);
			}
		}

		for (const textNode of targets) {
			this.replaceTextNode(textNode, sourcePath);
		}
	}

	/**
	 * Within a single Ability block (`.ds-feature-container`), only the
	 * first mention of each term gets linked — repeats of "Prone" further
	 * down the same Ability stay plain text. Outside any Ability block,
	 * every mention still links; `linkedTermsByFeature` only tracks state
	 * per container, so unrelated prose is never affected by it.
	 */
	private replaceTextNode(textNode: Text, sourcePath: string): void {
		const text = textNode.textContent ?? "";
		let matches = findTermMatches(text, this.settings.terms);
		if (matches.length === 0) return;

		const container = textNode.parentElement?.closest(FEATURE_CONTAINER_SELECTOR) ?? undefined;
		if (container) {
			const seen = this.linkedTermsByFeature.get(container) ?? new Set<string>();
			matches = matches.filter((match) => {
				const key = match.matchedText.toLowerCase();
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			});
			this.linkedTermsByFeature.set(container, seen);
			if (matches.length === 0) return;
		}

		const fragment = createFragment((frag) => {
			let cursor = 0;
			for (const match of matches) {
				if (match.start > cursor) {
					frag.appendText(text.slice(cursor, match.start));
				}
				this.createTermLink(frag, match.matchedText, match.path, sourcePath);
				cursor = match.end;
			}
			if (cursor < text.length) {
				frag.appendText(text.slice(cursor));
			}
		});

		textNode.parentNode?.replaceChild(fragment, textNode);
	}

	private createTermLink(frag: DocumentFragment, displayText: string, targetPath: string, sourcePath: string): void {
		const link = frag.createEl("a", {
			cls: "internal-link ds-rule-term-link",
			text: displayText,
			attr: { href: targetPath, "data-href": targetPath },
		});
		link.addEventListener("click", (evt) => {
			evt.preventDefault();
			this.app.workspace.openLinkText(targetPath, sourcePath).catch(reportError("open rule term link"));
		});
		link.addEventListener("mouseover", (evt: MouseEvent) => {
			this.app.workspace.trigger("hover-link", {
				event: evt,
				source: "drawsteel-rule-term-linker",
				hoverParent: link.parentElement,
				targetEl: link,
				linktext: targetPath,
				sourcePath,
			});
		});
	}
}
