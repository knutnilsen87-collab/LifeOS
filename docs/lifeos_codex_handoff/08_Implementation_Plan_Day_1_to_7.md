# LifeOS MVP Implementation Plan: Day 1-7

## Day 1: Contracts and repo skeleton

Deliver:
- repo skeleton
- schema files
- basic validator setup
- architecture docs committed

Files:
- schemas/event.v1.schema.json
- schemas/memory_item.v1.schema.json
- schemas/focus_state.v1.schema.json
- schemas/bootstrap_review.v1.schema.json
- schemas/bootstrap_review_card.v1.schema.json
- schemas/action_proposal.v1.schema.json
- schemas/interaction_signal.v1.schema.json

Success:
- schemas validate examples
- tests run locally

## Day 2: Event API and Bootstrap skeleton

Deliver:
- POST /events
- POST /bootstrap/start
- GET /bootstrap/:id
- database migrations
- in-memory or persistent storage

Success:
- can create Event
- can start BootstrapReview
- can retrieve BootstrapReview status

## Day 3: Local import and candidate extraction

Deliver:
- local file/text ingestion
- simple text extraction
- heuristic extraction for tasks/decisions/commitments
- MemoryCandidate internal object

Success:
- importing sample notes produces candidate items

## Day 4: Review Card Builder

Deliver:
- buildBootstrapReviewCard mapper
- GET /bootstrap/:id/cards
- card examples
- mapper tests

Success:
- candidate tasks/decisions become premium-ready cards

## Day 5: Card actions and memory promotion

Deliver:
- POST /bootstrap/:id/cards/:card_id/action
- promote to MemoryItem
- archive/reject candidate
- InteractionSignal logging

Success:
- approve creates active MemoryItem
- archive updates card/candidate state
- interaction signal exists

## Day 6: FocusState and Review Queue

Deliver:
- GET/POST /focus-state
- Review Queue endpoint or simple screen
- Focus Mode suppresses noncritical items

Success:
- Focus Mode hides/suppresses review prompts
- Review Mode shows top cards

## Day 7: Demo polish

Deliver:
- simple premium UI shell
- skeleton/progress states
- source labels
- confidence reasons
- privacy badges
- 3-5 card review flow

Success demo:
- user imports notes
- LifeOS finds tasks/decisions/sensitive items
- cards render
- user approves/promotes
- user archives
- Focus Mode suppresses
- InteractionSignals logged
