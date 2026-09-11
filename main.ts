import { MarkdownPostProcessorContext, Notice, Plugin, TFolder, normalizePath } from "obsidian";
import { buildTermIndexFromCompendium, locateCompendiumFolder } from "./compendium";
import { findTermMatches } from "./linker";
import { DEFAULT_COMPENDIUM_PATH, DEFAULT_SETTINGS, RuleLinkerSettingTab, RuleLinkerSettings } from "./settings";

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

		if (Object.keys(this.settings.terms).length === 0) {
			this.tryAutoIndex().catch(reportError("auto-index Compendium on load"));
		}

		this.addCommand({
			id: "rebuild-term-index",
			name: "Rebuild rule term index from Compendium",
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

	private getCompendiumFolder(): TFolder | null {
		return locateCompendiumFolder(this.app, this.settings.compendiumPath, DEFAULT_COMPENDIUM_PATH);
	}

	private async tryAutoIndex(): Promise<void> {
		const folder = this.getCompendiumFolder();
		if (!folder) return;
		await this.rebuildTermIndex(false, folder);
	}

	private async rebuildTermIndex(notify: boolean, knownFolder?: TFolder): Promise<void> {
		const folder = knownFolder ?? this.getCompendiumFolder();
		if (!folder) {
			if (notify) {
				new Notice(
					`Could not find the DS Compendium (looked for "${this.settings.compendiumPath}"). Set its location in settings.`
				);
			}
			return;
		}
		const scanned = buildTermIndexFromCompendium(folder);
		this.settings.terms = { ...this.settings.terms, ...scanned };
		this.settings.compendiumPath = folder.path;
		await this.saveSettings();
		if (notify) {
			new Notice(`Indexed ${Object.keys(scanned).length} rule terms from "${folder.path}".`);
		}
	}

	private isExcluded(filePath: string): boolean {
		const compendiumPath = this.getCompendiumFolder()?.path ?? this.settings.compendiumPath;
		if (isWithinFolder(filePath, compendiumPath)) return true;
		return this.settings.blacklistedFolders.some((folder) => isWithinFolder(filePath, folder));
	}

	/**
	 * Renders rule-term mentions as native internal links at view time,
	 * without ever touching note content — Compendium updates or edited
	 * term aliases take effect on the next render, no re-processing needed.
	 */
	private processNode(root: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		const sourcePath = ctx.sourcePath;
		if (this.isExcluded(sourcePath) || Object.keys(this.settings.terms).length === 0) return;

		const currentTarget = normalizePath(sourcePath.endsWith(".md") ? sourcePath.slice(0, -3) : sourcePath);
		const terms = Object.fromEntries(
			Object.entries(this.settings.terms).filter(([, path]) => normalizePath(path) !== currentTarget)
		);
		if (Object.keys(terms).length === 0) return;

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
			if (findTermMatches(current.textContent ?? "", terms).length > 0) {
				targets.push(current as Text);
			}
		}

		for (const textNode of targets) {
			this.replaceTextNode(textNode, terms, sourcePath);
		}
	}

	private replaceTextNode(textNode: Text, terms: Record<string, string>, sourcePath: string): void {
		const text = textNode.textContent ?? "";
		const matches = findTermMatches(text, terms);
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
