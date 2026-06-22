import { resolve } from "node:path";
import { MemoryLifeOSStore } from "./memory.js";
import { SqliteLifeOSStore } from "./sqlite/sqliteStore.js";
import { LifeOSStorage } from "./types.js";

export type StorageConfig =
  | {
      driver: "memory";
    }
  | {
      driver: "sqlite";
      sqlitePath: string;
    };

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const driver = env.LIFEOS_STORAGE_DRIVER === "memory" ? "memory" : "sqlite";
  if (driver === "memory") {
    return { driver };
  }

  return {
    driver,
    sqlitePath: resolve(env.LIFEOS_SQLITE_PATH ?? ".lifeos/lifeos.dev.sqlite")
  };
}

export function createConfiguredStore(config = getStorageConfig()): LifeOSStorage {
  if (config.driver === "memory") {
    return new MemoryLifeOSStore();
  }
  return new SqliteLifeOSStore(config.sqlitePath);
}

