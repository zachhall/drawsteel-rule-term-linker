export function reportError(context: string): (err: unknown) => void {
	return (err: unknown) => console.error(`Draw Steel Rule Term Linker: ${context} failed`, err);
}
