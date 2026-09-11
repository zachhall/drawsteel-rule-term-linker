import { MarkdownView, Notice, Plugin, TFile, TFolder, normalizePath } from "obsidian";
import { buildTermIndexFromCompendium, locateCompendiumFolder } from "./compendium";
import { linkTermsInText } from "./linker";
import { DEFAULT_COMPENDIUM_PATH, DEFAULT_SETTINGS, RuleLinkerSettingTab, RuleLinkerSettings } from "./settings";

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
			id: "link-terms-current-note",
			name: "Link rule terms in current note",
			editorCallback: (editor, view) => {
				if (!(view instanceof MarkdownView) || !view.file) return;
				this.linkCurrentNote(view.file, editor).catch(reportError("link terms in current note"));
			},
		});

		this.addCommand({
			id: "link-terms-entire-vault",
			name: "Link rule terms in entire vault",
			callback: () => {
				this.linkEntireVault().catch(reportError("link terms in entire vault"));
			},
		});

		this.addCommand({
			id: "rebuild-term-index",
			name: "Rebuild rule term index from Compendium",
			callback: () => {
				this.rebuildTermIndex(true).catch(reportError("rebuild term index"));
			},
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

	private async linkCurrentNote(
		file: TFile,
		editor: { getValue(): string; setValue(value: string): void }
	): Promise<void> {
		if (this.isExcluded(file.path)) {
			new Notice("This note is in the Compendium or a blacklisted folder — skipped.");
			return;
		}
		const { text, linksAdded } = linkTermsInText(editor.getValue(), this.settings.terms, file.path);
		if (linksAdded > 0) {
			editor.setValue(text);
		}
		new Notice(linksAdded > 0 ? `Linked ${linksAdded} rule term(s).` : "No new rule terms found.");
	}

	private async linkEntireVault(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles().filter((file) => !this.isExcluded(file.path));
		let totalLinks = 0;
		let notesChanged = 0;

		for (const file of files) {
			let linksAdded = 0;
			await this.app.vault.process(file, (data) => {
				const result = linkTermsInText(data, this.settings.terms, file.path);
				linksAdded = result.linksAdded;
				return result.text;
			});
			if (linksAdded > 0) {
				totalLinks += linksAdded;
				notesChanged += 1;
			}
		}

		new Notice(`Linked ${totalLinks} rule term(s) across ${notesChanged} note(s).`);
	}
}
