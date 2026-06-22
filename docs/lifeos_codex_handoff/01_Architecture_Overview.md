# LifeOS Architecture Overview v0.1

## High-level architecture

```text
[Windows Agent / Tray App]
        |
        v
[Local Ingestion Gateway]
        |
        v
[Local Queue + Normalization]
        |
        v
[Cloud Event API or Local Dev API]
        |
        v
[Memory Store]
        |
        v
[Review Card Builder]
        |
        v
[Frontend Review UI]
```

## Core principle

The Windows Agent should be thin.
The Local Ingestion Gateway handles local intake, normalization, dedupe, privacy labeling and sync.

## Primary components

### Windows Agent
Responsibilities:
- tray presence
- quick capture UI
- file picker
- source approval UI
- minimal bootstrap UI launcher
- local session/auth
- sends input to local gateway

Must not own:
- canonical schemas
- privacy policy logic
- memory promotion logic
- external action execution logic

### Local Ingestion Gateway
Responsibilities:
- local scan preview
- parse selected files
- extract text
- hash local paths
- normalize local events
- dedupe
- local queue
- retry
- dev/prod routing
- privacy seed classification

### Event API
Responsibilities:
- accepts normalized Events
- validates schema
- stores Events
- starts bootstrap runs
- manages review cards
- promotes memory candidates
- records interaction signals

### Memory Store
Recommended MVP:
- Postgres
- pgvector later when search is implemented

Initial tables:
- users
- workspaces
- sources
- events
- memory_items
- entities
- privacy_tags
- focus_states
- bootstrap_reviews
- bootstrap_review_cards
- action_proposals
- interaction_signals

### Review Card Builder
Maps canonical data into UI-ready cards.

Input:
- Event
- MemoryCandidate
- Entity
- PrivacyAssessment
- ActionProposal

Output:
- BootstrapReviewCard

## Deployment modes

### Dev mode
```text
Windows Agent -> Local Gateway -> http://localhost:8000
```

### Prod mode
```text
Windows Agent -> Local Gateway -> https://api.lifeos.ai
```

## Boundary rule

Canonical data is truth.
Cards are snapshots of the review experience.
