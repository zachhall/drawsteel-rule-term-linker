import { normalizePath } from "obsidian";

export interface LinkResult {
	text: string;
	linksAdded: number;
}

const PROTECTED_PATTERNS: RegExp[] = [
	/^---\n[\s\S]*?\n---\n/,
	/```[\s\S]*?```/g,
	/~~~[\s\S]*?~~~/g,
	/`[^`\n]*`/g,
	/\[\[[^\]]*\]\]/g,
	/\[[^\]]*\]\([^)]*\)/g,
];

function findProtectedRanges(text: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	for (const pattern of PROTECTED_PATTERNS) {
		const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
		let match: RegExpExecArray | null;
		while ((match = re.exec(text))) {
			ranges.push([match.index, match.index + match[0].length]);
			if (match[0].length === 0) {
				re.lastIndex += 1;
			}
		}
	}
	return ranges;
}

function isProtected(start: number, length: number, ranges: Array<[number, number]>): boolean {
	const end = start + length;
	return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
}

function stripExtension(path: string): string {
	return path.endsWith(".md") ? path.slice(0, -3) : path;
}

/**
 * Rewrites the first mention of each configured term into a `[[target|term]]`
 * wikilink, skipping frontmatter, code, and text already inside a link.
 */
export function linkTermsInText(text: string, terms: Record<string, string>, currentPath: string): LinkResult {
	const entries = Object.entries(terms).filter(([term]) => term.trim().length > 0);
	if (entries.length === 0) {
		return { text, linksAdded: 0 };
	}

	// Longest term first so e.g. "Exploration Skills" wins over "Skills".
	entries.sort((a, b) => b[0].length - a[0].length);
	const lookup = new Map(entries.map(([term, path]) => [term.toLowerCase(), { term, path }]));
	const escaped = entries.map(([term]) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

	const protectedRanges = findProtectedRanges(text);
	const currentTarget = normalizePath(stripExtension(currentPath));
	const linked = new Set<string>();

	let result = "";
	let cursor = 0;
	let linksAdded = 0;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text))) {
		const matchedText = match[0];
		const start = match.index;
		const key = matchedText.toLowerCase();

		if (isProtected(start, matchedText.length, protectedRanges) || linked.has(key)) {
			continue;
		}

		const entry = lookup.get(key);
		if (!entry || normalizePath(entry.path) === currentTarget) {
			continue;
		}

		result += text.slice(cursor, start);
		result += `[[${entry.path}|${matchedText}]]`;
		cursor = start + matchedText.length;
		linked.add(key);
		linksAdded += 1;
	}
	result += text.slice(cursor);

	return { text: result, linksAdded };
}
