import { customAlphabet } from "nanoid";
import {
  ActionProposal,
  Briefing,
  IntegrationSource,
  LifeEntity,
  LifeObject,
  MemoryItem,
  MemoryStratum,
  OperatingMode,
  OperatingModeState,
  PrivacyAssessment,
  PrivacyAuditEntry,
  ProductMode
} from "../shared/types.js";
import { AppError, notFound } from "./errors.js";
import { assertValid } from "./schemas.js";
import { LifeOSStorage } from "./store.js";
import { createEvent, recordInteractionSignal } from "./domain.js";

const id = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const newId = (prefix: string) => `${prefix}_${id()}`;
const now = () => new Date().toISOString();
const defaultUserId = "usr_local_default";
const defaultWorkspaceId = "wsp_personal_default";

const strataOrder: MemoryStratum[] = ["hot", "warm", "long_term", "archive", "restricted", "deleted", "redacted"];

export function reconcileMemoryLifecycle(db: LifeOSStorage) {
  const items = db.memoryItems.values();
  const updated = items.map((memory) => {
    const privacyLevel = String(memory.privacy.privacy_level ?? "private_user");
    const currentStratum = String(memory.state.stratum ?? "hot") as MemoryStratum;
    const targetStratum =
      privacyLevel === "third_party_sensitive" || privacyLevel === "secret"
        ? "restricted"
        : memory.memory_type === "decision"
          ? "long_term"
          : memory.memory_type === "task" || memory.memory_type === "commitment"
            ? "hot"
            : currentStratum;

    const reconciled: MemoryItem = {
      ...memory,
      state: {
        ...memory.state,
        memory_state: memory.state.memory_state ?? "active",
        stratum: targetStratum,
        lifecycle_policy: lifecyclePolicyFor(targetStratum)
      },
      lifecycle: {
        ...memory.lifecycle,
        updated_at: now(),
        next_review_at: reviewWindowFor(targetStratum)
      }
    };
    db.memoryItems.set(reconciled.memory_id, reconciled);
    return reconciled;
  });

  return {
    strata: strataOrder.map((stratum) => ({
      stratum,
      count: updated.filter((memory) => memory.state.stratum === stratum).length,
      policy: lifecyclePolicyFor(stratum)
    })),
    memories_total: updated.length,
    memories: updated
  };
}

export function updateMemoryStratum(db: LifeOSStorage, memoryId: string, stratum: MemoryStratum) {
  if (!strataOrder.includes(stratum)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported memory stratum", 400);
  }
  const memory = db.memoryItems.get(memoryId);
  if (!memory) {
    throw notFound("MemoryItem not found");
  }
  const updated: MemoryItem = {
    ...memory,
    state: {
      ...memory.state,
      stratum,
      memory_state: stratum === "archive" ? "archived" : stratum === "deleted" ? "deleted" : memory.state.memory_state ?? "active",
      lifecycle_policy: lifecyclePolicyFor(stratum)
    },
    lifecycle: {
      ...memory.lifecycle,
      updated_at: now(),
      next_review_at: reviewWindowFor(stratum)
    }
  };
  db.memoryItems.set(updated.memory_id, updated);
  recordInteractionSignal(
    {
      user_id: updated.user_id,
      workspace_id: updated.workspace_id,
      source_surface: "memory_lifecycle",
      target: { memory_id: updated.memory_id },
      signal_type: `memory_moved_to_${stratum}`,
      feedback: { interaction: "lifecycle_update" }
    },
    db
  );
  return updated;
}

export function buildLifeObjects(db: LifeOSStorage) {
  const memories = db.memoryItems.values().filter((memory) => memory.state.memory_state === "active");
  const entities = deriveEntities(memories);
  const objects = deriveObjects(memories, entities);
  entities.forEach((entity) => db.lifeEntities.set(entity.entity_id, entity));
  objects.forEach((object) => db.lifeObjects.set(object.object_id, object));

  return {
    entities_total: entities.length,
    objects_total: objects.length,
    entities,
    objects
  };
}

export function buildPrivacyAudit(db: LifeOSStorage) {
  const memories = db.memoryItems.values();
  const cards = db.bootstrapCards.values();
  const entries: PrivacyAuditEntry[] = [
    ...memories.map((memory) => privacyAuditEntry("memory_item", memory.memory_id, normalizePrivacy(memory.privacy), memory.title)),
    ...cards.map((card) => privacyAuditEntry("bootstrap_review_card", card.card_id, card.privacy, String(card.display.title ?? "Review card")))
  ];
  entries.forEach((entry) => db.privacyAudits.set(entry.audit_id, entry));
  return {
    entries_total: entries.length,
    blocked_total: entries.filter((entry) => entry.verdict === "blocked").length,
    review_required_total: entries.filter((entry) => entry.verdict === "review_required").length,
    entries
  };
}

