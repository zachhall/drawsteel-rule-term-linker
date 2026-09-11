export interface TermMatch {
	start: number;
	end: number;
	matchedText: string;
	path: string;
}

/**
 * Finds every mention of a configured rule term in `text`, longest term
 * first so e.g. "Exploration Skills" wins over the bare "Skills" match.
 * Case-insensitive, word-bounded; does not consider markdown structure —
 * callers are responsible for skipping code/links/frontmatter.
 */
export function findTermMatches(text: string, terms: Record<string, string>): TermMatch[] {
	const entries = Object.entries(terms).filter(([term]) => term.trim().length > 0);
	if (entries.length === 0) return [];

	entries.sort((a, b) => b[0].length - a[0].length);
	const lookup = new Map(entries.map(([term, path]) => [term.toLowerCase(), path]));
	const escaped = entries.map(([term]) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

	const matches: TermMatch[] = [];
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text))) {
		const matchedText = match[0];
		const path = lookup.get(matchedText.toLowerCase());
		if (path) {
			matches.push({ start: match.index, end: match.index + matchedText.length, matchedText, path });
		}
	}
	return matches;
}
