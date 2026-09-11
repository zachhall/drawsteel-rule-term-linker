import { MarkdownPostProcessorContext, Notice, Plugin, TFile, normalizePath } from "obsidian";
import { DEFAULT_TERMS } from "./default-terms";
import GLOSSARY_TEMPLATE from "./ds-glossary.md";
import { locateGlossaryFile, resolveTermHeadings } from "./glossary";
import { findTermMatches } from "./linker";
import {
	DEFAULT_GLOSSARY_BASENAME,
	DEFAULT_GLOSSARY_PATH,
	DEFAULT_SETTINGS,
	RuleLinkerSettingTab,
	RuleLinkerSettings,
} from "./settings";

const SKIP_PARENT_SELECTOR = "code, pre, a, button, input, textarea, select";

export function reportError(context: string): (err: unknown) => void {
	return (err: unknown) => console.error(`Draw Steel Rule Term Linker: ${context} failed`, err);
}

function isWithinFolder(filePath: string, folderPath: string): boolean {
	if (!folderPath) return false;
	const normalizedFolder = normalizePath(folderPath);
	return filePath === normalizedFolder || filePath.startsWith(`${normalizedFolder}/`);
}

export default class RuleTermLinkerPlugin extends Plugin {
	settings: RuleLinkerSettings = DEFAULT_SETTINGS;

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

	private async tryAutoIndex(): Promise<void> {
		const file = this.getGlossaryFile();
		if (!file) return;
		await this.rebuildTermIndex(false, file);
	}

	private async rebuildTermIndex(notify: boolean, knownFile?: TFile): Promise<void> {
		const file = knownFile ?? this.getGlossaryFile();
		if (!file) {
			if (notify) {
				new Notice(
					`Could not find the glossary note (looked for "${this.settings.glossaryPath}"). Set its location in settings.`
				);
			}
			return;
		}
		const wantedNames = new Set([...DEFAULT_TERMS, ...Object.keys(this.settings.terms)]);
		const resolved = resolveTermHeadings(this.app, file, wantedNames);
		this.settings.terms = { ...this.settings.terms, ...resolved };
		this.settings.glossaryPath = file.path;
		await this.saveSettings();
		if (notify) {
			new Notice(`Resolved ${Object.keys(resolved).length} of ${wantedNames.size} rule terms from "${file.path}".`);
		}
	}

	private isExcluded(filePath: string): boolean {
		const glossaryPath = this.getGlossaryFile()?.path ?? this.settings.glossaryPath;
		if (normalizePath(filePath) === normalizePath(glossaryPath)) return true;
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

	private replaceTextNode(textNode: Text, sourcePath: string): void {
		const text = textNode.textContent ?? "";
		const matches = findTermMatches(text, this.settings.terms);
		if (matches.length === 0) return;

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
