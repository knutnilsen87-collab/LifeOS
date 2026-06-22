# Bootstrap Cold Start Flow v0.1

## Purpose

LifeOS must feel valuable within the first two hours after install.
The system should not start empty and silent.
It should ask permission to build an Initial State from selected sources.

## User flow

```text
Install
  -> Choose sources
  -> Local scan preview
  -> User approves import
  -> Ingest selected sources
  -> Extract candidate memories
  -> Show onboarding review
  -> User confirms what becomes active memory
  -> Create Initial State
```

## Required user consent

LifeOS must never scan arbitrary local sources without explicit user selection.

The first scan must be:
- user-initiated
- source-limited
- previewable
- cancellable
- auditable

## Source selection

MVP allowed sources:
- selected local folder
- pasted text
- uploaded text/markdown/docx later
- manual quick capture

Optional later:
- calendar
- email
- browser
- IDE
- meeting tools

## Bootstrap processing phases

- scanning_sources
- extracting_text
- creating_events
- finding_tasks
- finding_decisions
- finding_commitments
- classifying_privacy
- building_review_cards
- ready_for_review

## Bootstrap output

The BootstrapReview should produce:
- Event records
- MemoryCandidates
- Entities
- PrivacyTags
- ActionProposals
- BootstrapReviewCards

## First demo success

The demo is successful if:
1. User selects a local notes folder.
2. LifeOS creates Events.
3. LifeOS extracts at least:
   - one task
   - one decision
   - one sensitive item
4. LifeOS renders cards.
5. User promotes one card.
6. Promoted card creates an Active MemoryItem.
7. User archives one card.
8. Both actions create InteractionSignals.
