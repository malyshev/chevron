export type ChevronMemoryDriverOptions = {
    driver?: 'memory';
};

export type ChevronEnvDriverOptions = {
    driver: 'env';
    prefix: string;
    overlay?: boolean;
    nameTransform?: 'camelCase';
    env?: Readonly<Record<string, string | undefined>>;
};

export type ChevronDatabaseDriverOptions = {
    driver: 'database';
};

export type ChevronStorageDriverOptions =
    ChevronMemoryDriverOptions | ChevronEnvDriverOptions | ChevronDatabaseDriverOptions;