export function buildActionProposals(db: LifeOSStorage) {
  buildLifeObjects(db);
  const objects = db.lifeObjects.values().filter((object) => object.status === "open" || object.status === "active");
  const proposals = objects
    .filter((object) => object.object_type === "task" || object.object_type === "commitment")
    .map((object) => actionProposalForLifeObject(object));
  proposals.forEach((proposal) => {
    if (!db.actionProposals.get(proposal.proposal_id)) {
      assertValid("actionProposal", proposal, "Invalid ActionProposal payload");
      db.actionProposals.set(proposal.proposal_id, proposal);
    }
  });

  return {
    proposals_total: db.actionProposals.size,
    proposals: db.actionProposals.values()
  };
}

export function updateActionProposal(db: LifeOSStorage, proposalId: string, action: unknown) {
  const proposal = db.actionProposals.get(proposalId);
  if (!proposal) {
    throw notFound("ActionProposal not found");
  }
  const body = (action ?? {}) as Record<string, unknown>;
  const requested = String(body.action ?? "");
  if (!["approve", "reject", "execute"].includes(requested)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported proposal action", 400);
  }
  if (requested === "execute" && proposal.risk.requires_approval && proposal.status !== "approved") {
    throw new AppError("VALIDATION_ERROR", "Proposal requires approval before execution", 400);
  }
  const status = requested === "approve" ? "approved" : requested === "reject" ? "rejected" : "executed";
  const updated: ActionProposal = { ...proposal, status, updated_at: now() };
  db.actionProposals.set(updated.proposal_id, updated);
  recordInteractionSignal(
    {
      user_id: updated.user_id,
      workspace_id: defaultWorkspaceId,
      source_surface: "action_layer",
      target: { proposal_id: updated.proposal_id },
      signal_type: `action_proposal_${status}`,
      feedback: { interaction: requested }
    },
    db
  );
  return {
    status: "accepted",
    proposal: updated,
    execution: status === "executed" ? { external_side_effect_performed: false, mode: "prepared_only" } : null
  };
}

export function windowsAgentStatus(db: LifeOSStorage) {
  const focus = db.focusStates.get(defaultUserId);
  return {
    surface: "windows_agent",
    status: "available_v0",
    tray_presence: focus?.state === "focus" ? "focus" : "review_ready",
    capabilities: ["quick_capture", "focus_review_toggle", "local_source_preview", "local_ingestion_gateway"],
    safeguards: ["user_approved_sources_only", "no_background_file_scan", "no_external_actions_without_approval"]
  };
}

export function windowsQuickCapture(db: LifeOSStorage, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const rawText = String(body.raw_text ?? "").trim();
  if (!rawText) {
    throw new AppError("VALIDATION_ERROR", "raw_text is required", 400);
  }
  const event = createEvent(
    {
      event_type: "quick_capture",
      raw_text: rawText,
      source: {
        source_type: "windows_agent",
        source_name: "Windows Agent Quick Capture",
        origin: "local_device"
      },
      capture: {
        capture_method: "global_hotkey",
        user_initiated: true
      },
      privacy: {
        privacy_level: body.privacy_level ?? "private_user"
      }
    },
    db
  );
  return { status: "captured", event_id: event.event_id, event };
}

export function integrationCatalog(db: LifeOSStorage) {
  const sources: IntegrationSource[] = [
    integrationSource("calendar", "Calendar", "read_only", "needs_connection", ["Meeting prep and time-aware reminders"]),
    integrationSource("email", "Email", "read_only", "needs_connection", ["Draft suggestions require explicit approval"]),
    integrationSource("docs", "Docs and Notes", "read_only", "needs_connection", ["Approved documents can become source Events"]),
    integrationSource("files", "Local Files", "disabled", "disabled", ["Broad OS scanning remains disabled"]),
    integrationSource("github", "GitHub", "read_only", "needs_connection", ["Repository context and issue follow-up"]),
    integrationSource("ide", "IDE Context", "read_only", "needs_connection", ["Developer mode context capture"]),
    integrationSource("chat", "Slack/Teams", "read_only", "needs_connection", ["Message ingestion with source consent"]),
    integrationSource("crm", "CRM", "read_only", "needs_connection", ["Relationship and commitment context"])
  ];
  sources.forEach((source) => db.integrationSources.set(source.integration_id, source));
  return { integrations_total: sources.length, integrations: sources };
}

