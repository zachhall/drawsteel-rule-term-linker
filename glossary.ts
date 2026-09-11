import { App, TFile, normalizePath } from "obsidian";

export function findFile(obsidianApp: App, path: string): TFile | null {
	if (!path.trim()) return null;
	const abstractFile = obsidianApp.vault.getAbstractFileByPath(normalizePath(path));
	return abstractFile instanceof TFile ? abstractFile : null;
}

export function findFileByBasename(obsidianApp: App, basename: string): TFile | null {
	const lowered = basename.toLowerCase();
	for (const file of obsidianApp.vault.getAllLoadedFiles()) {
		if (file instanceof TFile && file.extension === "md" && file.basename.toLowerCase() === lowered) {
			return file;
		}
	}
	return null;
}

export function locateGlossaryFile(obsidianApp: App, configuredPath: string, fallbackBasename: string): TFile | null {
	return findFile(obsidianApp, configuredPath) ?? findFileByBasename(obsidianApp, fallbackBasename);
}

function stripExtension(path: string): string {
	return path.endsWith(".md") ? path.slice(0, -3) : path;
}

/**
 * Resolves the requested term names against headings actually present in
 * the glossary note, so removing/renaming a heading there drops or breaks
 * that term's link target on the next rebuild rather than silently.
 */
export function resolveTermHeadings(obsidianApp: App, file: TFile, termNames: Iterable<string>): Record<string, string> {
	const wanted = new Map<string, string>();
	for (const name of termNames) {
		wanted.set(name.toLowerCase(), name);
	}

	const headings = obsidianApp.metadataCache.getFileCache(file)?.headings ?? [];
	const basePath = stripExtension(file.path);
	const resolved: Record<string, string> = {};

	for (const heading of headings) {
		const term = wanted.get(heading.heading.toLowerCase());
		if (term && !(term in resolved)) {
			resolved[term] = `${basePath}#${heading.heading}`;
		}
	}

	return resolved;
}
