import { DEFAULT_CHEVRON_NAME } from '../chevron.constants';
import { ChevronModuleOptions } from '../interfaces';

const registeredGateNames = new Set<string>();
const shutdownCompletedGateNames = new Set<string>();

export function resetRegisteredGateNamesForTesting(): void {
    registeredGateNames.clear();
    shutdownCompletedGateNames.clear();
}

export function isGateShutdownComplete(name: string | symbol): boolean {
    return shutdownCompletedGateNames.has(String(name));
}

export function markGateShutdownComplete(name: string | symbol): void {
    shutdownCompletedGateNames.add(String(name));
}

export function releaseRegisteredGateName(name: string | symbol): void {
    registeredGateNames.delete(String(name));
}

export function assertGateNameNotExplicitDefault(options: Pick<ChevronModuleOptions, 'name'>): void {
    if (options.name === DEFAULT_CHEVRON_NAME) {
        throw new Error('Omit "name" for the default gate instead of using name: "default".');
    }
}

export function assertGateNameAvailable(name: string | symbol): void {
    const key = String(name);

    if (registeredGateNames.has(key)) {
        throw new Error(`Chevron "${key}" is already registered.`);
    }

    registeredGateNames.add(key);
    shutdownCompletedGateNames.delete(key);
}
