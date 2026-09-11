import { App, Notice, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type RuleTermLinkerPlugin from "./main";
import { buildTermIndexFromCompendium, locateCompendiumFolder } from "./compendium";

export const DEFAULT_COMPENDIUM_PATH = "DS Compendium";

export interface RuleLinkerSettings {
	compendiumPath: string;
	blacklistedFolders: string[];
	terms: Record<string, string>;
}

export const DEFAULT_SETTINGS: RuleLinkerSettings = {
	compendiumPath: DEFAULT_COMPENDIUM_PATH,
	blacklistedFolders: [],
	terms: {},
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
			.setName("Compendium location")
			.setDesc(
				`Vault path to the DS Compendium folder installed via the "Draw Steel Elements" plugin. Defaults to "${DEFAULT_COMPENDIUM_PATH}" at the vault root.`
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_COMPENDIUM_PATH)
					.setValue(this.plugin.settings.compendiumPath)
					.onChange(async (value) => {
						this.plugin.settings.compendiumPath = value.trim() || DEFAULT_COMPENDIUM_PATH;
						await this.plugin.saveSettings();
					})
			)
			.addButton((button) =>
				button.setButtonText("Auto-detect").onClick(async () => {
					const folder = locateCompendiumFolder(
						this.plugin.app,
						this.plugin.settings.compendiumPath,
						DEFAULT_COMPENDIUM_PATH
					);
					if (!folder) {
						new Notice("Could not find a DS Compendium folder in this vault.");
						return;
					}
					this.plugin.settings.compendiumPath = folder.path;
					await this.plugin.saveSettings();
					new Notice(`Found Compendium at "${folder.path}".`);
					this.display();
				})
			);

		new Setting(containerEl)
			.setName("Rebuild term index")
			.setDesc("Scan the Compendium folder and (re)populate the term list below from its note titles.")
			.addButton((button) =>
				button
					.setButtonText("Rebuild from Compendium")
					.setCta()
					.onClick(async () => {
						const folder = locateCompendiumFolder(
							this.plugin.app,
							this.plugin.settings.compendiumPath,
							DEFAULT_COMPENDIUM_PATH
						);
						if (!folder) {
							new Notice("Could not find the Compendium folder. Set its location above first.");
							return;
						}
						const scanned = buildTermIndexFromCompendium(folder);
						this.plugin.settings.terms = { ...this.plugin.settings.terms, ...scanned };
						await this.plugin.saveSettings();
						new Notice(`Indexed ${Object.keys(scanned).length} rule terms.`);
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
			text: "Term to match in your notes, and the Compendium note it links to. Rebuild from the Compendium above, or add entries manually for terms that need a custom target.",
			cls: "setting-item-description",
		});

		const sortedTerms = Object.entries(this.plugin.settings.terms).sort((a, b) => a[0].localeCompare(b[0]));
		for (const [term, path] of sortedTerms) {
			new Setting(containerEl)
				.setName(term)
				.addText((text) =>
					text
						.setPlaceholder("Compendium/Path/To/Note")
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
			.addText((text) =>
				text.setPlaceholder("Compendium/Path/To/Note").onChange((value) => (newPath = value.trim()))
			)
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