export function mobileHome(db: LifeOSStorage) {
  const lifecycle = reconcileMemoryLifecycle(db);
  const proposals = buildActionProposals(db).proposals.slice(0, 3);
  const briefing = buildBriefing(db, "daily");
  return {
    surface: "mobile",
    status: "available_v0",
    cards: [
      { type: "daily_brief", title: briefing.title, count: briefing.sections.reduce((sum, section) => sum + section.items.length, 0) },
      { type: "approval_surface", title: "Pending approvals", count: proposals.filter((proposal) => proposal.status === "pending_approval").length },
      { type: "memory_search", title: "Ask LifeOS memory", count: lifecycle.memories_total }
    ],
    briefing,
    proposals
  };
}

export function buildBriefing(db: LifeOSStorage, briefingType: "daily" | "meeting" | "weekly" = "daily"): Briefing {
  const memories = db.memoryItems.values().filter((memory) => memory.state.memory_state === "active");
  const tasks = memories.filter((memory) => memory.memory_type === "task" || memory.memory_type === "commitment");
  const decisions = memories.filter((memory) => memory.memory_type === "decision");
  const restricted = memories.filter((memory) => String(memory.state.stratum) === "restricted");
  const briefing: Briefing = {
    briefing_id: newId("brief"),
    briefing_type: briefingType,
    title: briefingType === "meeting" ? "Meeting Prep" : briefingType === "weekly" ? "Weekly LifeOS Brief" : "Daily LifeOS Brief",
    sections: [
      { title: "Open follow-ups", items: tasks.map((memory) => memory.title).slice(0, 5) },
      { title: "Recent decisions", items: decisions.map((memory) => memory.title).slice(0, 5) },
      { title: "Privacy watch", items: restricted.map((memory) => memory.title).slice(0, 3) }
    ],
    source_refs: {
      memory_ids: memories.map((memory) => memory.memory_id)
    },
    confidence: memories.length > 0 ? 0.82 : 0.35,
    created_at: now()
  };
  db.briefings.set(briefing.briefing_id, briefing);
  return briefing;
}

export function storageArchitectureReport(db: LifeOSStorage) {
  return {
    current_driver: db.driver,
    mvp_storage: "sqlite_json_repositories",
    production_target: "postgres_pgvector_object_storage_audit_log",
    migration_readiness: {
      repository_boundary_present: true,
      canonical_json_payloads_preserved: true,
      vector_search_target_defined: true,
      multi_device_sync_pending: true
    },
    recommended_next_storage_step: "Introduce Postgres adapter behind LifeOSStorage and add pgvector embeddings for MemoryItem retrieval."
  };
}

export function getOperatingMode(db: LifeOSStorage, userId = defaultUserId) {
  const existing = db.operatingModes.get(userId);
  if (existing) {
    return existing;
  }
  const initial = operatingModeState(userId, "review", "founder");
  db.operatingModes.set(userId, initial);
  return initial;
}

export function setOperatingMode(db: LifeOSStorage, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const userId = String(body.user_id ?? defaultUserId);
  const operatingMode = normalizeOperatingMode(body.operating_mode);
  const productMode = normalizeProductMode(body.product_mode);
  const mode = operatingModeState(userId, operatingMode, productMode);
  db.operatingModes.set(userId, mode);
  recordInteractionSignal(
    {
      user_id: userId,
      workspace_id: defaultWorkspaceId,
      source_surface: "mode_switcher",
      target: { user_id: userId },
      signal_type: `mode_set_${operatingMode}_${productMode}`,
      feedback: { interaction: "mode_change" }
    },
    db
  );
  return mode;
}

export function systemReadiness(db: LifeOSStorage) {
  return {
    status: "beta_ready_v0",
    service: "lifeos",
    driver: db.driver,
    checks: {
      storage: "ok",
      review_queue: "ok",
      memory_search: "ok",
      privacy_audit: "ok",
      action_layer: "approval_only",
      integrations: "read_only_catalog",
      external_execution: "disabled_until_approved"
    },
    counts: {
      events: db.events.size,
      memories: db.memoryItems.size,
      action_proposals: db.actionProposals.size,
      privacy_audits: db.privacyAudits.size,
      interaction_signals: db.interactionSignals.size
    }
  };
}

