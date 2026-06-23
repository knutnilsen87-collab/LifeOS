import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { LifeOSStore } from "../src/server/store.js";

const note = `Pricing skal testes som abonnement paa 29-49 USD per maaned.
Jeg lovet aa kontakte investor innen fredag.
Ola nevnte at klientnotatet inneholder sensitiv informasjon og ikke bor deles eksternt uten godkjenning.`;

describe("LifeOS API", () => {
  it("previews approved ingestion sources with checksums and dedupe", async () => {
    const db = new LifeOSStore();
    const app = createApp(db);
    const response = await request(app)
      .post("/api/v1/ingestion/preview")
      .send({
        raw_text: note,
        sources: [
          { source_type: "pasted_text", display_name: "API sample", approved_by_user: true },
          { source_type: "pasted_text", display_name: "Duplicate", raw_text: note, approved_by_user: true }
        ]
      })
      .expect(200);

    expect(response.body.sources_total).toBe(1);
    expect(response.body.sources[0].checksum).toHaveLength(64);
    expect(response.body.sources[0].preview.character_count).toBeGreaterThan(20);
  });

  it("runs the bootstrap review API flow", async () => {
    const db = new LifeOSStore();
    const app = createApp(db);
    const start = await request(app)
      .post("/api/v1/bootstrap/start")
      .send({
        raw_text: note,
        sources: [{ source_type: "pasted_text", display_name: "API sample", approved_by_user: true }]
      })
      .expect(201);

    const cards = await request(app).get(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards`).expect(200);
    expect(cards.body.cards_total).toBeGreaterThanOrEqual(3);

    const task = cards.body.cards.find((card: any) => card.card_type === "task_candidate");
    const action = await request(app)
      .post(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards/${task.card_id}/action`)
      .send({ action_type: "promote_to_active_memory" })
      .expect(200);
    expect(action.body.result.memory_state).toBe("active");

    const memory = await request(app).get("/api/v1/memory/active").expect(200);
    expect(memory.body.items_total).toBe(1);

    const signals = await request(app).get("/api/v1/interaction-signals").expect(200);
    expect(signals.body.signals_total).toBe(1);
  });

  it("returns smarter review queue state for saved, archived, and restricted cards", async () => {
    const db = new LifeOSStore();
    const app = createApp(db);
    const start = await request(app)
      .post("/api/v1/bootstrap/start")
      .send({
        raw_text: note,
        sources: [{ source_type: "pasted_text", display_name: "API sample", approved_by_user: true }]
      })
      .expect(201);
    const initial = await request(app).get(`/api/v1/review-queue?bootstrap_id=${start.body.bootstrap_id}`).expect(200);
    const task = initial.body.cards.find((card: any) => card.card_type === "task_candidate");
    const decision = initial.body.cards.find((card: any) => card.card_type === "decision_candidate");
    const sensitive = initial.body.cards.find((card: any) => card.card_type === "sensitive_item_review");

    await request(app)
      .post(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards/${task.card_id}/action`)
      .send({ action_type: "promote_to_active_memory" })
      .expect(200);
    await request(app)
      .post(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards/${decision.card_id}/action`)
      .send({ action_type: "archive_candidate" })
      .expect(200);
    await request(app)
      .post(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards/${sensitive.card_id}/action`)
      .send({ action_type: "keep_restricted" })
      .expect(200);

    const queue = await request(app).get(`/api/v1/review-queue?bootstrap_id=${start.body.bootstrap_id}`).expect(200);
    expect(queue.body.state_counts.saved).toBe(1);
    expect(queue.body.state_counts.archived).toBe(1);
    expect(queue.body.state_counts.restricted).toBe(1);
    expect(queue.body.cards.every((card: any) => card.queue.visible_state === "pending")).toBe(true);
  });

  it("searches active memories semantically and returns source-grounded answers", async () => {
    const db = new LifeOSStore();
    const app = createApp(db);
    const start = await request(app)
      .post("/api/v1/bootstrap/start")
      .send({
        raw_text: `Vi bestemte at MVP-en skal fokusere paa Memory Search, Bootstrap Review og Smart Reminders.
Pricing skal testes som abonnement paa 29-49 USD per maaned.
Jeg lovet aa kontakte investor innen fredag.`,
        sources: [{ source_type: "pasted_text", display_name: "Semantic sample", approved_by_user: true }]
      })
      .expect(201);
    const cards = await request(app).get(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards`).expect(200);
    const pricing = cards.body.cards.find((card: any) => card.display.title === "Pricing Strategy: 29-49 USD");
    await request(app)
      .post(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards/${pricing.card_id}/action`)
      .send({ action_type: "promote_to_active_memory" })
      .expect(200);

    const search = await request(app).get("/api/v1/memory/search?q=business%20model%20price").expect(200);
    expect(search.body.results_total).toBeGreaterThanOrEqual(1);
    expect(search.body.results[0].memory.title).toBe("Pricing Strategy: 29-49 USD");
    expect(search.body.results[0].source_events[0].event_id).toMatch(/^evt_/);

    const answer = await request(app)
      .post("/api/v1/memory/answer")
      .send({ question: "What did we decide about subscription pricing?" })
      .expect(200);
    expect(answer.body.grounded).toBe(true);
    expect(answer.body.answer).toContain("[1]");
    expect(answer.body.citations[0].memory_title).toBe("Pricing Strategy: 29-49 USD");
    expect(answer.body.citations[0].event_ids[0]).toMatch(/^evt_/);
  });

  it("does not fabricate source-grounded answers without retrieved memory", async () => {
    const db = new LifeOSStore();
    const app = createApp(db);
    const answer = await request(app).post("/api/v1/memory/answer").send({ question: "What is our hiring plan?" }).expect(200);
    expect(answer.body.grounded).toBe(false);
    expect(answer.body.citations).toHaveLength(0);
  });

  it("suppresses review cards in Focus Mode", async () => {
    const db = new LifeOSStore();
    const app = createApp(db);
    const start = await request(app)
      .post("/api/v1/bootstrap/start")
      .send({
        raw_text: note,
        sources: [{ source_type: "pasted_text", display_name: "API sample", approved_by_user: true }]
      })
      .expect(201);
    await request(app).post("/api/v1/focus-state").send({ state: "focus" }).expect(200);
    const cards = await request(app).get(`/api/v1/bootstrap/${start.body.bootstrap_id}/cards`).expect(200);
    expect(cards.body.focus_state).toBe("focus");
    expect(cards.body.cards).toHaveLength(0);
    expect(cards.body.cards_suppressed).toBeGreaterThanOrEqual(3);
  });

  it("returns structured errors", async () => {
    const db = new LifeOSStore();
    const app = createApp(db);
    const response = await request(app).post("/api/v1/bootstrap/start").send({ sources: [] }).expect(400);
    expect(response.body.error.code).toBe("CONSENT_REQUIRED");
  });
});
