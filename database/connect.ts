import mongoose from "mongoose";

const MONGO_DB_URI = process.env.MONGO_DB_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

// Reuse the connection across hot-reloads (dev) and serverless invocations.
const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
if (!global._mongooseCache) global._mongooseCache = cache;

/**
 * Connect to MongoDB, reusing a cached connection. Throws if MONGO_DB_URI is unset.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGO_DB_URI || !MONGO_DB_NAME) {
    throw new Error("MONGO_DB_URI is not set. Add it to .env.local.");
  }
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGO_DB_URI, { bufferCommands: false, dbName:MONGO_DB_NAME });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}
