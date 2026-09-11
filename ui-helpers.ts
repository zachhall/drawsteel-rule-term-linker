import { ButtonComponent } from "obsidian";

/**
 * `ButtonComponent#setDestructive` replaced `setWarning` in Obsidian
 * 1.13.0, which is well above this plugin's declared minAppVersion — calling
 * it unconditionally would throw as soon as the settings tab renders on
 * any older client. Feature-detected the same way Obsidian's own
 * changelog recommends for version-gated additions (e.g. SliderComponent's
 * setInstant): use the new method when present, fall back to the old
 * (deprecated but still functional) one otherwise.
 */
export function styleAsDestructive(button: ButtonComponent): void {
	const withSetDestructive = button as unknown as { setDestructive?: () => ButtonComponent };
	if (typeof withSetDestructive.setDestructive === "function") {
		withSetDestructive.setDestructive();
	} else {
		button.setWarning();
	}
}
