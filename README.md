# LifeOS MVP

LifeOS is a greenfield MVP scaffold built from the Codex handoff package in `docs/lifeos_codex_handoff`.

The current vertical slice proves:

- approved text input becomes Events
- Bootstrap Review extracts task, decision, and sensitive candidates
- backend builds UI-ready BootstrapReviewCards
- approve promotes a candidate to active MemoryItem
- archive does not create memory
- all card actions create InteractionSignals
- Focus Mode suppresses noncritical review cards

## Stack

- TypeScript
- Express API under `/api/v1`
- React and Vite review UI
- Ajv JSON Schema validation
- Vitest and Supertest
- MVP in-memory repositories

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

The dev command starts:

- API: `http://127.0.0.1:8000`
- UI: `http://127.0.0.1:5173`

## Important Files

- `status_bundle.txt` is the single source of truth for implementation status.
- `schemas/` contains canonical JSON Schemas.
- `examples/` contains demo fixtures from the handoff package.
- `src/server/domain.ts` contains the MVP product meaning and card logic.
- `src/client/App.tsx` renders the Review UI from ViewModels.
- `tests/` contains contract, domain, and API verification.

## API Snapshot

- `POST /api/v1/events`
- `GET /api/v1/events/:event_id`
- `POST /api/v1/bootstrap/start`
- `GET /api/v1/bootstrap/:bootstrap_id`
- `GET /api/v1/bootstrap/:bootstrap_id/cards`
- `POST /api/v1/bootstrap/:bootstrap_id/cards/:card_id/action`
- `GET /api/v1/memory/active`
- `GET /api/v1/memory/search?q=...`
- `GET /api/v1/focus-state`
- `POST /api/v1/focus-state`
- `GET /api/v1/action-proposals`
- `POST /api/v1/interaction-signals`
- `GET /api/v1/interaction-signals`

