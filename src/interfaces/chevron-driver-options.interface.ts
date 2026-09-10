export type ChevronMemoryDriverOptions = {
    driver?: 'memory';
};

export type EnvChevronStorageOptions = {
    prefix: string;
    env?: Readonly<Record<string, string | undefined>>;
};

export type ChevronEnvDriverOptions = EnvChevronStorageOptions & {
    driver: 'env';
};

export type ChevronStorageDriverOptions = ChevronMemoryDriverOptions | ChevronEnvDriverOptions;
