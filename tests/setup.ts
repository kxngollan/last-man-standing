import { inject } from "vitest";

// Runs in each worker before any app module loads — database/connect.ts reads
// these at import time. Each worker gets its own database name so parallel
// test files never see each other's data.
process.env.MONGO_DB_URI = inject("MONGO_URI");
process.env.MONGO_DB_NAME = `test_${process.pid}_${Math.floor(Math.random() * 1e9)}`;
