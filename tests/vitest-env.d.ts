import type {} from "vitest";

// Typed contract for globalSetup's provide() → setup.ts/tests' inject().
declare module "vitest" {
  export interface ProvidedContext {
    MONGO_URI: string;
  }
}
