export function assertStorageOptionKeys(options: object, allowedKeys: readonly string[], label: string): void {
    const allowed = new Set(allowedKeys);

    for (const key of Object.keys(options)) {
        if (!allowed.has(key)) {
            throw new TypeError(`${label} does not accept "${key}".`);
        }
    }
}