export function reviewConsoleSnapshot(db: LifeOSStorage) {
  return {
    lifecycle: reconcileMemoryLifecycle(db),
    objects: buildLifeObjects(db),
    privacy: buildPrivacyAudit(db),
    actions: buildActionProposals(db),
    integrations: integrationCatalog(db),
    mode: getOperatingMode(db),
    briefing: buildBriefing(db, "daily"),
    readiness: systemReadiness(db)
  };
}

function lifecyclePolicyFor(stratum: MemoryStratum) {
  const policies: Record<MemoryStratum, Record<string, unknown>> = {
    hot: { prompt_eligible: true, review_cadence: "daily", searchable: true },
    warm: { prompt_eligible: true, review_cadence: "weekly", searchable: true },
    long_term: { prompt_eligible: true, review_cadence: "monthly", searchable: true },
    archive: { prompt_eligible: false, review_cadence: "on_search", searchable: true },
    restricted: { prompt_eligible: false, review_cadence: "manual_privacy_review", searchable: true },
    deleted: { prompt_eligible: false, review_cadence: "never", searchable: false },
    redacted: { prompt_eligible: false, review_cadence: "manual_privacy_review", searchable: false }
  };
  return policies[stratum];
}

function reviewWindowFor(stratum: MemoryStratum) {
  if (stratum === "deleted" || stratum === "redacted") {
    return null;
  }
  const days = stratum === "hot" ? 1 : stratum === "warm" ? 7 : stratum === "long_term" ? 30 : 90;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function deriveEntities(memories: MemoryItem[]): LifeEntity[] {
  const entries = new Map<string, LifeEntity>();
  for (const memory of memories) {
    const text = `${memory.title} ${memory.summary}`;
    if (/investor/i.test(text)) {
      addEntity(entries, "topic", "Investor", memory);
    }
    if (/ola/i.test(text)) {
      addEntity(entries, "person", "Ola", memory);
    }
    if (/lifeos|mvp|memory search|bootstrap review/i.test(text)) {
      addEntity(entries, "project", "LifeOS", memory);
    }
  }
  return [...entries.values()];
}

function addEntity(entries: Map<string, LifeEntity>, type: LifeEntity["entity_type"], name: string, memory: MemoryItem) {
  const key = `${type}:${name.toLowerCase()}`;
  const existing = entries.get(key);
  if (existing) {
    existing.source_memory_ids = [...new Set([...existing.source_memory_ids, memory.memory_id])];
    existing.updated_at = now();
    return;
  }
  entries.set(key, {
    entity_id: `ent_${type}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    entity_type: type,
    name,
    aliases: [name],
    source_memory_ids: [memory.memory_id],
    privacy: normalizePrivacy(memory.privacy),
    confidence: 0.78,
    created_at: now(),
    updated_at: now()
  });
}

function deriveObjects(memories: MemoryItem[], entities: LifeEntity[]): LifeObject[] {
  return memories
    .filter((memory) => ["decision", "task", "commitment"].includes(memory.memory_type))
    .map((memory) => {
      const objectType = memory.memory_type === "decision" ? "decision" : memory.memory_type === "commitment" ? "commitment" : "task";
      return {
        object_id: `obj_${objectType}_${memory.memory_id.replace(/^mem_/, "")}`,
        object_type: objectType,
        title: memory.title,
        summary: memory.summary,
        status: objectType === "decision" ? "active" : "open",
        source_memory_ids: [memory.memory_id],
        related_entity_ids: relatedEntityIds(memory, entities),
        privacy: normalizePrivacy(memory.privacy),
        due_hint: String(memory.state.stratum) === "hot" && /friday|fredag/i.test(memory.summary) ? "Friday" : null,
        created_at: String(memory.lifecycle.created_at ?? now()),
        updated_at: now()
      } satisfies LifeObject;
    });
}

function relatedEntityIds(memory: MemoryItem, entities: LifeEntity[]) {
  const text = `${memory.title} ${memory.summary}`.toLowerCase();
  return entities.filter((entity) => text.includes(entity.name.toLowerCase())).map((entity) => entity.entity_id);
}

function privacyAuditEntry(objectType: string, objectId: string, privacy: PrivacyAssessment, label: string): PrivacyAuditEntry {
  const blocked = privacy.privacy_level === "third_party_sensitive" || privacy.privacy_level === "secret";
  const verdict = blocked ? "blocked" : privacy.requires_review_before_external_use ? "review_required" : "allowed";
  return {
    audit_id: `audit_${objectType}_${objectId}`,
    object_type: objectType,
    object_id: objectId,
    privacy_level: privacy.privacy_level,
    external_sharing_allowed: privacy.external_sharing_allowed,
    requires_review_before_external_use: privacy.requires_review_before_external_use,
    verdict,
    reason: blocked
      ? `${label} is restricted from external sharing.`
      : privacy.requires_review_before_external_use
        ? `${label} requires review before external use.`
        : `${label} can be used under current policy.`,
    created_at: now()
  };
}

function normalizePrivacy(value: Record<string, unknown>): PrivacyAssessment {
  const privacyLevel = String(value.privacy_level ?? "private_user") as PrivacyAssessment["privacy_level"];
  return {
    privacy_level: privacyLevel,
    contains_third_party_data: Boolean(value.contains_third_party_data ?? privacyLevel === "third_party_sensitive"),
    external_sharing_allowed: Boolean(value.external_sharing_allowed ?? privacyLevel === "public"),
    requires_review_before_external_use: Boolean(value.requires_review_before_external_use ?? privacyLevel !== "public")
  };
}

function actionProposalForLifeObject(object: LifeObject): ActionProposal {
  const proposal: ActionProposal = {
    schema_version: "action_proposal.v1",
    proposal_id: `prop_${object.object_id}`,
    user_id: defaultUserId,
    proposal_type: object.object_type === "task" ? "prepare_followup" : "prepare_commitment_followup",
    title: `Prepare follow-up: ${object.title}`,
    description: `Prepare a draft follow-up for "${object.summary}" without sending or executing externally.`,
    proposed_action: {
      autonomy_level: "prepare",
      external_execution: false,
      suggested_surface: object.summary.match(/investor/i) ? "email_draft" : "task_draft"
    },
    risk: {
      risk_level: object.privacy.requires_review_before_external_use ? "medium" : "low",
      external_side_effect: false,
      requires_approval: true,
      approval_reason: "LifeOS may prepare the next step, but the user must approve before external execution."
    },
    source_refs: {
      memory_ids: object.source_memory_ids,
      entity_ids: object.related_entity_ids
    },
    status: "pending_approval",
    created_at: now(),
    updated_at: now()
  };
  return proposal;
}

function integrationSource(
  type: IntegrationSource["source_type"],
  displayName: string,
  accessMode: IntegrationSource["access_mode"],
  status: IntegrationSource["ingestion_status"],
  notes: string[]
): IntegrationSource {
  return {
    integration_id: `int_${type}`,
    source_type: type,
    display_name: displayName,
    access_mode: accessMode,
    ingestion_status: status,
    privacy: {
      privacy_level: "private_user",
      contains_third_party_data: type === "email" || type === "chat" || type === "crm",
      external_sharing_allowed: false,
      requires_review_before_external_use: true
    },
    last_checked_at: now(),
    notes
  };
}

function operatingModeState(userId: string, operatingMode: OperatingMode, productMode: ProductMode): OperatingModeState {
  return {
    mode_id: `mode_${userId}`,
    user_id: userId,
    operating_mode: operatingMode,
    product_mode: productMode,
    interruption_policy: policyForMode(operatingMode, productMode),
    created_at: now(),
    updated_at: now()
  };
}

function normalizeOperatingMode(value: unknown): OperatingMode {
  const allowed: OperatingMode[] = ["review", "deep_work", "meeting", "planning", "admin", "idle", "travel", "recovery"];
  return allowed.includes(value as OperatingMode) ? (value as OperatingMode) : "review";
}

function normalizeProductMode(value: unknown): ProductMode {
  const allowed: ProductMode[] = ["founder", "developer", "strategy"];
  return allowed.includes(value as ProductMode) ? (value as ProductMode) : "founder";
}

function policyForMode(operatingMode: OperatingMode, productMode: ProductMode) {
  return {
    allow_noncritical_interruptions: operatingMode !== "deep_work" && operatingMode !== "recovery",
    review_batch_size: operatingMode === "review" ? 5 : operatingMode === "meeting" ? 3 : 2,
    suggested_surfaces:
      productMode === "developer"
        ? ["ide_context", "github", "task_followup"]
        : productMode === "strategy"
          ? ["decision_review", "briefing", "memory_search"]
          : ["investor_followup", "daily_brief", "action_proposals"]
  };
}
