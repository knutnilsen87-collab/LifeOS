import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyBootstrapCardAction,
  buildBootstrapReviewCard,
  createEvent,
  extractMemoryCandidates,
  setFocusState,
  startBootstrapReview,
  visibleCardsForFocus
} from "../src/server/domain.js";
import { LifeOSStore } from "../src/server/store.js";

const sampleNote = () => readFileSync(resolve(process.cwd(), "examples", "sample_meeting_note.txt"), "utf8");

describe("LifeOS domain slice", () => {
  it("creates and validates an Event", () => {
    const db = new LifeOSStore();
    const event = createEvent(
      {
        content: { content_type: "text/plain", raw_text: "Remember to review pricing after demo" },
        source: { source_type: "windows_agent", origin: "local_device" },
        capture: { capture_method: "global_hotkey", user_initiated: true },
        privacy: { privacy_level: "private_user" }
      },
      db
    );
    expect(event.event_id).toMatch(/^evt_/);
    expect(db.events.size).toBe(1);
  });

  it("extracts task, decision, and sensitive candidates from the sample note", () => {
    const db = new LifeOSStore();
    const event = createEvent(
      {
        event_type: "source_import",
        content: { content_type: "text/plain", raw_text: sampleNote() },
        source: { source_type: "pasted_text", source_name: "Sample meeting note", origin: "local_device" },
        capture: { capture_method: "bootstrap_import", user_initiated: true },
        privacy: { privacy_level: "private_user" }
      },
      db
    );
    const candidates = extractMemoryCandidates([event]);
    expect(candidates.some((candidate) => candidate.candidate_type === "task" && /investor/i.test(candidate.text))).toBe(true);
    expect(candidates.some((candidate) => candidate.candidate_type === "decision" && /pricing|abonnement/i.test(candidate.text))).toBe(true);
    expect(candidates.some((candidate) => candidate.candidate_type === "sensitive_item")).toBe(true);
  });

  it("builds premium-ready cards with source, confidence, privacy, and actions", () => {
    const db = new LifeOSStore();
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const card = review.cards.find((item) => item.card_type === "task_candidate");
    expect(card).toBeTruthy();
    expect(card?.display.source_label).toBe("Sample note");
    expect(card?.trust.confidence_reasons).toBeInstanceOf(Array);
    expect(card?.actions.length).toBeGreaterThanOrEqual(3);
  });

  it("builds distinct decision titles and restricted sensitive actions for the sample note", () => {
    const db = new LifeOSStore();
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );

    const decisionCards = review.cards.filter((item) => item.card_type === "decision_candidate");
    const decisionTitles = decisionCards.map((card) => String(card.display.title));
    expect(decisionTitles).toContain("Focus MVP on Memory Search, Bootstrap Review, and Smart Reminders");
    expect(decisionTitles).toContain("Pricing Strategy: 29-49 USD");
    expect(new Set(decisionTitles).size).toBe(decisionTitles.length);

    const pricingCard = decisionCards.find((card) => card.display.title === "Pricing Strategy: 29-49 USD");
    expect(String(pricingCard?.display.body)).toMatch(/29-49 USD|29-49/i);

    const sensitiveCard = review.cards.find((item) => item.card_type === "sensitive_item_review");
    const primaryAction = sensitiveCard?.actions.find((action) => action.style === "primary");
    const reviewedAction = sensitiveCard?.actions.find((action) => action.action_type === "mark_reviewed");
    const archiveAction = sensitiveCard?.actions.find((action) => action.action_type === "archive_candidate");
    const sourceAction = sensitiveCard?.actions.find((action) => action.action_type === "view_source");
    expect(primaryAction?.action_id).toBe("restrict");
    expect(primaryAction?.label).toBe("Keep Restricted");
    expect(primaryAction?.label).not.toBe("Save");
    expect(primaryAction?.action_type).toBe("keep_restricted");
    expect(reviewedAction?.label).toBe("Mark Reviewed");
    expect(archiveAction?.label).toBe("Archive");
    expect(sourceAction?.label).toBe("View Source");
  });

  it("promote action creates active MemoryItem and InteractionSignal", () => {
    const db = new LifeOSStore();
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const card = review.cards.find((item) => item.card_type === "task_candidate")!;
    const result = applyBootstrapCardAction(review.bootstrap_id, card.card_id, { action_type: "promote_to_active_memory" }, db);
    expect(result.result.memory_id).toBeTruthy();
    expect([...db.memoryItems.values()].some((memory) => memory.state.memory_state === "active")).toBe(true);
    expect(db.interactionSignals.size).toBe(1);
  });

  it("archive action does not create MemoryItem and still records InteractionSignal", () => {
    const db = new LifeOSStore();
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const card = review.cards.find((item) => item.card_type === "decision_candidate")!;
    applyBootstrapCardAction(review.bootstrap_id, card.card_id, { action_type: "archive_candidate" }, db);
    expect(db.memoryItems.size).toBe(0);
    expect(db.bootstrapCards.get(card.card_id)?.status).toBe("archived");
    expect(db.interactionSignals.size).toBe(1);
  });

  it("sensitive keep_restricted and mark_reviewed do not create active MemoryItems but write InteractionSignals", () => {
    const db = new LifeOSStore();
    const restrictedReview = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const restrictedCard = restrictedReview.cards.find((item) => item.card_type === "sensitive_item_review")!;
    applyBootstrapCardAction(restrictedReview.bootstrap_id, restrictedCard.card_id, { action_type: "keep_restricted" }, db);
    expect(db.memoryItems.size).toBe(0);
    expect(db.bootstrapCards.get(restrictedCard.card_id)?.linked_objects.sensitive_handling).toBe("restricted");
    expect(db.interactionSignals.values().at(-1)?.interpreted_signal).toBe("kept_sensitive_item_restricted");

    const reviewedReview = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const reviewedCard = reviewedReview.cards.find((item) => item.card_type === "sensitive_item_review")!;
    applyBootstrapCardAction(reviewedReview.bootstrap_id, reviewedCard.card_id, { action_type: "mark_reviewed" }, db);
    expect(db.memoryItems.size).toBe(0);
    expect(db.bootstrapCards.get(reviewedCard.card_id)?.linked_objects.sensitive_handling).toBe("reviewed");
    expect(db.interactionSignals.values().at(-1)?.interpreted_signal).toBe("marked_sensitive_item_reviewed");
  });

  it("does not allow direct promotion of a sensitive review card", () => {
    const db = new LifeOSStore();
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const sensitiveCard = review.cards.find((item) => item.card_type === "sensitive_item_review")!;
    expect(() =>
      applyBootstrapCardAction(review.bootstrap_id, sensitiveCard.card_id, { action_type: "promote_to_active_memory" }, db)
    ).toThrow("Sensitive review cards cannot be promoted directly");
    expect(db.memoryItems.size).toBe(0);
    expect(db.interactionSignals.size).toBe(0);
  });

  it("Focus Mode suppresses noncritical cards while Review Mode shows top cards", () => {
    const db = new LifeOSStore();
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const focus = setFocusState({ state: "focus" }, db);
    const reviewMode = setFocusState({ state: "review" }, db);
    expect(visibleCardsForFocus(review.cards, focus)).toHaveLength(0);
    expect(visibleCardsForFocus(review.cards, reviewMode).length).toBeGreaterThanOrEqual(3);
  });
});
