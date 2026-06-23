import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import {
  applyBootstrapCardAction,
  createEvent,
  getCurrentFocusState,
  recordInteractionSignal,
  setFocusState,
  startBootstrapReview
} from "./domain.js";
import { AppError, notFound } from "./errors.js";
import { buildIngestionPreview } from "./localIngestionGateway.js";
import { buildReviewQueueResponse } from "./reviewQueue.js";
import { answerFromMemory, semanticSearchMemories } from "./semanticMemory.js";
import { LifeOSStorage, store as defaultStore } from "./store.js";
import {
  buildActionProposals,
  buildBriefing,
  buildLifeObjects,
  buildPrivacyAudit,
  getOperatingMode,
  integrationCatalog,
  mobileHome,
  reconcileMemoryLifecycle,
  reviewConsoleSnapshot,
  setOperatingMode,
  storageArchitectureReport,
  systemReadiness,
  updateActionProposal,
  updateMemoryStratum,
  windowsAgentStatus,
  windowsQuickCapture
} from "./ecosystem.js";

export function createApp(db: LifeOSStorage = defaultStore) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", service: "lifeos", readiness: systemReadiness(db) });
  });

  app.post("/api/v1/events", (req, res, next) => {
    try {
      const event = createEvent(req.body, db);
      res.status(201).json({ event_id: event.event_id, status: "accepted", event });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/events/:event_id", (req, res, next) => {
    try {
      const event = db.events.get(req.params.event_id);
      if (!event) {
        throw notFound("Event not found");
      }
      res.json(event);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/bootstrap/start", (req, res, next) => {
    try {
      const review = startBootstrapReview(req.body, db);
      res.status(201).json({
        bootstrap_id: review.bootstrap_id,
        status: review.status,
        summary: review.summary
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/ingestion/preview", (req, res, next) => {
    try {
      res.json(buildIngestionPreview(req.body));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/bootstrap/:bootstrap_id", (req, res, next) => {
    try {
      const review = db.bootstrapReviews.get(req.params.bootstrap_id);
      if (!review) {
        throw notFound("BootstrapReview not found");
      }
      res.json(review);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/bootstrap/:bootstrap_id/cards", (req, res, next) => {
    try {
      const review = db.bootstrapReviews.get(req.params.bootstrap_id);
      if (!review) {
        throw notFound("BootstrapReview not found");
      }
      const focus = getCurrentFocusState(review.user_id, db);
      res.json(buildReviewQueueResponse(review, focus));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/review-queue", (req, res, next) => {
    try {
      const reviews = db.bootstrapReviews.values();
      const review =
        reviews.find((item) => item.bootstrap_id === req.query.bootstrap_id) ??
        [...reviews].reverse().find((item) => item.status === "ready_for_review");
      if (!review) {
        res.json({
          bootstrap_id: null,
          mode: "empty",
          focus_state: "review",
          cards_total: 0,
          cards_remaining: 0,
          cards_suppressed: 0,
          state_counts: { pending: 0, saved: 0, archived: 0, restricted: 0, reviewed: 0, rejected: 0 },
          cards: []
        });
        return;
      }
      const focus = getCurrentFocusState(review.user_id, db);
      res.json(buildReviewQueueResponse(review, focus));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/v1/bootstrap/:bootstrap_id/cards/:card_id/action", (req, res, next) => {
    try {
      const result = applyBootstrapCardAction(req.params.bootstrap_id, req.params.card_id, req.body, db);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/memory/active", (_req, res) => {
    const items = [...db.memoryItems.values()].filter((item) => item.state.memory_state === "active");
    res.json({ items_total: items.length, items });
  });

  app.get("/api/v1/memory/lifecycle", (_req, res) => {
    res.json(reconcileMemoryLifecycle(db));
  });

  app.post("/api/v1/memory/:memory_id/stratum", (req, res, next) => {
    try {
      res.json(updateMemoryStratum(db, req.params.memory_id, req.body?.stratum));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/memory/search", (req, res) => {
    const query = String(req.query.q ?? "");
    const limit = Number(req.query.limit ?? 5);
    res.json(semanticSearchMemories(db, query, limit));
  });

  app.post("/api/v1/memory/answer", (req, res) => {
    const question = String(req.body?.question ?? "");
    res.json(answerFromMemory(db, question));
  });

  app.get("/api/v1/focus-state", (req, res) => {
    const focus = getCurrentFocusState(String(req.query.user_id ?? "usr_local_default"), db);
    res.json(focus);
  });

  app.post("/api/v1/focus-state", (req, res, next) => {
    try {
      res.json(setFocusState(req.body, db));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/life-objects", (_req, res) => {
    res.json(buildLifeObjects(db));
  });

  app.get("/api/v1/privacy/audit", (_req, res) => {
    res.json(buildPrivacyAudit(db));
  });

  app.get("/api/v1/action-proposals", (_req, res) => {
    res.json(buildActionProposals(db));
  });

  app.post("/api/v1/action-proposals/:proposal_id/action", (req, res, next) => {
    try {
      res.json(updateActionProposal(db, req.params.proposal_id, req.body));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/review-console", (_req, res) => {
    res.json(reviewConsoleSnapshot(db));
  });

  app.get("/api/v1/agent/windows/status", (_req, res) => {
    res.json(windowsAgentStatus(db));
  });

  app.post("/api/v1/agent/windows/quick-capture", (req, res, next) => {
    try {
      res.status(201).json(windowsQuickCapture(db, req.body));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/integrations", (_req, res) => {
    res.json(integrationCatalog(db));
  });

  app.get("/api/v1/mobile/home", (_req, res) => {
    res.json(mobileHome(db));
  });

  app.get("/api/v1/briefings/daily", (_req, res) => {
    res.json(buildBriefing(db, "daily"));
  });

  app.get("/api/v1/storage/architecture", (_req, res) => {
    res.json(storageArchitectureReport(db));
  });

  app.get("/api/v1/modes", (_req, res) => {
    res.json(getOperatingMode(db));
  });

  app.post("/api/v1/modes", (req, res) => {
    res.json(setOperatingMode(db, req.body));
  });

  app.get("/api/v1/readiness", (_req, res) => {
    res.json(systemReadiness(db));
  });

  app.post("/api/v1/interaction-signals", (req, res, next) => {
    try {
      const signal = recordInteractionSignal(req.body, db);
      res.status(201).json(signal);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/v1/interaction-signals", (_req, res) => {
    const signals = [...db.interactionSignals.values()];
    res.json({ signals_total: signals.length, signals });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
        details: []
      }
    });
  });

  return app;
}
