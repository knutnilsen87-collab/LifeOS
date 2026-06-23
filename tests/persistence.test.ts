import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyBootstrapCardAction,
  createEvent,
  getCurrentFocusState,
  setFocusState,
  startBootstrapReview
} from "../src/server/domain.js";
import {
  buildActionProposals,
  buildBriefing,
  buildLifeObjects,
  buildPrivacyAudit,
  integrationCatalog,
  setOperatingMode
} from "../src/server/ecosystem.js";
import { SqliteLifeOSStore } from "../src/server/storage/sqlite/sqliteStore.js";

const sampleNote = () => readFileSync(resolve(process.cwd(), "examples", "sample_meeting_note.txt"), "utf8");

let tempDirs: string[] = [];

function sqlitePath() {
  const dir = mkdtempSync(join(tmpdir(), "lifeos-sqlite-"));
  tempDirs.push(dir);
  return join(dir, "lifeos.test.sqlite");
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("SQLite persistence", () => {
  it("persists Events across store re-instantiation", () => {
    const path = sqlitePath();
    const first = new SqliteLifeOSStore(path);
    const event = createEvent(
      {
        content: { content_type: "text/plain", raw_text: "Remember pricing review" },
        source: { source_type: "windows_agent", origin: "local_device" },
        capture: { capture_method: "global_hotkey", user_initiated: true },
        privacy: { privacy_level: "private_user" }
      },
      first
    );
    first.close();

    const second = new SqliteLifeOSStore(path);
    expect(second.events.get(event.event_id)?.content.raw_text).toBe("Remember pricing review");
    second.close();
  });

  it("persists BootstrapReview and BootstrapReviewCards", () => {
    const path = sqlitePath();
    const first = new SqliteLifeOSStore(path);
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      first
    );
    const cardId = review.cards[0].card_id;
    first.close();

    const second = new SqliteLifeOSStore(path);
    expect(second.bootstrapReviews.get(review.bootstrap_id)?.cards.length).toBeGreaterThanOrEqual(3);
    expect(second.bootstrapCards.get(cardId)?.card_id).toBe(cardId);
    second.close();
  });

  it("persists promote, archive, InteractionSignals, MemoryItems, and FocusState", () => {
    const path = sqlitePath();
    const first = new SqliteLifeOSStore(path);
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      first
    );
    const task = review.cards.find((card) => card.card_type === "task_candidate")!;
    const decision = review.cards.find((card) => card.card_type === "decision_candidate")!;

    const promoted = applyBootstrapCardAction(
      review.bootstrap_id,
      task.card_id,
      {
        action_type: "promote_to_active_memory",
        user_feedback: { interaction: "test_promote", confidence_feedback: "correct" }
      },
      first
    );
    applyBootstrapCardAction(
      review.bootstrap_id,
      decision.card_id,
      {
        action_type: "archive_candidate",
        user_feedback: { interaction: "test_archive", confidence_feedback: "correct" }
      },
      first
    );
    setFocusState({ state: "focus" }, first);
    first.close();

    const second = new SqliteLifeOSStore(path);
    expect(second.memoryItems.get(String(promoted.result.memory_id))?.state.memory_state).toBe("active");
    expect(second.memoryItems.size).toBe(1);
    expect(second.bootstrapCards.get(decision.card_id)?.status).toBe("archived");
    expect(second.interactionSignals.size).toBe(2);
    expect(getCurrentFocusState("usr_local_default", second).state).toBe("focus");
    second.close();
  });

  it("keeps the existing demo flow intact on SQLite", () => {
    const path = sqlitePath();
    const db = new SqliteLifeOSStore(path);
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      db
    );
    const task = review.cards.find((card) => card.card_type === "task_candidate");
    const decision = review.cards.find((card) => card.card_type === "decision_candidate");
    const sensitive = review.cards.find((card) => card.card_type === "sensitive_item_review");
    expect(task).toBeTruthy();
    expect(decision).toBeTruthy();
    expect(sensitive).toBeTruthy();

    applyBootstrapCardAction(review.bootstrap_id, task!.card_id, { action_type: "promote_to_active_memory" }, db);
    expect(db.memoryItems.values().filter((memory) => memory.state.memory_state === "active")).toHaveLength(1);
    expect(db.interactionSignals.size).toBe(1);
    db.close();
  });

  it("persists ecosystem phase records across store re-instantiation", () => {
    const path = sqlitePath();
    const first = new SqliteLifeOSStore(path);
    const review = startBootstrapReview(
      {
        raw_text: sampleNote(),
        sources: [{ source_type: "pasted_text", display_name: "Sample note", approved_by_user: true }]
      },
      first
    );
    const task = review.cards.find((card) => card.card_type === "task_candidate")!;
    applyBootstrapCardAction(review.bootstrap_id, task.card_id, { action_type: "promote_to_active_memory" }, first);
    buildLifeObjects(first);
    buildPrivacyAudit(first);
    buildActionProposals(first);
    integrationCatalog(first);
    buildBriefing(first);
    setOperatingMode(first, { operating_mode: "planning", product_mode: "strategy" });
    first.close();

    const second = new SqliteLifeOSStore(path);
    expect(second.lifeObjects.size).toBeGreaterThanOrEqual(1);
    expect(second.privacyAudits.size).toBeGreaterThanOrEqual(1);
    expect(second.actionProposals.size).toBeGreaterThanOrEqual(1);
    expect(second.integrationSources.size).toBeGreaterThanOrEqual(8);
    expect(second.briefings.size).toBeGreaterThanOrEqual(1);
    expect(second.operatingModes.get("usr_local_default")?.product_mode).toBe("strategy");
    second.close();
  });
});
