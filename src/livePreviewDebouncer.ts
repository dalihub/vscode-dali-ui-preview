export class LivePreviewDebouncer<T> {
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(
        private debounceMs: number,
        private readonly onTrigger: (value: T) => void
    ) {}

    schedule(value: T): void {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.onTrigger(value);
        }, this.debounceMs);
    }

    cancel(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
    }

    get isPending(): boolean {
        return this.timer !== undefined;
    }

    setDebounceMs(ms: number): void {
        this.debounceMs = ms;
    }

    dispose(): void {
        this.cancel();
    }
}
