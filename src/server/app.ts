import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import {
  applyBootstrapCardAction,
  createEvent,
  getCurrentFocusState,
  recordInteractionSignal,
  setFocusState,
  startBootstrapReview,
  visibleCardsForFocus
} from "./domain.js";
import { AppError, notFound } from "./errors.js";
import { LifeOSStore, store as defaultStore } from "./store.js";

export function createApp(db: LifeOSStore = defaultStore) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/v1/health", (_req, res) => {
    res.json({ status: "ok", service: "lifeos-mvp" });
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
      const visibleCards = visibleCardsForFocus(review.cards, focus);
      res.json({
        bootstrap_id: review.bootstrap_id,
        mode: focus.state === "focus" ? "focus_suppressed" : "guided_cards",
        focus_state: focus.state,
        cards_total: review.cards.length,
        cards_remaining: review.cards.filter((card) => card.status === "pending").length,
        cards_suppressed: review.cards.length - visibleCards.length,
        cards: visibleCards
      });
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

  app.get("/api/v1/memory/search", (req, res) => {
    const query = String(req.query.q ?? "").toLowerCase();
    const items = [...db.memoryItems.values()].filter((item) => {
      const haystack = `${item.title} ${item.summary} ${item.canonical_text}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    res.json({ query, items_total: items.length, items });
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

  app.get("/api/v1/action-proposals", (_req, res) => {
    res.json({ proposals_total: 0, proposals: [] });
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

