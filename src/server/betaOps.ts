import { createHash } from "node:crypto";
import { ActionDraft, MigrationRecord, ObservabilityEvent, UserSession } from "../shared/types.js";
import { LifeOSStorage } from "./store.js";

const defaultUserId = "usr_local_default";
const defaultWorkspaceId = "wsp_personal_default";

export function getOrCreateLocalSession(db: LifeOSStorage): UserSession {
  const existing = db.userSessions.values().find((session) => session.user_id === defaultUserId);
  if (existing) {
    return existing;
  }
  const createdAt = new Date().toISOString();
  const session: UserSession = {
    session_id: "sess_local_owner",
    user_id: defaultUserId,
    workspace_id: defaultWorkspaceId,
    role: "owner",
    local_only: true,
    created_at: createdAt,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  db.userSessions.set(session.session_id, session);
  return session;
}

export function recordObservabilityEvent(db: LifeOSStorage, input: unknown): ObservabilityEvent {
  const body = (input ?? {}) as Record<string, unknown>;
  const event: ObservabilityEvent = {
    obs_id: String(body.obs_id ?? `obs_${Date.now().toString(36)}`),
    level: normalizeLevel(body.level),
    area: normalizeArea(body.area),
    message: String(body.message ?? "LifeOS event"),
    metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
    created_at: new Date().toISOString()
  };
  db.observabilityEvents.set(event.obs_id, event);
  return event;
}

export function observabilitySummary(db: LifeOSStorage) {
  const events = db.observabilityEvents.values();
  return {
    events_total: events.length,
    errors_total: events.filter((event) => event.level === "error").length,
    warnings_total: events.filter((event) => event.level === "warn").length,
    recent: events.slice(-20)
  };
}

export function backupManifest(db: LifeOSStorage) {
  const counts = {
    events: db.events.size,
    bootstrap_reviews: db.bootstrapReviews.size,
    memory_items: db.memoryItems.size,
    interaction_signals: db.interactionSignals.size,
    action_proposals: db.actionProposals.size,
    action_drafts: db.actionDrafts.size,
    privacy_audits: db.privacyAudits.size,
    user_sessions: db.userSessions.size
  };
  return {
    manifest_id: "backup_manifest_local",
    generated_at: new Date().toISOString(),
    storage_driver: db.driver,
    counts,
    checksum: createHash("sha256").update(JSON.stringify(counts)).digest("hex"),
    restore_strategy: "Rehydrate canonical JSON repository payloads into a fresh LifeOSStorage adapter."
  };
}

export function migrationPlan(db: LifeOSStorage) {
  const records: MigrationRecord[] = [
    migration("001_sqlite_json_core", "SQLite JSON core repositories"),
    migration("002_ecosystem_repositories", "Ecosystem repositories"),
    migration("003_postgres_pgvector_target", "Postgres and pgvector target schema")
  ];
  records.forEach((record) => db.migrations.set(record.migration_id, record));
  return {
    current_driver: db.driver,
    migrations_total: records.length,
    migrations: records,
    postgres_runtime_enabled: false,
    reason: "Postgres/pgvector is planned behind LifeOSStorage; this local repo remains SQLite until credentials and deployment target exist."
  };
}

export function uxReadiness(db: LifeOSStorage) {
  return {
    status: "beta_ux_v1",
    checklist: [
      { item: "double_click_launcher", status: "done" },
      { item: "pwa_manifest", status: "done" },
      { item: "offline_shell", status: "done" },
      { item: "empty_states", status: "done" },
      { item: "source_drawer", status: "done" },
      { item: "approval_first_actions", status: "done" },
      { item: "keyboard_polish", status: "partial" }
    ],
    current_counts: {
      memories: db.memoryItems.size,
      proposals: db.actionProposals.size,
      drafts: db.actionDrafts.size
    }
  };
}

export function betaReadiness(db: LifeOSStorage) {
  const session = getOrCreateLocalSession(db);
  const backup = backupManifest(db);
  const migrations = migrationPlan(db);
  const observability = observabilitySummary(db);
  const ux = uxReadiness(db);
  return {
    status: "beta_v1_ready_local",
    session,
    backup,
    migrations,
    observability,
    ux,
    guardrails: {
      auth_boundary: "local_owner_session",
      external_execution: "disabled",
      integrations: "explicit_read_only_imports_only",
      cloud_sync: "not_enabled"
    }
  };
}

function migration(id: string, name: string): MigrationRecord {
  return {
    migration_id: id,
    name,
    status: id === "003_postgres_pgvector_target" ? "pending" : "applied",
    checksum: createHash("sha256").update(`${id}:${name}`).digest("hex"),
    applied_at: id === "003_postgres_pgvector_target" ? undefined : new Date().toISOString()
  };
}

function normalizeLevel(value: unknown): ObservabilityEvent["level"] {
  return value === "warn" || value === "error" ? value : "info";
}

function normalizeArea(value: unknown): ObservabilityEvent["area"] {
  const allowed: ObservabilityEvent["area"][] = ["api", "storage", "integration", "ui", "agent"];
  return allowed.includes(value as ObservabilityEvent["area"]) ? (value as ObservabilityEvent["area"]) : "api";
}
