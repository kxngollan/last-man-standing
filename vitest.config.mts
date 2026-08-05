import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Boots one in-memory Mongo replica set (transactions need a replica set)
    // shared by all workers; each worker gets its own database (see setup.ts).
    globalSetup: ["tests/globalSetup.ts"],
    setupFiles: ["tests/setup.ts"],
    hookTimeout: 120_000, // first run downloads the mongod binary
    testTimeout: 30_000,
  },
});
