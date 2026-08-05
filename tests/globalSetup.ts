import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

// One in-memory replica set for the whole run — replica-set mode so the
// transaction code in lib/game/resolve.ts runs for real in tests.
// (The ProvidedContext augmentation for "MONGO_URI" lives in tests/setup.ts.)
let replSet: MongoMemoryReplSet;

export async function setup(project: TestProject) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide("MONGO_URI", replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}
