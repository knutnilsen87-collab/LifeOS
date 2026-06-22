# Task Checklist for Codex

Use this as the exact execution checklist.

## Phase A: Contracts

- [ ] Add all schema files from `/schemas`.
- [ ] Add examples from `/examples`.
- [ ] Add schema validation test harness.
- [ ] Validate all example JSON files.

## Phase B: Storage

- [ ] Create tables or in-memory repositories for Events.
- [ ] Create repository for BootstrapReviews.
- [ ] Create repository for BootstrapReviewCards.
- [ ] Create repository for MemoryItems.
- [ ] Create repository for InteractionSignals.
- [ ] Create repository for FocusState.

## Phase C: Event API

- [ ] Implement `POST /api/v1/events`.
- [ ] Implement `GET /api/v1/events/:event_id`.
- [ ] Ensure Events include privacy and audit data.

## Phase D: Bootstrap

- [ ] Implement `POST /api/v1/bootstrap/start`.
- [ ] Implement bootstrap processing phases.
- [ ] For MVP, use sample text extraction heuristics.
- [ ] Generate MemoryCandidates.
- [ ] Generate BootstrapReviewCards.
- [ ] Implement `GET /api/v1/bootstrap/:bootstrap_id`.
- [ ] Implement `GET /api/v1/bootstrap/:bootstrap_id/cards`.

## Phase E: Card Actions

- [ ] Implement `POST /api/v1/bootstrap/:bootstrap_id/cards/:card_id/action`.
- [ ] Promote action creates MemoryItem.
- [ ] Archive action changes card status only.
- [ ] Reject action changes card status only.
- [ ] All actions create InteractionSignal.

## Phase F: Focus

- [ ] Implement `GET /api/v1/focus-state`.
- [ ] Implement `POST /api/v1/focus-state`.
- [ ] In Focus Mode, non-critical cards are batched/suppressed from visible review prompts.
- [ ] In Review Mode, cards are visible.

## Phase G: Demo UI

- [ ] Render card ViewModels directly.
- [ ] Do not infer recommendation logic on frontend.
- [ ] Show source label.
- [ ] Show confidence reasons.
- [ ] Show privacy badge.
- [ ] Support approve/archive/source actions.
- [ ] Show skeleton/progress state during bootstrap.
- [ ] Add Focus/Review toggle.

## Phase H: Verification

- [ ] Run tests.
- [ ] Run sample meeting note through bootstrap.
- [ ] Confirm expected task card appears.
- [ ] Confirm expected decision card appears.
- [ ] Confirm sensitive item card appears.
- [ ] Confirm promote creates active MemoryItem.
- [ ] Confirm archive does not create MemoryItem.
- [ ] Confirm InteractionSignals are written.
