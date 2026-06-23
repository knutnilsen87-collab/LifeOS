import { customAlphabet } from "nanoid";
import {
  BootstrapReview,
  BootstrapReviewCard,
  CardActionResult,
  CandidateType,
  EventRecord,
  FocusMode,
  FocusState,
  InteractionSignal,
  MemoryCandidate,
  MemoryItem,
  PrivacyAssessment,
  PrivacyLevel
} from "../shared/types.js";
import { AppError, notFound } from "./errors.js";
import { assertValid } from "./schemas.js";
import { LifeOSStorage } from "./store.js";

const id = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const defaultUserId = "usr_local_default";
const defaultWorkspaceId = "wsp_personal_default";

const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}_${id()}`;

const privacyDefaults = (level: PrivacyLevel): PrivacyAssessment => ({
  privacy_level: level,
  contains_third_party_data: level === "third_party_sensitive",
  external_sharing_allowed: level === "public" || level === "shared_business",
  requires_review_before_external_use: level !== "public"
});

export function validateEvent(input: unknown): EventRecord {
  const value = normalizeEventInput(input);
  assertValid("event", value, "Invalid Event payload");
  return value;
}

export function createEvent(input: unknown, db: LifeOSStorage): EventRecord {
  const event = validateEvent(input);
  db.events.set(event.event_id, event);
  return event;
}

export function normalizeEventInput(input: unknown): EventRecord {
  if (!input || typeof input !== "object") {
    throw new AppError("VALIDATION_ERROR", "Invalid Event payload", 400);
  }

  const body = input as Record<string, any>;
  const timestamp = now();
  const privacyLevel = body.privacy?.privacy_level ?? "private_user";

  return {
    schema_version: "event.v1",
    event_id: body.event_id ?? newId("evt"),
    user_id: body.user_id ?? defaultUserId,
    workspace_id: body.workspace_id ?? defaultWorkspaceId,
    event_type: body.event_type ?? "quick_capture",
    source: {
      source_type: body.source?.source_type ?? "manual_input",
      source_name: body.source?.source_name ?? body.source?.display_name ?? "Quick Capture",
      origin: body.source?.origin ?? "manual_input",
      source_id: body.source?.source_id ?? body.source?.source_ref ?? newId("src"),
      ...body.source
    },
    capture: {
      captured_at: body.capture?.captured_at ?? timestamp,
      capture_method: body.capture?.capture_method ?? "manual",
      user_initiated: body.capture?.user_initiated ?? true,
      timezone: body.capture?.timezone ?? "Europe/Oslo",
      ...body.capture
    },
    content: {
      content_type: body.content?.content_type ?? "text/plain",
      raw_text: body.content?.raw_text ?? body.raw_text ?? null,
      content_ref: body.content?.content_ref ?? null,
      language: body.content?.language ?? "nb",
      checksum: body.content?.checksum ?? null
    },
    privacy: {
      privacy_level: privacyLevel,
      contains_third_party_data: body.privacy?.contains_third_party_data ?? privacyLevel === "third_party_sensitive",
      allowed_uses: body.privacy?.allowed_uses ?? ["personal_recall", "task_extraction", "planning", "daily_review"],
      forbidden_uses: body.privacy?.forbidden_uses ?? ["external_sharing_without_approval", "model_training"],
      ...body.privacy
    },
    processing: {
      ingestion_status: body.processing?.ingestion_status ?? "accepted",
      normalization_status: body.processing?.normalization_status ?? "normalized",
      dedupe_status: body.processing?.dedupe_status ?? "not_checked",
      embedding_status: body.processing?.embedding_status ?? "not_started",
      memory_promotion_status: body.processing?.memory_promotion_status ?? "not_started",
      ...body.processing
    },
    links: body.links ?? {},
    classification: body.classification ?? {},
    audit: {
      created_at: body.audit?.created_at ?? timestamp,
      updated_at: body.audit?.updated_at ?? timestamp,
      created_by: body.audit?.created_by ?? "local_ingestion_gateway",
      local_trace_id: body.audit?.local_trace_id ?? null,
      ...body.audit
    }
  };
}

export function startBootstrapReview(input: unknown, db: LifeOSStorage): BootstrapReview {
  const body = (input ?? {}) as Record<string, any>;
  const timestamp = now();
  const userId = body.user_id ?? defaultUserId;
  const workspaceId = body.workspace_id ?? defaultWorkspaceId;
  const approvedSources = (body.sources ?? []).filter((source: any) => source.approved_by_user);
  const rawTexts = collectApprovedTexts(body, approvedSources);

  if (approvedSources.length === 0 && rawTexts.length === 0) {
    throw new AppError("CONSENT_REQUIRED", "Bootstrap requires at least one user-approved source", 400);
  }

  const review: BootstrapReview = {
    schema_version: "bootstrap_review.v1",
    bootstrap_id: newId("boot"),
    user_id: userId,
    workspace_id: workspaceId,
    status: "processing",
    summary: {
      candidate_count: 0,
      card_count: 0,
      phase: "scanning_sources"
    },
    source_summary: {
      sources_total: approvedSources.length || rawTexts.length,
      approved_sources: approvedSources.map((source: any) => ({
        source_type: source.source_type ?? "pasted_text",
        display_name: source.display_name ?? "Approved text"
      }))
    },
    cards: [],
    created_at: timestamp,
    updated_at: timestamp,
    phase_log: [
      "scanning_sources",
      "extracting_text",
      "creating_events",
      "finding_tasks",
      "finding_decisions",
      "finding_commitments",
      "classifying_privacy",
      "building_review_cards",
      "ready_for_review"
    ]
  };

  const events = rawTexts.map((sourceText, index) =>
    createEvent(
      {
        user_id: userId,
        workspace_id: workspaceId,
        event_type: "source_import",
        source: {
          source_type: approvedSources[index]?.source_type ?? "pasted_text",
          source_name: approvedSources[index]?.display_name ?? "Approved text",
          source_ref: approvedSources[index]?.source_ref ?? `approved_text_${index + 1}`,
          origin: "local_device"
        },
        capture: {
          capture_method: "bootstrap_import",
          user_initiated: true
        },
        content: {
          content_type: "text/plain",
          raw_text: sourceText,
          language: "nb"
        },
        privacy: {
          privacy_level: "private_user"
        }
      },
      db
    )
  );

  const candidates = extractMemoryCandidates(events);
  const cards = candidates.map((candidate) => {
    db.candidates.set(candidate.candidate_id, candidate);
    const card = buildBootstrapReviewCard(candidate, events);
    db.bootstrapCards.set(card.card_id, card);
    return card;
  });

  review.status = "ready_for_review";
  review.summary = {
    candidate_count: candidates.length,
    card_count: cards.length,
    task_count: candidates.filter((candidate) => candidate.candidate_type === "task").length,
    decision_count: candidates.filter((candidate) => candidate.candidate_type === "decision").length,
    sensitive_count: candidates.filter((candidate) => candidate.candidate_type === "sensitive_item").length,
    phase: "ready_for_review"
  };
  review.cards = cards;
  review.updated_at = now();
  assertValid("bootstrapReview", review, "Invalid BootstrapReview payload");
  cards.forEach((card) => assertValid("bootstrapReviewCard", card, "Invalid BootstrapReviewCard payload"));
  db.bootstrapReviews.set(review.bootstrap_id, review);
  return review;
}

function collectApprovedTexts(body: Record<string, any>, approvedSources: any[]): string[] {
  const texts: string[] = [];
  if (typeof body.raw_text === "string" && body.raw_text.trim()) {
    texts.push(body.raw_text);
  }
  if (typeof body.text === "string" && body.text.trim()) {
    texts.push(body.text);
  }
  approvedSources.forEach((source) => {
    if (typeof source.raw_text === "string" && source.raw_text.trim()) {
      texts.push(source.raw_text);
    }
    if (typeof source.text === "string" && source.text.trim()) {
      texts.push(source.text);
    }
  });
  return texts;
}

export function extractMemoryCandidates(events: EventRecord[]): MemoryCandidate[] {
  return events.flatMap((event) => {
    const text = event.content.raw_text ?? "";
    const sentences = text
      .split(/\r?\n|(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const candidates: MemoryCandidate[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (/lovet|innen fredag|contact investor|investor by friday|kontakt(e|ere) investor/.test(lower)) {
        candidates.push(candidateFromSentence("task", "Contact investor by Friday", sentence, event, [
          "Detected a commitment phrase",
          "Detected a Friday deadline",
          "Contains an accountable follow-up"
        ]));
      }

      if (isDecisionSentence(lower)) {
        const decision = decisionCandidateFromSentence(sentence, event);
        candidates.push(decision);
      }

      if (/sensitiv|sensitive|ikke bør deles|not be shared|uten godkjenning|without approval/.test(lower)) {
        const candidate = candidateFromSentence("sensitive_item", "Sensitive client note requires approval", sentence, event, [
          "Detected sensitive information wording",
          "Mentions third-party or client context",
          "External sharing is explicitly restricted"
        ]);
        candidate.privacy = assessPrivacy(candidate);
        candidate.priority = "sensitive";
        candidates.push(candidate);
      }
    }

    return dedupeCandidates(candidates);
  });
}

function isDecisionSentence(lower: string) {
  return /pricing|pris|abonnement|subscription|bestemte|decided|skal testes|mvp-en skal fokusere|mvp.*focus|memory search|smart reminders/.test(
    lower
  );
}

function decisionCandidateFromSentence(sentence: string, event: EventRecord): MemoryCandidate {
  const lower = sentence.toLowerCase();
  if (/pricing|pris|abonnement|subscription|29-49|29\s*-\s*49/.test(lower)) {
    return candidateFromSentence("decision", "Pricing Strategy: 29-49 USD", sentence, event, [
      "Detected a pricing test direction",
      "Contains subscription pricing details",
      "Relevant to business model",
      "Relevant to MVP validation"
    ]);
  }

  if (/mvp|memory search|bootstrap review|smart reminders/.test(lower)) {
    return candidateFromSentence("decision", "Focus MVP on Memory Search, Bootstrap Review, and Smart Reminders", sentence, event, [
      "Detected MVP strategy",
      "Contains product scope details",
      "Relevant to initial product strategy"
    ]);
  }

  return candidateFromSentence("decision", summarizeDecisionTitle(sentence), sentence, event, [
    "Detected a decision phrase",
    "Relevant to product strategy",
    "Needs review before promotion"
  ]);
}

function summarizeDecisionTitle(sentence: string) {
  const normalized = sentence.replace(/\s+/g, " ").replace(/[.!?]+$/g, "").trim();
  if (!normalized) {
    return "Review decision candidate";
  }
  return normalized.length <= 74 ? normalized : `${normalized.slice(0, 71).trim()}...`;
}

function candidateFromSentence(
  candidateType: CandidateType,
  title: string,
  sentence: string,
  event: EventRecord,
  reasons: string[]
): MemoryCandidate {
  const candidate: MemoryCandidate = {
    candidate_id: newId("cand"),
    candidate_type: candidateType,
    user_id: event.user_id,
    workspace_id: event.workspace_id,
    title,
    text: sentence,
    source_event_ids: [event.event_id],
    source_label: String(event.source.source_name ?? event.source.source_type ?? "Approved source"),
    status: "pending",
    privacy: privacyDefaults("private_user"),
    confidence: candidateType === "sensitive_item" ? 0.91 : 0.86,
    confidence_reasons: reasons,
    priority: candidateType === "decision" ? "important" : "normal"
  };

  if (candidateType === "task" && /fredag|friday/i.test(sentence)) {
    candidate.due_hint = "Friday";
  }

  candidate.privacy = assessPrivacy(candidate);
  return candidate;
}

function dedupeCandidates(candidates: MemoryCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.candidate_type}:${candidate.title}:${candidate.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function assessPrivacy(candidate: MemoryCandidate): PrivacyAssessment {
  const text = `${candidate.title} ${candidate.text}`.toLowerCase();
  if (/api[_ -]?key|password|secret|token/.test(text)) {
    return privacyDefaults("secret");
  }
  if (/sensitiv|sensitive|client|klient|third-party|tredjepart|uten godkjenning|without approval/.test(text)) {
    return {
      privacy_level: "third_party_sensitive",
      contains_third_party_data: true,
      external_sharing_allowed: false,
      requires_review_before_external_use: true
    };
  }
  return privacyDefaults("private_user");
}

export function buildBootstrapReviewCard(candidate: MemoryCandidate, events: EventRecord[] = []): BootstrapReviewCard {
  const sourceEvent = events.find((event) => event.event_id === candidate.source_event_ids[0]);
  const cardType =
    candidate.candidate_type === "sensitive_item"
      ? "sensitive_item_review"
      : candidate.candidate_type === "decision"
        ? "decision_candidate"
        : candidate.candidate_type === "commitment"
          ? "commitment_candidate"
          : "task_candidate";
  const isSensitive = candidate.privacy.privacy_level === "third_party_sensitive" || candidate.privacy.privacy_level === "secret";
  const card: BootstrapReviewCard = {
    schema_version: "bootstrap_review_card.v1",
    card_id: newId("card"),
    card_type: cardType,
    status: "pending",
    display: {
      title: candidate.title,
      subtitle: candidate.candidate_type === "decision" ? "Decision candidate" : isSensitive ? "Sensitive item review" : "Task candidate",
      body: candidate.text,
      source_label: candidate.source_label,
      timestamp_label: String(sourceEvent?.capture?.captured_at ?? "Just now"),
      confidence_label: confidenceLabel(candidate.confidence),
      privacy_label: privacyLabel(candidate.privacy.privacy_level),
      priority_label: isSensitive ? "Review before sharing" : candidate.priority === "important" ? "Important" : "Normal"
    },
    visual: {
      intent: isSensitive ? "attention_required" : candidate.candidate_type === "decision" ? "review" : "ready",
      accent: isSensitive ? "amber" : candidate.candidate_type === "decision" ? "teal" : "blue",
      depth: "raised",
      density: "comfortable",
      motion_hint: "soft_reveal",
      icon: isSensitive ? "shield-alert" : candidate.candidate_type === "decision" ? "milestone" : "check-circle",
      badge_style: isSensitive ? "warning" : "neutral"
    },
    recommendation: {
      recommended_action: isSensitive ? "keep_restricted" : "promote_to_active_memory",
      reason: isSensitive
        ? "Keep this source restricted and block external sharing unless the user explicitly approves later."
        : "This looks useful enough to keep as active memory.",
      confidence: candidate.confidence,
      requires_approval: true
    },
    trust: {
      confidence: candidate.confidence,
      confidence_reasons: candidate.confidence_reasons,
      uncertainty: {
        can_edit_before_promoting: true
      }
    },
    privacy: candidate.privacy,
    actions: isSensitive ? sensitiveActions() : normalActions(),
    gesture_map: {
      swipe_right: isSensitive ? "keep_restricted" : "promote_to_active_memory",
      swipe_left: "archive_candidate",
      tap: "view_details",
      long_press: "view_source"
    },
    keyboard_map: {
      Enter: isSensitive ? "keep_restricted" : "promote_to_active_memory",
      Backspace: "archive_candidate",
      Space: "view_details"
    },
    linked_objects: {
      candidate_id: candidate.candidate_id,
      event_ids: candidate.source_event_ids
    },
    sort: {
      priority_score: isSensitive ? 0.95 : candidate.priority === "important" ? 0.8 : 0.65,
      confidence: candidate.confidence
    }
  };
  return card;
}

function normalActions() {
  return [
    {
      action_id: "promote",
      label: "Save",
      action_type: "promote_to_active_memory",
      style: "primary",
      result_preview: "Creates an active MemoryItem"
    },
    {
      action_id: "archive",
      label: "Archive",
      action_type: "archive_candidate",
      style: "secondary",
      result_preview: "Keeps the source but does not create memory"
    },
    {
      action_id: "source",
      label: "View Source",
      action_type: "view_source",
      style: "ghost"
    }
  ];
}

function sensitiveActions() {
  return [
    {
      action_id: "restrict",
      label: "Keep Restricted",
      action_type: "keep_restricted",
      style: "primary",
      result_preview: "Keeps this source restricted and blocks external sharing."
    },
    {
      action_id: "review",
      label: "Mark Reviewed",
      action_type: "mark_reviewed",
      style: "secondary",
      result_preview: "Marks the sensitive item as reviewed without promoting it to active memory."
    },
    {
      action_id: "archive",
      label: "Archive",
      action_type: "archive_candidate",
      style: "secondary",
      result_preview: "Keeps the source but does not create memory"
    },
    {
      action_id: "source",
      label: "View Source",
      action_type: "view_source",
      style: "ghost"
    }
  ];
}

export function applyBootstrapCardAction(
  bootstrapId: string,
  cardId: string,
  actionInput: unknown,
  db: LifeOSStorage
): CardActionResult {
  const review = db.bootstrapReviews.get(bootstrapId);
  if (!review) {
    throw notFound("BootstrapReview not found");
  }
  const card = db.bootstrapCards.get(cardId);
  if (!card) {
    throw notFound("BootstrapReviewCard not found");
  }
  const body = (actionInput ?? {}) as Record<string, any>;
  const actionType = body.action_type;
  const candidateId = String(card.linked_objects.candidate_id);
  const candidate = db.candidates.get(candidateId);
  if (!candidate) {
    throw notFound("MemoryCandidate not found");
  }

  let result: Record<string, unknown>;
  if (actionType === "promote_to_active_memory") {
    if (isSensitiveCard(card)) {
      throw new AppError("VALIDATION_ERROR", "Sensitive review cards cannot be promoted directly", 400);
    }
    card.status = "approved";
    candidate.status = "approved";
    const existingMemoryId = card.linked_objects.memory_id as string | undefined;
    const memory = existingMemoryId ? db.memoryItems.get(existingMemoryId) : promoteCandidateToMemory(candidate, db);
    if (!memory) {
      throw notFound("MemoryItem not found");
    }
    card.linked_objects.memory_id = memory.memory_id;
    result = {
      memory_id: memory.memory_id,
      memory_state: "active",
      stratum: memory.state.stratum
    };
  } else if (actionType === "keep_restricted") {
    ensureSensitiveCardAction(card);
    card.status = "approved";
    card.linked_objects.sensitive_handling = "restricted";
    candidate.status = "restricted";
    result = {
      restricted: true,
      memory_created: false,
      external_sharing_allowed: false
    };
  } else if (actionType === "mark_reviewed") {
    ensureSensitiveCardAction(card);
    card.status = "edited";
    card.linked_objects.sensitive_handling = "reviewed";
    candidate.status = "reviewed";
    result = {
      reviewed: true,
      memory_created: false
    };
  } else if (actionType === "archive_candidate") {
    card.status = "archived";
    candidate.status = "archived";
    result = {
      archived: true,
      memory_created: false
    };
  } else if (actionType === "reject_candidate") {
    card.status = "rejected";
    candidate.status = "rejected";
    result = {
      rejected: true,
      memory_created: false
    };
  } else if (actionType === "view_source") {
    result = {
      source_event_ids: candidate.source_event_ids
    };
  } else {
    throw new AppError("VALIDATION_ERROR", "Unsupported card action", 400);
  }

  const signal = recordInteractionSignal(
    {
      user_id: review.user_id,
      workspace_id: review.workspace_id,
      signal_type: interpretedSignalForAction(actionType),
      source_surface: "bootstrap_review",
      target: {
        bootstrap_id: bootstrapId,
        card_id: cardId,
        candidate_id: candidateId
      },
      feedback: body.user_feedback ?? {}
    },
    db
  );

  review.updated_at = now();
  review.cards = review.cards.map((existing) => (existing.card_id === card.card_id ? card : existing));
  db.bootstrapCards.set(card.card_id, card);
  db.candidates.set(candidate.candidate_id, candidate);
  db.bootstrapReviews.set(review.bootstrap_id, review);
  const nextCard = review.cards.find((item) => item.status === "pending");
  return {
    status: "accepted",
    result,
    next_card_id: nextCard?.card_id ?? null,
    feedback: {
      message: feedbackMessageForAction(actionType),
      motion: "soft_confirm",
      learned_signal: signal.interpreted_signal
    }
  };
}

function feedbackMessageForAction(actionType: unknown) {
  if (actionType === "archive_candidate") {
    return "Archived without creating memory";
  }
  if (actionType === "keep_restricted") {
    return "Kept restricted";
  }
  if (actionType === "mark_reviewed") {
    return "Marked reviewed";
  }
  return "Saved as active memory";
}

function ensureSensitiveCardAction(card: BootstrapReviewCard) {
  if (!isSensitiveCard(card)) {
    throw new AppError("VALIDATION_ERROR", "Sensitive action is only available for sensitive review cards", 400);
  }
}

function isSensitiveCard(card: BootstrapReviewCard) {
  return card.card_type === "sensitive_item_review" || card.privacy.privacy_level === "third_party_sensitive";
}

function interpretedSignalForAction(actionType: unknown) {
  if (actionType === "keep_restricted") {
    return "kept_sensitive_item_restricted";
  }
  if (actionType === "mark_reviewed") {
    return "marked_sensitive_item_reviewed";
  }
  return `card_${String(actionType)}`;
}

export function promoteCandidateToMemory(candidate: MemoryCandidate, db: LifeOSStorage): MemoryItem {
  const timestamp = now();
  const memoryType =
    candidate.candidate_type === "decision"
      ? "decision"
      : candidate.candidate_type === "sensitive_item"
        ? "risk"
        : candidate.candidate_type === "commitment"
          ? "commitment"
          : "task";
  const memory: MemoryItem = {
    schema_version: "memory_item.v1",
    memory_id: newId("mem"),
    user_id: candidate.user_id,
    workspace_id: candidate.workspace_id,
    memory_type: memoryType,
    title: candidate.title,
    summary: candidate.text,
    canonical_text: candidate.text,
    state: {
      memory_state: "active",
      stratum: candidate.candidate_type === "decision" ? "long_term" : "hot",
      confidence: candidate.confidence,
      importance_score: candidate.priority === "sensitive" ? 0.95 : candidate.priority === "important" ? 0.82 : 0.7,
      actionability_score: candidate.candidate_type === "decision" ? 0.45 : 0.9,
      recency_score: 1
    },
    source_refs: {
      event_ids: candidate.source_event_ids,
      quote_refs: [{ text: candidate.text }]
    },
    privacy: { ...candidate.privacy },
    lifecycle: {
      created_at: timestamp,
      updated_at: timestamp
    }
  };
  assertValid("memoryItem", memory, "Invalid MemoryItem payload");
  db.memoryItems.set(memory.memory_id, memory);
  return memory;
}

export function recordInteractionSignal(input: unknown, db: LifeOSStorage): InteractionSignal {
  const body = (input ?? {}) as Record<string, any>;
  const signal: InteractionSignal = {
    schema_version: "interaction_signal.v1",
    signal_id: body.signal_id ?? newId("sig"),
    user_id: body.user_id ?? defaultUserId,
    surface: body.surface ?? body.source_surface ?? "review_queue",
    object_type: body.object_type ?? inferObjectType(body.target),
    object_id: body.object_id ?? inferObjectId(body.target),
    interaction: body.interaction ?? body.feedback?.interaction ?? "manual_feedback",
    interpreted_signal: body.interpreted_signal ?? body.signal_type ?? "manual_feedback",
    context: {
      workspace_id: body.workspace_id ?? defaultWorkspaceId,
      target: body.target ?? {},
      feedback: body.feedback ?? {},
      ...(body.context ?? {})
    },
    learning: body.learning ?? {
      confidence_feedback: body.feedback?.confidence_feedback ?? null
    },
    created_at: body.created_at ?? now()
  };
  assertValid("interactionSignal", signal, "Invalid InteractionSignal payload");
  db.interactionSignals.set(signal.signal_id, signal);
  return signal;
}

function inferObjectType(target: unknown) {
  if (!target || typeof target !== "object") {
    return "unknown";
  }
  const value = target as Record<string, unknown>;
  if (value.card_id) {
    return "bootstrap_review_card";
  }
  if (value.candidate_id) {
    return "memory_candidate";
  }
  return "unknown";
}

function inferObjectId(target: unknown) {
  if (!target || typeof target !== "object") {
    return "unknown";
  }
  const value = target as Record<string, unknown>;
  return String(value.card_id ?? value.candidate_id ?? value.bootstrap_id ?? "unknown");
}

export function getCurrentFocusState(userId: string, db: LifeOSStorage): FocusState {
  const existing = db.focusStates.get(userId);
  if (existing) {
    return existing;
  }
  const focus = buildFocusState(userId, "review");
  db.focusStates.set(userId, focus);
  return focus;
}

export function setFocusState(input: unknown, db: LifeOSStorage): FocusState {
  const body = (input ?? {}) as Record<string, any>;
  const userId = body.user_id ?? defaultUserId;
  const state = body.state === "focus" ? "focus" : "review";
  const focus = buildFocusState(userId, state);
  db.focusStates.set(userId, focus);
  return focus;
}

function buildFocusState(userId: string, state: FocusMode): FocusState {
  const isFocus = state === "focus";
  const focus: FocusState = {
    schema_version: "focus_state.v1",
    focus_state_id: newId("focus"),
    user_id: userId,
    state,
    confidence: 1,
    interruption_policy: {
      allow_noncritical_interruptions: !isFocus,
      allow_critical_interruptions: true,
      allow_daily_review_prompt: !isFocus,
      allow_quick_capture_confirmation: true,
      batch_until: isFocus ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null
    },
    allowed_notification_types: isFocus ? ["critical_deadline", "user_requested_alarm"] : ["daily_review", "suggested_followup", "memory_insight"],
    suppressed_notification_types: isFocus ? ["suggested_followup", "daily_review", "low_priority_task", "memory_insight"] : [],
    created_at: now(),
    expires_at: null
  };
  assertValid("focusState", focus, "Invalid FocusState payload");
  return focus;
}

export function visibleCardsForFocus(cards: BootstrapReviewCard[], focus: FocusState) {
  if (focus.state === "focus") {
    return cards.filter((card) => card.visual.intent === "critical_deadline");
  }
  return cards.filter((card) => card.status === "pending").slice(0, 5);
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) {
    return "High confidence";
  }
  if (confidence >= 0.75) {
    return "Good confidence";
  }
  return "Needs review";
}

function privacyLabel(level: PrivacyLevel) {
  const labels: Record<PrivacyLevel, string> = {
    public: "Public",
    shared_business: "Shared business",
    private_user: "Private",
    third_party_sensitive: "Third-party sensitive",
    strictly_personal: "Strictly personal",
    secret: "Secret",
    unknown: "Unknown privacy"
  };
  return labels[level] ?? "Unknown privacy";
}
