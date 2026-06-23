import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { applyBootstrapCardAction, startBootstrapReview } from "../src/server/domain.js";
import {
  buildActionProposals,
  buildBriefing,
  buildLifeObjects,
  buildPrivacyAudit,
  getOperatingMode,
  integrationCatalog,
  reconcileMemoryLifecycle,
  setOperatingMode,
  storageArchitectureReport,
  systemReadiness,
  updateActionProposal,
  windowsQuickCapture
} from "../src/server/ecosystem.js";
import { LifeOSStore } from "../src/server/store.js";

const note = `Vi bestemte at MVP-en skal fokusere paa Memory Search, Bootstrap Review og Smart Reminders.
Pricing skal testes som abonnement paa 29-49 USD per maaned.
Jeg lovet aa kontakte investor innen fredag.
Ola nevnte at klientnotatet inneholder sensitiv informasjon og ikke bor deles eksternt uten godkjenning.`;

function seededStore() {
  const db = new LifeOSStore();
  const review = startBootstrapReview(
    {
      raw_text: note,
      sources: [{ source_type: "pasted_text", display_name: "Ecosystem sample", approved_by_user: true }]
    },
    db
  );
  for (const card of review.cards.filter((item) => item.card_type !== "sensitive_item_review")) {
    applyBootstrapCardAction(review.bootstrap_id, card.card_id, { action_type: "promote_to_active_memory" }, db);
  }
  const sensitive = review.cards.find((item) => item.card_type === "sensitive_item_review")!;
  applyBootstrapCardAction(review.bootstrap_id, sensitive.card_id, { action_type: "keep_restricted" }, db);
  return db;
}

describe("LifeOS ecosystem phases 14-26", () => {
  it("reconciles memory strata and keeps decisions long-term while tasks stay hot", () => {
    const db = seededStore();
    const lifecycle = reconcileMemoryLifecycle(db);

    expect(lifecycle.strata.find((item) => item.stratum === "hot")?.count).toBeGreaterThanOrEqual(1);
    expect(lifecycle.strata.find((item) => item.stratum === "long_term")?.count).toBeGreaterThanOrEqual(1);
    expect(lifecycle.memories.every((memory) => memory.state.lifecycle_policy)).toBe(true);
  });

  it("derives entities, decisions, tasks, commitments, privacy audit, and action proposals", () => {
    const db = seededStore();
    const objects = buildLifeObjects(db);
    const privacy = buildPrivacyAudit(db);
    const actions = buildActionProposals(db);

    expect(objects.entities.some((entity) => entity.name === "LifeOS")).toBe(true);
    expect(objects.objects.some((object) => object.object_type === "decision")).toBe(true);
    expect(objects.objects.some((object) => object.object_type === "task")).toBe(true);
    expect(privacy.entries.some((entry) => entry.verdict === "blocked")).toBe(true);
    expect(actions.proposals.some((proposal) => proposal.status === "pending_approval")).toBe(true);
  });

  it("requires approval before prepared action proposals can be executed", () => {
    const db = seededStore();
    const proposal = buildActionProposals(db).proposals[0];

    expect(() => updateActionProposal(db, proposal.proposal_id, { action: "execute" })).toThrow(
      "Proposal requires approval before execution"
    );
    expect(updateActionProposal(db, proposal.proposal_id, { action: "approve" }).proposal.status).toBe("approved");
    const executed = updateActionProposal(db, proposal.proposal_id, { action: "execute" });
    expect(executed.proposal.status).toBe("executed");
    expect(executed.execution?.external_side_effect_performed).toBe(false);
  });

  it("supports agent quick capture, integrations, mobile brief, modes, storage report, and readiness", () => {
    const db = seededStore();
    const capture = windowsQuickCapture(db, { raw_text: "Capture a strategy note from Windows Agent." });
    const integrations = integrationCatalog(db);
    const briefing = buildBriefing(db);
    const mode = setOperatingMode(db, { operating_mode: "deep_work", product_mode: "developer" });
    const report = storageArchitectureReport(db);
    const readiness = systemReadiness(db);

    expect(capture.event_id).toMatch(/^evt_/);
    expect(integrations.integrations.some((source) => source.source_type === "github")).toBe(true);
    expect(briefing.sections.length).toBeGreaterThanOrEqual(3);
    expect(mode.operating_mode).toBe("deep_work");
    expect(getOperatingMode(db).product_mode).toBe("developer");
    expect(report.production_target).toContain("postgres");
    expect(readiness.status).toBe("beta_ready_v0");
  });

  it("exposes the ecosystem through API endpoints", async () => {
    const db = seededStore();
    const app = createApp(db);

    await request(app).get("/api/v1/memory/lifecycle").expect(200).expect((response) => {
      expect(response.body.memories_total).toBeGreaterThanOrEqual(3);
    });
    await request(app).get("/api/v1/review-console").expect(200).expect((response) => {
      expect(response.body.lifecycle.memories_total).toBeGreaterThanOrEqual(3);
      expect(response.body.integrations.integrations_total).toBeGreaterThanOrEqual(8);
      expect(response.body.readiness.status).toBe("beta_ready_v0");
    });
    await request(app).get("/api/v1/mobile/home").expect(200).expect((response) => {
      expect(response.body.status).toBe("available_v0");
    });
    await request(app).post("/api/v1/agent/windows/quick-capture").send({ raw_text: "Quick capture from tray." }).expect(201);
    await request(app).post("/api/v1/modes").send({ operating_mode: "planning", product_mode: "strategy" }).expect(200);
  });
});
