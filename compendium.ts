import { App, TFile, TFolder, normalizePath } from "obsidian";

const SKIPPED_BASENAMES = new Set(["readme", "license"]);

function shouldSkipFile(file: TFile): boolean {
	const basename = file.basename.toLowerCase();
	return basename.startsWith("_") || SKIPPED_BASENAMES.has(basename);
}

export function findFolder(obsidianApp: App, path: string): TFolder | null {
	if (!path.trim()) return null;
	const abstractFile = obsidianApp.vault.getAbstractFileByPath(normalizePath(path));
	return abstractFile instanceof TFolder ? abstractFile : null;
}

export function findFolderByName(obsidianApp: App, name: string): TFolder | null {
	const lowered = name.toLowerCase();
	for (const file of obsidianApp.vault.getAllLoadedFiles()) {
		if (file instanceof TFolder && file.name.toLowerCase() === lowered) {
			return file;
		}
	}
	return null;
}

export function locateCompendiumFolder(obsidianApp: App, configuredPath: string, fallbackName: string): TFolder | null {
	return findFolder(obsidianApp, configuredPath) ?? findFolderByName(obsidianApp, fallbackName);
}

export function buildTermIndexFromCompendium(folder: TFolder): Record<string, string> {
	const terms: Record<string, string> = {};

	const walk = (current: TFolder): void => {
		for (const child of current.children) {
			if (child instanceof TFolder) {
				walk(child);
			} else if (child instanceof TFile && child.extension === "md" && !shouldSkipFile(child)) {
				if (!(child.basename in terms)) {
					terms[child.basename] = child.path.slice(0, -child.extension.length - 1);
				}
			}
		}
	};

	walk(folder);
	return terms;
}
