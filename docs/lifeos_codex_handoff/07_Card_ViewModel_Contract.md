# Card ViewModel Contract v0.1

## Core rule

Frontend renders state.
Backend determines meaning.

## Why cards exist

BootstrapReviewCard is a UI-ready snapshot that allows all clients to render the same decision experience without reimplementing product logic.

## Canonical vs presentation

Canonical data:
- Event
- MemoryItem
- Entity
- PrivacyTag
- ActionProposal

Presentation:
- BootstrapReviewCard

## Required card fields

- card_id
- card_type
- status
- display.title
- display.subtitle
- display.body
- display.source_label
- display.confidence_label
- display.privacy_label
- display.priority_label
- visual.intent
- visual.accent
- recommendation.recommended_action
- recommendation.reason
- recommendation.requires_approval
- trust.confidence
- trust.confidence_reasons
- privacy.privacy_level
- actions[]
- linked_objects

## Visual metadata rule

Backend must not return raw CSS.
Backend returns semantic visual intent.

Good:
```json
{
  "accent": "amber",
  "intent": "attention_required",
  "motion_hint": "soft_reveal"
}
```

Bad:
```json
{
  "color": "#F59E0B",
  "blur": "20px"
}
```

## Supported card types

- task_candidate
- decision_candidate
- commitment_candidate
- person_context_candidate
- project_context_candidate
- sensitive_item_review
- reminder_suggestion
- archive_suggestion

## Supported actions

- promote_to_active_memory
- archive_candidate
- reject_candidate
- edit_candidate
- create_reminder
- view_source
- mark_sensitive
- mark_not_sensitive

## Gesture map

MVP:
- swipe_right -> promote
- swipe_left -> archive
- tap -> view_details
- long_press -> view_source

Desktop equivalents:
- Enter -> promote
- Backspace -> archive
- Space -> view_details
