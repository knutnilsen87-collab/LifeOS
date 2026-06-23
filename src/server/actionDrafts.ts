import { ActionDraft } from "../shared/types.js";
import { AppError, notFound } from "./errors.js";
import { recordInteractionSignal } from "./domain.js";
import { LifeOSStorage } from "./store.js";

export function draftForActionProposal(db: LifeOSStorage, proposalId: string) {
  const proposal = db.actionProposals.get(proposalId);
  if (!proposal) {
    throw notFound("ActionProposal not found");
  }
  if (proposal.status !== "approved") {
    throw new AppError("VALIDATION_ERROR", "ActionProposal must be approved before drafting", 400);
  }
  const draftType = String(proposal.proposed_action.suggested_surface ?? "").includes("email") ? "email" : "task";
  const existing = db.actionDrafts.values().find((draft) => draft.proposal_id === proposalId);
  if (existing) {
    return { status: "existing", draft: existing };
  }

  const timestamp = new Date().toISOString();
  const draft: ActionDraft = {
    draft_id: `draft_${proposalId.replace(/^prop_/, "")}`,
    proposal_id: proposalId,
    draft_type: draftType,
    title: proposal.title.replace(/^Prepare follow-up:\s*/i, "Follow-up: "),
    body: buildDraftBody(proposal.description),
    status: "drafted",
    external_side_effect_performed: false,
    source_refs: proposal.source_refs,
    created_at: timestamp,
    updated_at: timestamp
  };
  db.actionDrafts.set(draft.draft_id, draft);
  recordInteractionSignal(
    {
      user_id: proposal.user_id,
      source_surface: "action_drafting",
      target: { proposal_id: proposal.proposal_id, draft_id: draft.draft_id },
      signal_type: "action_draft_created",
      feedback: { interaction: "draft_prepared" }
    },
    db
  );
  return { status: "drafted", draft };
}

export function updateActionDraft(db: LifeOSStorage, draftId: string, input: unknown) {
  const draft = db.actionDrafts.get(draftId);
  if (!draft) {
    throw notFound("ActionDraft not found");
  }
  const body = (input ?? {}) as Record<string, unknown>;
  const requested = String(body.action ?? "");
  if (!["approve", "discard"].includes(requested)) {
    throw new AppError("VALIDATION_ERROR", "Unsupported draft action", 400);
  }
  const updated: ActionDraft = {
    ...draft,
    status: requested === "approve" ? "approved" : "discarded",
    updated_at: new Date().toISOString()
  };
  db.actionDrafts.set(updated.draft_id, updated);
  return { status: "accepted", draft: updated };
}

function buildDraftBody(description: string) {
  return [
    "Hi,",
    "",
    "Following up on the LifeOS context we captured:",
    description,
    "",
    "Suggested next step:",
    "- Review this draft and approve any external send manually.",
    "",
    "Best,"
  ].join("\n");
}
