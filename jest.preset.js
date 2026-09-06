/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    moduleFileExtensions: ['js', 'json', 'ts'],
    testRegex: '.*\\.spec\\.ts$',
    transform: {
        '^.+\\.(t|j)s$': [
            'ts-jest',
            {
                tsconfig: '<rootDir>/../tsconfig.spec.json',
            },
        ],
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/', 'index\\.ts$'],
};
