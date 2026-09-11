import { App, Notice, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type RuleTermLinkerPlugin from "./main";
import { ConfirmModal } from "./confirm-modal";
import { reportError } from "./errors";
import { locateGlossaryFile } from "./glossary";

export const DEFAULT_GLOSSARY_PATH = "ds-glossary.md";
export const DEFAULT_GLOSSARY_BASENAME = "ds-glossary";

export interface RuleLinkerSettings {
	glossaryPath: string;
	blacklistedFolders: string[];
	terms: Record<string, string>;
	/** Alias term -> the canonical term name it should link like (e.g. "XP" -> "Experience"). */
	aliases: Record<string, string>;
	/** Set once the plugin has attempted to seed the default glossary note, so it only ever does so on first enable. */
	glossarySeeded: boolean;
}

export const DEFAULT_SETTINGS: RuleLinkerSettings = {
	glossaryPath: DEFAULT_GLOSSARY_PATH,
	blacklistedFolders: [],
	terms: {},
	aliases: {},
	glossarySeeded: false,
};

export class RuleLinkerSettingTab extends PluginSettingTab {
	plugin: RuleTermLinkerPlugin;
	// Not persisted — just keeps "Advanced settings" from re-collapsing on
	// every display() re-render (e.g. after clicking Rebuild from glossary)
	// within a single time the settings tab is open.
	private advancedOpen = false;

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
			.setName("Restore default glossary note")
			.setDesc(
				"Recreate the default glossary note at the location above and rebuild the term index against it. The note is locked against normal editing once created, so you shouldn't need this often — it's here for edge cases (e.g. content that drifted via sync or another plugin). If a note already exists there, you'll be asked to confirm before it's overwritten."
			)
			.addButton((button) =>
				button
					.setButtonText("Restore default glossary note")
					.setWarning()
					.onClick(async () => {
						const path = normalizePath(this.plugin.settings.glossaryPath || DEFAULT_GLOSSARY_PATH);
						const existing = this.plugin.app.vault.getAbstractFileByPath(path);

						const restore = () => {
							this.plugin.restoreDefaultGlossaryNote().catch(reportError("restore default glossary note"));
						};

						if (existing) {
							new ConfirmModal(
								this.plugin.app,
								"Overwrite existing glossary note?",
								`Continuing will rewrite "${path}" to its default state, potentially losing any changes you've made to it. This can't be undone.`,
								"Overwrite",
								restore
							).open();
						} else {
							restore();
						}
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
			text: "Term to match in your notes, and the glossary heading it links to. Seeded from a default glossary list; remove any you don't want, or add your own.",
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

		containerEl.createEl("h3", { text: `Term aliases (${Object.keys(this.plugin.settings.aliases).length})` });
		containerEl.createEl("p", {
			text: 'A term that links wherever another term does, instead of its own heading — e.g. "XP" links wherever "Experience" does.',
			cls: "setting-item-description",
		});

		const sortedAliases = Object.entries(this.plugin.settings.aliases).sort((a, b) => a[0].localeCompare(b[0]));
		for (const [alias, canonical] of sortedAliases) {
			new Setting(containerEl)
				.setName(alias)
				.addText((text) =>
					text
						.setPlaceholder("Canonical term")
						.setValue(canonical)
						.onChange(async (value) => {
							this.plugin.settings.aliases[alias] = value.trim();
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Remove")
						.onClick(async () => {
							delete this.plugin.settings.aliases[alias];
							await this.plugin.saveSettings();
							this.display();
						})
				);
		}

		let newAlias = "";
		let newCanonical = "";
		new Setting(containerEl)
			.setName("Add alias")
			.addText((text) => text.setPlaceholder("Alias (e.g. XP)").onChange((value) => (newAlias = value.trim())))
			.addText((text) =>
				text.setPlaceholder("Canonical term (e.g. Experience)").onChange((value) => (newCanonical = value.trim()))
			)
			.addButton((button) =>
				button.setButtonText("Add").onClick(async () => {
					if (!newAlias || !newCanonical) {
						new Notice("Enter both an alias and the term it should link like.");
						return;
					}
					this.plugin.settings.aliases[newAlias] = newCanonical;
					await this.plugin.saveSettings();
					// An alias has no target of its own until it's resolved against
					// its canonical term — without this, a newly-added alias would
					// silently do nothing until the user separately hit Rebuild.
					await this.plugin.rebuildTermIndex(true).catch(reportError("rebuild term index"));
					this.display();
				})
			);

		const advanced = containerEl.createEl("details", { cls: "ds-rule-linker-advanced" });
		advanced.open = this.advancedOpen;
		advanced.addEventListener("toggle", () => {
			this.advancedOpen = advanced.open;
		});
		advanced.createEl("summary", { text: "Advanced settings" });
		advanced.createEl("p", {
			text: "For troubleshooting only — restoring the default glossary note and adding an alias already keep everything above in sync automatically. You shouldn't need this unless something's gone wrong (e.g. the glossary note was edited outside Obsidian).",
			cls: "setting-item-description ds-rule-linker-advanced-warning",
		});

		new Setting(advanced)
			.setName("Rebuild term index")
			.setDesc(
				"Resolve the default rule term list and aliases (plus anything you've added above) against headings currently in the glossary note, and drop any term whose heading no longer exists."
			)
			.addButton((button) =>
				button
					.setButtonText("Rebuild from glossary")
					.setWarning()
					.onClick(async () => {
						await this.plugin.rebuildTermIndex(true).catch(reportError("rebuild term index"));
						this.display();
					})
			);
	}
}
