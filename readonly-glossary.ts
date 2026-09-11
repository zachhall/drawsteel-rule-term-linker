import { EditorState, Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorInfoField } from "obsidian";

/**
 * Blocks edits to the glossary note's editor (Source mode and Live
 * Preview) — typing, paste, drag-and-drop, cut, and undo all become no-ops
 * for that file, while every other note's editor is untouched. Reading
 * view is unaffected either way (it was never editable in the first
 * place), and nothing here touches Vault.modify/process, so the plugin's
 * own restoreDefaultGlossaryNote() and seedGlossaryNote() still work —
 * this only locks the interactive editor a user types into.
 *
 * `EditorState.readOnly` and `EditorView.editable` are computed per editor
 * instance from Obsidian's `editorInfoField` (the CM6 StateField Obsidian
 * uses to expose the associated file to extensions), so the check re-runs
 * whenever that field changes rather than being fixed at extension-load
 * time — covers the file being renamed/reopened without reloading the
 * plugin.
 */
export function createGlossaryReadOnlyExtension(isGlossaryPath: (path: string) => boolean): Extension {
	const isLocked = (state: EditorState): boolean => {
		const path = state.field(editorInfoField, false)?.file?.path;
		return path ? isGlossaryPath(path) : false;
	};

	return [
		EditorState.readOnly.compute([editorInfoField], isLocked),
		EditorView.editable.compute([editorInfoField], (state) => !isLocked(state)),
	];
}
