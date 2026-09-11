import { App, TFile, TFolder, normalizePath } from "obsidian";

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

/**
 * Resolves only the requested term names against notes in the Compendium,
 * matching by filename (case-insensitive). Unlike a full index of every
 * Compendium note, this keeps the plugin's active term list limited to
 * the curated default set plus whatever the user has added.
 */
export function resolveTermPaths(folder: TFolder, termNames: Iterable<string>): Record<string, string> {
	const wanted = new Map<string, string>();
	for (const name of termNames) {
		wanted.set(name.toLowerCase(), name);
	}

	const resolved: Record<string, string> = {};

	const walk = (current: TFolder): void => {
		for (const child of current.children) {
			if (child instanceof TFolder) {
				walk(child);
			} else if (child instanceof TFile && child.extension === "md") {
				const term = wanted.get(child.basename.toLowerCase());
				if (term && !(term in resolved)) {
					resolved[term] = child.path.slice(0, -child.extension.length - 1);
				}
			}
		}
	};

	walk(folder);
	return resolved;
}
