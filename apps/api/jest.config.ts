import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@repo/shared/(.*)$": "<rootDir>/../../packages/shared/src/$1",
  },
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
      },
    ],
  },
  setupFiles: ["<rootDir>/src/__tests__/setup.ts"],
  globalSetup: "<rootDir>/src/__tests__/global-setup.ts",
  globalTeardown: "<rootDir>/src/__tests__/global-teardown.ts",
  testTimeout: 30000,
  // Run test suites sequentially to avoid DB conflicts
  maxWorkers: 1,
  verbose: true,
};

export default config;
