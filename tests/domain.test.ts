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

