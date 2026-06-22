import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { LifeOSStore } from "../src/server/store.js";

const note = `Pricing skal testes som abonnement paa 29-49 USD per maaned.
Jeg lovet aa kontakte investor innen fredag.
Ola nevnte at klientnotatet inneholder sensitiv informasjon og ikke bor deles eksternt uten godkjenning.`;

describe("LifeOS API", () => {
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

