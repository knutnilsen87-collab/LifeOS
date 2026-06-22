# LifeOS Codex Handoff Package

This package is a build-ready implementation guide for the LifeOS MVP.

LifeOS MVP is a memory-first personal AI system with:
- local Windows capture
- local ingestion gateway
- event API
- memory promotion
- bootstrap review
- premium review cards
- focus-aware interruption control
- human-in-the-loop action proposals

## Primary build rule

Frontend renders state. Backend determines meaning.

Canonical data is the source of truth.
ViewModels make the product feel premium and fast.
FocusState controls presence.
InteractionSignals create learning.
Human approval protects user output.
Privacy tags protect third-party data.

## Recommended first milestone

Build the Day 2 skeleton:

1. Create schema validators.
2. Implement database migrations.
3. Implement `POST /events`.
4. Implement `POST /bootstrap/start`.
5. Implement `GET /bootstrap/:id/cards`.
6. Implement `POST /bootstrap/:id/cards/:card_id/action`.
7. Add a fake/simple Review UI that renders BootstrapReviewCards.
8. Validate that approving a card creates an Active MemoryItem.

## Read order for Codex

1. `00_Product_Experience_Contract.md`
2. `01_Architecture_Overview.md`
3. `02_Domain_Model.md`
4. `03_API_Contract.md`
5. `04_Bootstrap_Cold_Start_Flow.md`
6. `05_Focus_And_Interruption_Policy.md`
7. `06_Privacy_And_Consent_Model.md`
8. `07_Card_ViewModel_Contract.md`
9. `08_Implementation_Plan_Day_1_to_7.md`
10. `09_Definition_Of_Done.md`
11. `10_Codex_Execution_Instructions.md`
12. `schemas/*.schema.json`
13. `examples/*.json`

## Non-goals for first demo

Do not build:
- full dashboard
- autonomous external messaging
- broad OS-level monitoring
- complex graph database
- production-grade model training
- smart glasses integrations
- full calendar/email integrations

The first demo must prove:
- import existing notes
- generate Events
- extract candidate memories
- produce premium review cards
- promote/archive/edit via user action
- create Active Memory
- respect Focus Mode
- log InteractionSignals
