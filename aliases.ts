/**
 * A term that links wherever another term does, instead of its own
 * glossary heading — e.g. "XP" has no `### XP` heading, but should link
 * to `### Experience`. Maps alias -> the canonical term name it stands
 * in for; resolved to that term's actual target during a rebuild.
 */
export const DEFAULT_ALIASES: Record<string, string> = {
	XP: "Experience",
};
