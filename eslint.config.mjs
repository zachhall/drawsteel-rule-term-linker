import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	// main.js is esbuild's gitignored build output; tests/*.mjs is the
	// Node-native compliance suite (its own thing, not plugin code); and
	// esbuild.config.mjs is local build tooling that legitimately runs
	// under Node, never inside Obsidian, so its Node imports aren't a
	// no-nodejs-modules violation in the way they would be for plugin code.
	{ ignores: ["main.js", "tests/**", "esbuild.config.mjs"] },
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.*"],
				},
			},
		},
		rules: {
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					// "XP" isn't in the rule's built-in acronym allowlist (would
					// otherwise suggest lowercasing it to "Xp").
					acronyms: ["XP"],
					// A specific glossary term name referenced verbatim throughout
					// this plugin's UI/docs, not sentence-start prose, so it keeps
					// its capitalization too.
					ignoreWords: ["Experience"],
					ignoreRegex: [
						// "ds-glossary#Heading" is a literal placeholder showing the
						// target syntax users type (matching the real file
						// ds-glossary.md and the letter-case convention used
						// elsewhere for a heading's own name) -- not prose, so
						// sentence-case's "capitalize the first letter" doesn't apply.
						"ds-glossary#",
						// "e.g. <word>" -- the rule treats the period in "e.g." as a
						// sentence boundary and wants the following word capitalized,
						// which reads as a mid-sentence capitalization error in
						// standard English. These two description strings are
						// otherwise already sentence-case; only this one abbreviation
						// quirk is being intentionally overridden.
						"e\\.g\\. [a-z]",
					],
				},
			],
		},
	},
]);
