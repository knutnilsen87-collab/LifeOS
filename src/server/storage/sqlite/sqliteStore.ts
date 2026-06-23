import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { LifeOSStorage, Repository } from "../types.js";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
type DatabaseSyncType = import("node:sqlite").DatabaseSync;

type Row = {
  payload: string;
};

class SqliteJsonRepository<T> implements Repository<T> {
  constructor(
    private readonly db: DatabaseSyncType,
    private readonly tableName: string,
    private readonly idColumn: string
  ) {}

  get(id: string) {
    const row = this.db.prepare(`SELECT payload FROM ${this.tableName} WHERE ${this.idColumn} = ?`).get(id) as Row | undefined;
    return row ? (JSON.parse(row.payload) as T) : undefined;
  }

  set(id: string, value: T) {
    this.db
      .prepare(
        `INSERT INTO ${this.tableName} (${this.idColumn}, payload, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(${this.idColumn}) DO UPDATE SET
           payload = excluded.payload,
           updated_at = CURRENT_TIMESTAMP`
      )
      .run(id, JSON.stringify(value));
  }

  values() {
    const rows = this.db.prepare(`SELECT payload FROM ${this.tableName} ORDER BY created_at ASC, rowid ASC`).all() as Row[];
    return rows.map((row) => JSON.parse(row.payload) as T);
  }

  clear() {
    this.db.prepare(`DELETE FROM ${this.tableName}`).run();
  }

  get size() {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`).get() as { count: number };
    return Number(row.count);
  }
}

export class SqliteLifeOSStore implements LifeOSStorage {
  readonly driver = "sqlite";
  private readonly db: DatabaseSyncType;

  events: Repository<import("../../../shared/types.js").EventRecord>;
  bootstrapReviews: Repository<import("../../../shared/types.js").BootstrapReview>;
  bootstrapCards: Repository<import("../../../shared/types.js").BootstrapReviewCard>;
  candidates: Repository<import("../../../shared/types.js").MemoryCandidate>;
  memoryItems: Repository<import("../../../shared/types.js").MemoryItem>;
  interactionSignals: Repository<import("../../../shared/types.js").InteractionSignal>;
  focusStates: Repository<import("../../../shared/types.js").FocusState>;
  lifeEntities: Repository<import("../../../shared/types.js").LifeEntity>;
  lifeObjects: Repository<import("../../../shared/types.js").LifeObject>;
  privacyAudits: Repository<import("../../../shared/types.js").PrivacyAuditEntry>;
  actionProposals: Repository<import("../../../shared/types.js").ActionProposal>;
  integrationSources: Repository<import("../../../shared/types.js").IntegrationSource>;
  briefings: Repository<import("../../../shared/types.js").Briefing>;
  operatingModes: Repository<import("../../../shared/types.js").OperatingModeState>;

  constructor(sqlitePath: string) {
    const resolvedPath = sqlitePath === ":memory:" ? sqlitePath : resolve(sqlitePath);
    if (resolvedPath !== ":memory:") {
      mkdirSync(dirname(resolvedPath), { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    this.initialize();
    this.events = new SqliteJsonRepository(this.db, "events", "event_id");
    this.bootstrapReviews = new SqliteJsonRepository(this.db, "bootstrap_reviews", "bootstrap_id");
    this.bootstrapCards = new SqliteJsonRepository(this.db, "bootstrap_review_cards", "card_id");
    this.candidates = new SqliteJsonRepository(this.db, "memory_candidates", "candidate_id");
    this.memoryItems = new SqliteJsonRepository(this.db, "memory_items", "memory_id");
    this.interactionSignals = new SqliteJsonRepository(this.db, "interaction_signals", "signal_id");
    this.focusStates = new SqliteJsonRepository(this.db, "focus_states", "user_id");
    this.lifeEntities = new SqliteJsonRepository(this.db, "life_entities", "entity_id");
    this.lifeObjects = new SqliteJsonRepository(this.db, "life_objects", "object_id");
    this.privacyAudits = new SqliteJsonRepository(this.db, "privacy_audits", "audit_id");
    this.actionProposals = new SqliteJsonRepository(this.db, "action_proposals", "proposal_id");
    this.integrationSources = new SqliteJsonRepository(this.db, "integration_sources", "integration_id");
    this.briefings = new SqliteJsonRepository(this.db, "briefings", "briefing_id");
    this.operatingModes = new SqliteJsonRepository(this.db, "operating_modes", "user_id");
  }

  reset() {
    this.db.exec(`
      DELETE FROM interaction_signals;
      DELETE FROM memory_items;
      DELETE FROM bootstrap_review_cards;
      DELETE FROM bootstrap_reviews;
      DELETE FROM memory_candidates;
      DELETE FROM events;
      DELETE FROM focus_states;
      DELETE FROM life_entities;
      DELETE FROM life_objects;
      DELETE FROM privacy_audits;
      DELETE FROM action_proposals;
      DELETE FROM integration_sources;
      DELETE FROM briefings;
      DELETE FROM operating_modes;
    `);
  }

  close() {
    this.db.close();
  }

  private initialize() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS events (
        event_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bootstrap_reviews (
        bootstrap_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bootstrap_review_cards (
        card_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS memory_candidates (
        candidate_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS memory_items (
        memory_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS interaction_signals (
        signal_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS focus_states (
        user_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS life_entities (
        entity_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS life_objects (
        object_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS privacy_audits (
        audit_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS action_proposals (
        proposal_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS integration_sources (
        integration_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS briefings (
        briefing_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS operating_modes (
        user_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
}
