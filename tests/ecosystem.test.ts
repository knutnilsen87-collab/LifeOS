import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app.js";
import { applyBootstrapCardAction, startBootstrapReview } from "../src/server/domain.js";
import { draftForActionProposal } from "../src/server/actionDrafts.js";
import { backupManifest, betaReadiness, getOrCreateLocalSession, migrationPlan, uxReadiness } from "../src/server/betaOps.js";
import { buildEntityGraph, projectContext } from "../src/server/entityGraph.js";
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
import { importReadOnlySource } from "../src/server/integrationAdapters.js";
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

  it("implements phases 27-35 v1 contracts and local artifacts", () => {
    const db = seededStore();
    const dir = mkdtempSync(join(tmpdir(), "lifeos-integration-"));
    const sourcePath = join(dir, "approved-note.txt");
    writeFileSync(sourcePath, "Approved local file import for LifeOS project context.", "utf8");

    const imported = importReadOnlySource(db, { source_type: "local_file", path: sourcePath, approved_by_user: true });
    const graph = buildEntityGraph(db);
    const context = projectContext(db, "LifeOS");
    const proposal = buildActionProposals(db).proposals[0];
    updateActionProposal(db, proposal.proposal_id, { action: "approve" });
    const draft = draftForActionProposal(db, proposal.proposal_id);
    const session = getOrCreateLocalSession(db);
    const backup = backupManifest(db);
    const migrations = migrationPlan(db);
    const ux = uxReadiness(db);
    const beta = betaReadiness(db);

    expect(imported.status).toBe("imported");
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(context.context.decisions.length).toBeGreaterThanOrEqual(1);
    expect(draft.draft.external_side_effect_performed).toBe(false);
    expect(session.role).toBe("owner");
    expect(backup.checksum).toHaveLength(64);
    expect(migrations.migrations.some((item) => item.migration_id === "003_postgres_pgvector_target")).toBe(true);
    expect(ux.status).toBe("beta_ux_v1");
    expect(beta.status).toBe("beta_v1_ready_local");
    expect(existsSync(resolve(process.cwd(), "agent", "windows", "LifeOSAgent.ps1"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "Start_LifeOS_Agent.bat"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "public", "manifest.webmanifest"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "public", "service-worker.js"))).toBe(true);
    expect(readFileSync(resolve(process.cwd(), "migrations", "postgres", "001_core_pgvector.sql"), "utf8")).toContain("vector");
  });

  it("exposes phases 27-35 through API endpoints", async () => {
    const db = seededStore();
    const app = createApp(db);
    const proposals = await request(app).get("/api/v1/action-proposals").expect(200);
    const proposal = proposals.body.proposals[0];
    await request(app).post(`/api/v1/action-proposals/${proposal.proposal_id}/action`).send({ action: "approve" }).expect(200);
    await request(app).post(`/api/v1/action-proposals/${proposal.proposal_id}/draft`).send({}).expect(201).expect((response) => {
      expect(response.body.draft.external_side_effect_performed).toBe(false);
    });
    await request(app)
      .post("/api/v1/integrations/import")
      .send({ source_type: "github", repo: "knutnilsen87-collab/LifeOS", approved_by_user: true })
      .expect(201);
    await request(app).get("/api/v1/entity-graph").expect(200).expect((response) => {
      expect(response.body.nodes.length).toBeGreaterThan(0);
    });
    await request(app).get("/api/v1/projects/LifeOS/context").expect(200);
    await request(app).get("/api/v1/auth/session").expect(200);
    await request(app).post("/api/v1/observability").send({ area: "api", message: "phase smoke" }).expect(201);
    await request(app).get("/api/v1/backup/manifest").expect(200);
    await request(app).get("/api/v1/migrations").expect(200);
    await request(app).get("/api/v1/ux/readiness").expect(200);
    await request(app).get("/api/v1/beta/readiness").expect(200).expect((response) => {
      expect(response.body.status).toBe("beta_v1_ready_local");
    });
  });
});
