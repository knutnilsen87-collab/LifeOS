export type PrivacyLevel =
  | "public"
  | "shared_business"
  | "private_user"
  | "third_party_sensitive"
  | "strictly_personal"
  | "secret"
  | "unknown";

export type FocusMode = "focus" | "review";
export type OperatingMode = "review" | "deep_work" | "meeting" | "planning" | "admin" | "idle" | "travel" | "recovery";
export type ProductMode = "founder" | "developer" | "strategy";
export type MemoryStratum = "hot" | "warm" | "long_term" | "archive" | "restricted" | "deleted" | "redacted";

export type CandidateType = "task" | "decision" | "commitment" | "sensitive_item";

export type CardActionType =
  | "promote_to_active_memory"
  | "archive_candidate"
  | "reject_candidate"
  | "edit_candidate"
  | "create_reminder"
  | "view_source"
  | "keep_restricted"
  | "mark_reviewed"
  | "mark_sensitive"
  | "mark_not_sensitive";

export interface PrivacyAssessment {
  privacy_level: PrivacyLevel;
  contains_third_party_data: boolean;
  external_sharing_allowed: boolean;
  requires_review_before_external_use: boolean;
}

export interface EventRecord {
  schema_version: "event.v1";
  event_id: string;
  user_id: string;
  workspace_id: string;
  event_type: string;
  source: Record<string, unknown>;
  capture: Record<string, unknown>;
  content: {
    content_type: string;
    raw_text?: string | null;
    content_ref?: string | null;
    language?: string | null;
    checksum?: string | null;
  };
  privacy: Record<string, unknown>;
  processing: Record<string, unknown>;
  audit: Record<string, unknown>;
  links?: Record<string, unknown>;
  classification?: Record<string, unknown>;
}

export interface MemoryCandidate {
  candidate_id: string;
  candidate_type: CandidateType;
  user_id: string;
  workspace_id: string;
  title: string;
  text: string;
  source_event_ids: string[];
  source_label: string;
  status: "pending" | "approved" | "archived" | "rejected" | "restricted" | "reviewed";
  privacy: PrivacyAssessment;
  confidence: number;
  confidence_reasons: string[];
  priority: "normal" | "important" | "sensitive";
  due_hint?: string;
}

export interface BootstrapReviewCard {
  schema_version: "bootstrap_review_card.v1";
  card_id: string;
  card_type: string;
  status: "pending" | "approved" | "archived" | "rejected" | "edited";
  display: Record<string, unknown>;
  visual: Record<string, unknown>;
  recommendation: Record<string, unknown>;
  trust: Record<string, unknown>;
  privacy: PrivacyAssessment;
  actions: Array<Record<string, unknown>>;
  linked_objects: Record<string, unknown>;
  queue?: Record<string, unknown>;
  gesture_map?: Record<string, unknown>;
  keyboard_map?: Record<string, unknown>;
  sort?: Record<string, unknown>;
}

export interface BootstrapReview {
  schema_version: "bootstrap_review.v1";
  bootstrap_id: string;
  user_id: string;
  workspace_id: string;
  status: "created" | "processing" | "ready_for_review" | "completed" | "cancelled" | "failed";
  summary: Record<string, unknown>;
  source_summary: Record<string, unknown>;
  cards: BootstrapReviewCard[];
  created_at: string;
  updated_at: string;
  phase_log: string[];
}

export interface MemoryItem {
  schema_version: "memory_item.v1";
  memory_id: string;
  user_id: string;
  workspace_id: string;
  memory_type: string;
  title: string;
  summary: string;
  canonical_text: string;
  state: Record<string, unknown>;
  source_refs: Record<string, unknown>;
  privacy: Record<string, unknown>;
  lifecycle: Record<string, unknown>;
}

export interface InteractionSignal {
  schema_version: "interaction_signal.v1";
  signal_id: string;
  user_id: string;
  surface: string;
  object_type: string;
  object_id: string;
  interaction: string;
  interpreted_signal: string;
  context: Record<string, unknown>;
  learning?: Record<string, unknown>;
  created_at: string;
}

export interface LifeEntity {
  entity_id: string;
  entity_type: "person" | "project" | "company" | "topic";
  name: string;
  aliases: string[];
  source_memory_ids: string[];
  privacy: PrivacyAssessment;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface LifeObject {
  object_id: string;
  object_type: "decision" | "task" | "commitment";
  title: string;
  summary: string;
  status: "open" | "active" | "done" | "archived";
  source_memory_ids: string[];
  related_entity_ids: string[];
  privacy: PrivacyAssessment;
  due_hint?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrivacyAuditEntry {
  audit_id: string;
  object_type: string;
  object_id: string;
  privacy_level: PrivacyLevel;
  external_sharing_allowed: boolean;
  requires_review_before_external_use: boolean;
  verdict: "allowed" | "review_required" | "blocked";
  reason: string;
  created_at: string;
}

export interface ActionProposal {
  schema_version: "action_proposal.v1";
  proposal_id: string;
  user_id: string;
  proposal_type: string;
  title: string;
  description: string;
  proposed_action: Record<string, unknown>;
  risk: {
    risk_level: "low" | "medium" | "high";
    external_side_effect: boolean;
    requires_approval: boolean;
    approval_reason?: string;
  };
  source_refs: Record<string, unknown>;
  status: "pending_approval" | "approved" | "rejected" | "executed" | "cancelled";
  created_at: string;
  updated_at?: string;
}

export interface IntegrationSource {
  integration_id: string;
  source_type: "calendar" | "email" | "docs" | "files" | "github" | "ide" | "chat" | "crm";
  display_name: string;
  access_mode: "read_only" | "disabled";
  ingestion_status: "available" | "needs_connection" | "disabled";
  privacy: PrivacyAssessment;
  last_checked_at: string;
  notes: string[];
}

export interface Briefing {
  briefing_id: string;
  briefing_type: "daily" | "meeting" | "weekly";
  title: string;
  sections: Array<{ title: string; items: string[] }>;
  source_refs: Record<string, unknown>;
  confidence: number;
  created_at: string;
}

export interface OperatingModeState {
  mode_id: string;
  user_id: string;
  operating_mode: OperatingMode;
  product_mode: ProductMode;
  interruption_policy: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FocusState {
  schema_version: "focus_state.v1";
  focus_state_id: string;
  user_id: string;
  state: FocusMode;
  confidence: number;
  interruption_policy: Record<string, unknown>;
  allowed_notification_types: string[];
  suppressed_notification_types: string[];
  created_at: string;
  expires_at?: string | null;
}

export interface CardActionResult {
  status: "accepted";
  result: Record<string, unknown>;
  next_card_id: string | null;
  feedback: Record<string, unknown>;
}
