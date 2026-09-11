import { App, Modal, Setting } from "obsidian";
import { styleAsDestructive } from "./ui-helpers";

export class ConfirmModal extends Modal {
	constructor(
		app: App,
		title: string,
		private readonly message: string,
		private readonly confirmText: string,
		private readonly onConfirm: () => void
	) {
		super(app);
		this.setTitle(title);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.message });
		new Setting(contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) => {
				button.setButtonText(this.confirmText).onClick(() => {
					this.close();
					this.onConfirm();
				});
				styleAsDestructive(button);
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
