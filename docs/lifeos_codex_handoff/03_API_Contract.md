# LifeOS API Contract v0.1

Base path for MVP:
`/api/v1`

## Events

### POST /events
Creates an Event.

Request:
```json
{
  "schema_version": "event.v1",
  "event_type": "quick_capture",
  "source": {
    "source_type": "windows_agent",
    "origin": "local_device"
  },
  "content": {
    "content_type": "text/plain",
    "raw_text": "Remember to review pricing after demo"
  },
  "capture": {
    "capture_method": "global_hotkey",
    "user_initiated": true
  },
  "privacy": {
    "privacy_level": "private_user"
  }
}
```

Response:
```json
{
  "event_id": "evt_123",
  "status": "accepted"
}
```

### GET /events/:event_id
Returns one Event.

## Bootstrap

### POST /bootstrap/start
Starts a Bootstrap Review from user-approved sources.

Request:
```json
{
  "workspace_id": "wsp_personal_default",
  "sources": [
    {
      "source_type": "local_folder",
      "display_name": "Notes",
      "source_ref": "local_source_001",
      "approved_by_user": true
    }
  ]
}
```

Response:
```json
{
  "bootstrap_id": "boot_123",
  "status": "processing"
}
```

### GET /bootstrap/:bootstrap_id
Returns BootstrapReview status and summary.

### GET /bootstrap/:bootstrap_id/cards
Returns UI-ready BootstrapReviewCards.

Response:
```json
{
  "bootstrap_id": "boot_123",
  "mode": "guided_cards",
  "cards_total": 21,
  "cards_remaining": 17,
  "cards": []
}
```

### POST /bootstrap/:bootstrap_id/cards/:card_id/action
Applies a user action to a card.

Request:
```json
{
  "action_type": "promote_to_active_memory",
  "user_feedback": {
    "interaction": "swipe_right",
    "confidence_feedback": "correct",
    "note": null
  }
}
```

Response:
```json
{
  "status": "accepted",
  "result": {
    "memory_id": "mem_123",
    "memory_state": "active",
    "stratum": "hot"
  },
  "next_card_id": "card_002",
  "feedback": {
    "message": "Saved as active memory",
    "motion": "soft_confirm",
    "learned_signal": "accepted_task_candidate"
  }
}
```

## Memory

### GET /memory/active
Returns active memory items.

### GET /memory/search?q=...
Semantic search later. For first demo this can be keyword/simple search.

### POST /memory/:memory_id/feedback
Records feedback on a MemoryItem.

## Focus

### GET /focus-state
Returns current FocusState.

### POST /focus-state
Sets or updates FocusState.

## Action Proposals

### GET /action-proposals
Returns pending proposals.

### POST /action-proposals/:proposal_id/approve
Approves an ActionProposal.

### POST /action-proposals/:proposal_id/reject
Rejects an ActionProposal.

## Interaction Signals

### POST /interaction-signals
Records learning signals from UI interactions.
