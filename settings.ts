import { App, Notice, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type RuleTermLinkerPlugin from "./main";
import { locateGlossaryFile, resolveTermHeadings } from "./glossary";
import { DEFAULT_TERMS } from "./default-terms";

export const DEFAULT_GLOSSARY_PATH = "ds-glossary.md";
export const DEFAULT_GLOSSARY_BASENAME = "ds-glossary";

export interface RuleLinkerSettings {
	glossaryPath: string;
	blacklistedFolders: string[];
	terms: Record<string, string>;
	/** Set once the plugin has attempted to seed the default glossary note, so it only ever does so on first enable. */
	glossarySeeded: boolean;
}

export const DEFAULT_SETTINGS: RuleLinkerSettings = {
	glossaryPath: DEFAULT_GLOSSARY_PATH,
	blacklistedFolders: [],
	terms: {},
	glossarySeeded: false,
};

export class RuleLinkerSettingTab extends PluginSettingTab {
	plugin: RuleTermLinkerPlugin;

	constructor(app: App, plugin: RuleTermLinkerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Glossary note location")
			.setDesc(
				`Vault path to the glossary note that terms link to, with one heading per term. Defaults to "${DEFAULT_GLOSSARY_PATH}" at the vault root.`
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_GLOSSARY_PATH)
					.setValue(this.plugin.settings.glossaryPath)
					.onChange(async (value) => {
						this.plugin.settings.glossaryPath = value.trim() || DEFAULT_GLOSSARY_PATH;
						await this.plugin.saveSettings();
					})
			)
			.addButton((button) =>
				button.setButtonText("Auto-detect").onClick(async () => {
					const file = locateGlossaryFile(
						this.plugin.app,
						this.plugin.settings.glossaryPath,
						DEFAULT_GLOSSARY_BASENAME
					);
					if (!file) {
						new Notice("Could not find a glossary note in this vault.");
						return;
					}
					this.plugin.settings.glossaryPath = file.path;
					await this.plugin.saveSettings();
					new Notice(`Found glossary note at "${file.path}".`);
					this.display();
				})
			);

		new Setting(containerEl)
			.setName("Rebuild term index")
			.setDesc(
				"Resolve the default rule term list (plus any terms you've added below) against headings in the glossary note."
			)
			.addButton((button) =>
				button
					.setButtonText("Rebuild from glossary")
					.setCta()
					.onClick(async () => {
						const file = locateGlossaryFile(
							this.plugin.app,
							this.plugin.settings.glossaryPath,
							DEFAULT_GLOSSARY_BASENAME
						);
						if (!file) {
							new Notice("Could not find the glossary note. Set its location above first.");
							return;
						}
						const wantedNames = new Set([...DEFAULT_TERMS, ...Object.keys(this.plugin.settings.terms)]);
						const resolved = resolveTermHeadings(this.plugin.app, file, wantedNames);
						this.plugin.settings.terms = { ...this.plugin.settings.terms, ...resolved };
						this.plugin.settings.glossaryPath = file.path;
						await this.plugin.saveSettings();
						new Notice(`Resolved ${Object.keys(resolved).length} of ${wantedNames.size} rule terms.`);
						this.display();
					})
			);

		containerEl.createEl("h3", { text: "Blacklisted folders" });
		containerEl.createEl("p", {
			text: "Notes in these vault folders (and their subfolders) are never scanned for rule terms.",
			cls: "setting-item-description",
		});

		this.plugin.settings.blacklistedFolders.forEach((folder, index) => {
			new Setting(containerEl).addText((text) =>
				text
					.setPlaceholder("Folder/Path")
					.setValue(folder)
					.onChange(async (value) => {
						this.plugin.settings.blacklistedFolders[index] = value.trim();
						await this.plugin.saveSettings();
					})
			).addExtraButton((button) =>
				button
					.setIcon("trash")
					.setTooltip("Remove")
					.onClick(async () => {
						this.plugin.settings.blacklistedFolders.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);
		});

		new Setting(containerEl).addButton((button) =>
			button.setButtonText("Add blacklisted folder").onClick(async () => {
				this.plugin.settings.blacklistedFolders.push("");
				await this.plugin.saveSettings();
				this.display();
			})
		);

		containerEl.createEl("h3", { text: `Rule terms (${Object.keys(this.plugin.settings.terms).length})` });
		containerEl.createEl("p", {
			text: "Term to match in your notes, and the glossary heading it links to. Seeded from a default glossary list; remove any you don't want, or add your own — Rebuild from glossary (above) resolves target headings for anything new.",
			cls: "setting-item-description",
		});

		const sortedTerms = Object.entries(this.plugin.settings.terms).sort((a, b) => a[0].localeCompare(b[0]));
		for (const [term, path] of sortedTerms) {
			new Setting(containerEl)
				.setName(term)
				.addText((text) =>
					text
						.setPlaceholder("ds-glossary#Heading")
						.setValue(path)
						.onChange(async (value) => {
							this.plugin.settings.terms[term] = normalizePath(value.trim());
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Remove")
						.onClick(async () => {
							delete this.plugin.settings.terms[term];
							await this.plugin.saveSettings();
							this.display();
						})
				);
		}

		let newTerm = "";
		let newPath = "";
		new Setting(containerEl)
			.setName("Add term")
			.addText((text) => text.setPlaceholder("Term").onChange((value) => (newTerm = value.trim())))
			.addText((text) => text.setPlaceholder("ds-glossary#Heading").onChange((value) => (newPath = value.trim())))
			.addButton((button) =>
				button.setButtonText("Add").onClick(async () => {
					if (!newTerm || !newPath) {
						new Notice("Enter both a term and a target path.");
						return;
					}
					this.plugin.settings.terms[newTerm] = normalizePath(newPath);
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}
}
