import { MongoClient, type Db } from "mongodb";

const dbName = process.env.MONGODB_DB || "scriptwriter";

type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongoCache: MongoCache | undefined;
}

const cache = global._mongoCache ?? (global._mongoCache = { client: null, promise: null });

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define MONGODB_URI in your environment variables.");
  }

  if (cache.client) return cache.client.db(dbName);

  if (!cache.promise) {
    const client = new MongoClient(uri);
    cache.promise = client.connect();
  }

  cache.client = await cache.promise;
  return cache.client.db(dbName);
}