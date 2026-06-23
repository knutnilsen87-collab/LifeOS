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
- Local Ingestion Gateway previews and dedupes approved text sources
- Review Queue reports pending/saved/archived/restricted/reviewed state
- Semantic Memory Search retrieves active memories with source events
- Source-grounded answers cite saved memories and source Events
- Memory lifecycle strata classify active memories as hot, warm, long-term, archive, restricted, deleted, or redacted
- Review Console snapshot exposes life objects, privacy audit, action proposals, integrations, briefings, modes, and readiness
- Windows Agent and Mobile surfaces have verified v0 API contracts

## Stack

- TypeScript
- Express API under `/api/v1`
- React and Vite review UI
- Ajv JSON Schema validation
- Vitest and Supertest
- SQLite-backed local persistence by default
- In-memory storage adapter for explicit tests/dev fallback

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

## Storage

App runtime defaults to SQLite:

```bash
LIFEOS_STORAGE_DRIVER=sqlite
LIFEOS_SQLITE_PATH=.lifeos/lifeos.dev.sqlite
```

Supported drivers:

- `sqlite`: default runtime path, stores canonical JSON payloads in local SQLite tables.
- `memory`: explicit test/dev fallback only; data is lost when the process exits.

SQLite initialization is idempotent and creates these tables if needed:

- `events`
- `bootstrap_reviews`
- `bootstrap_review_cards`
- `memory_candidates`
- `memory_items`
- `interaction_signals`
- `focus_states`
- `life_entities`
- `life_objects`
- `privacy_audits`
- `action_proposals`
- `integration_sources`
- `briefings`
- `operating_modes`

Reset local dev data:

```powershell
Remove-Item -LiteralPath .lifeos\lifeos.dev.sqlite -Force
Remove-Item -LiteralPath .lifeos\lifeos.dev.sqlite-shm -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath .lifeos\lifeos.dev.sqlite-wal -Force -ErrorAction SilentlyContinue
```

Use memory storage explicitly:

```powershell
$env:LIFEOS_STORAGE_DRIVER="memory"
npm run dev:api
```

## Important Files

- `status_bundle.txt` is the single source of truth for implementation status.
- `schemas/` contains canonical JSON Schemas.
- `examples/` contains demo fixtures from the handoff package.
- `src/server/domain.ts` contains the MVP product meaning and card logic.
- `src/server/localIngestionGateway.ts` normalizes explicit approved text sources.
- `src/server/reviewQueue.ts` decorates review cards with queue state.
- `src/server/semanticMemory.ts` scores active memories and builds source-grounded answers.
- `src/server/ecosystem.ts` owns memory strata, life objects, privacy audit, action proposals, integrations, mobile/agent surfaces, modes, and readiness.
- `src/server/storage/` contains the storage contract plus memory and SQLite adapters.
- `src/client/App.tsx` renders the Review UI from ViewModels.
- `tests/` contains contract, domain, and API verification.

## API Snapshot

- `POST /api/v1/events`
- `GET /api/v1/events/:event_id`
- `POST /api/v1/ingestion/preview`
- `POST /api/v1/bootstrap/start`
- `GET /api/v1/bootstrap/:bootstrap_id`
- `GET /api/v1/bootstrap/:bootstrap_id/cards`
- `POST /api/v1/bootstrap/:bootstrap_id/cards/:card_id/action`
- `GET /api/v1/review-queue?bootstrap_id=...`
- `GET /api/v1/memory/active`
- `GET /api/v1/memory/lifecycle`
- `POST /api/v1/memory/:memory_id/stratum`
- `GET /api/v1/memory/search?q=...`
- `POST /api/v1/memory/answer`
- `GET /api/v1/life-objects`
- `GET /api/v1/privacy/audit`
- `GET /api/v1/focus-state`
- `POST /api/v1/focus-state`
- `GET /api/v1/review-console`
- `GET /api/v1/action-proposals`
- `POST /api/v1/action-proposals/:proposal_id/action`
- `GET /api/v1/agent/windows/status`
- `POST /api/v1/agent/windows/quick-capture`
- `GET /api/v1/integrations`
- `GET /api/v1/mobile/home`
- `GET /api/v1/briefings/daily`
- `GET /api/v1/storage/architecture`
- `GET /api/v1/modes`
- `POST /api/v1/modes`
- `GET /api/v1/readiness`
- `POST /api/v1/interaction-signals`
- `GET /api/v1/interaction-signals`
