# Definition of Done v0.1

## Product DoD

The demo is done only if:
- LifeOS does not feel like a dashboard.
- Quick Capture is minimal and fast.
- Bootstrap Review shows meaningful findings.
- Cards explain why they exist.
- Cards show source labels.
- Cards show privacy labels.
- User can approve/archive cards.
- Approved cards become Active Memory.
- Actions create InteractionSignals.
- Focus Mode suppresses non-critical interruptions.

## Backend DoD

- Schemas exist and validate examples.
- API endpoints return stable JSON.
- Backend generates BootstrapReviewCards.
- Frontend does not infer privacy/recommendation/confidence meaning.
- Card actions are idempotent enough for MVP or safely retryable.
- Events retain source refs.
- MemoryItems retain source refs.
- InteractionSignals are persisted.
- PrivacyTag is attached or derivable for all cards.

## Frontend DoD

- No raw JSON displayed.
- No blocking spinner as primary loading state.
- Review cards render from ViewModel directly.
- Cards support primary/secondary actions.
- Focus/Review Mode visible.
- Source details can be opened or stubbed.
- Motion/visual polish is semantic-token driven.

## Privacy DoD

- User must approve source scanning.
- Unknown privacy is treated as restrictive.
- Third-party sensitive items are marked.
- External action proposals require approval.
- Secrets are not stored raw.

## Non-goals

Do not block demo on:
- full semantic search
- production auth
- full calendar integration
- email sending
- graph database
- live meeting bot
- autonomous action execution
