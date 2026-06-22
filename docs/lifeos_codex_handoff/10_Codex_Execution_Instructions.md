# Codex Execution Instructions

You are implementing the LifeOS MVP skeleton.

## Primary goal

Build the smallest working vertical slice:

User-approved input
-> Event
-> BootstrapReview
-> BootstrapReviewCard
-> user action
-> Active MemoryItem
-> InteractionSignal

## Architectural rules

1. Do not put product meaning in frontend.
2. Do not make frontend infer privacy, confidence or recommended action.
3. Do not store everything as active memory.
4. Do not perform external actions automatically.
5. Do not scan local files without explicit source approval.
6. Do not create a broad dashboard for the first demo.
7. Keep canonical objects separate from ViewModels.
8. All cards must reference source Events.
9. All approved actions must create InteractionSignals.
10. Focus Mode must suppress non-critical review prompts.

## Preferred implementation stack

Use the existing project stack if present.
If starting from scratch, recommended:
- TypeScript
- Node/NestJS or Fastify
- Postgres or SQLite for local MVP
- Zod or JSON Schema validation
- React/Tauri or simple web UI for review

## First implementation order

1. Add schema files.
2. Add example fixtures.
3. Add validator tests.
4. Add API route skeletons.
5. Add in-memory repositories if database is not ready.
6. Add bootstrap card mapper.
7. Add card action handlers.
8. Add interaction signal persistence.
9. Add minimal UI renderer if frontend exists.

## Required functions

Implement or stub:

```ts
validateEvent(input): Event
createEvent(input): Event
startBootstrapReview(input): BootstrapReview
extractMemoryCandidates(events): MemoryCandidate[]
assessPrivacy(candidate): PrivacyAssessment
buildBootstrapReviewCard(input): BootstrapReviewCard
applyBootstrapCardAction(cardId, action): CardActionResult
promoteCandidateToMemory(candidate): MemoryItem
recordInteractionSignal(input): InteractionSignal
getCurrentFocusState(userId): FocusState
```

## Mapper requirements

`buildBootstrapReviewCard` must output:
- card_id
- card_type
- display title/subtitle/body
- source_label
- privacy_label
- confidence_label
- recommendation
- confidence reasons
- available actions
- linked canonical object ids

## Testing requirements

Create tests for:
- Event validation
- BootstrapReview creation
- Memory candidate extraction from sample text
- Card building for task candidate
- Card building for sensitive item
- Promote action creates MemoryItem
- Archive action does not create MemoryItem
- Interactions create InteractionSignal
- Focus mode suppresses noncritical item visibility

## Sample input for tests

Use `examples/sample_meeting_note.txt`.

Expected extraction:
- one task/commitment about contacting investor by Friday
- one decision about testing subscription pricing
- one sensitive third-party business item if detected

## Output standard

Every route must return JSON only.
Errors should be structured:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid Event payload",
    "details": []
  }
}
```
