# LifeOS Domain Model v0.1

## Core objects

### Event
A raw observation, import, capture or source-derived fact.
Everything starts as an Event.

### MemoryItem
A promoted unit of memory that LifeOS believes is worth retaining.

### MemoryCandidate
A temporary candidate derived from Events before user approval or automatic promotion.

### Entity
A person, project, company, topic, file, calendar event or other meaningful object.

### PrivacyTag
A classification attached to Event, MemoryItem, Entity or ActionProposal.

### FocusState
A snapshot of whether LifeOS may interrupt or should remain quiet.

### BootstrapReview
A cold-start or source-review session.

### BootstrapReviewCard
A UI-ready ViewModel for reviewing extracted candidates.

### ActionProposal
A proposed action that may require user approval.

### InteractionSignal
A learning signal emitted from user interactions.

## Event vs Memory

Not all Events become Memory.

```text
Raw Event
  -> Candidate Memory
  -> Active Memory
  -> Dormant Memory
  -> Archive
  -> Redacted / Deleted
```

## Memory strata

- hot: active now or this week
- warm: relevant in the last 30-90 days
- long_term: important decisions, people, projects, preferences
- archive: searchable but not included in active context
- cold_storage: retained for compliance/history, not normally searched

## Memory types

- decision
- task
- commitment
- preference
- person_note
- project_fact
- risk
- idea
- meeting_summary
- open_question

## Memory states

- candidate
- active
- dormant
- archived
- rejected
- deleted
- redacted

## Privacy levels

- public
- shared_business
- private_user
- third_party_sensitive
- strictly_personal
- secret
- unknown

Unknown must be treated conservatively.

## Autonomy levels

Level 0: Observe  
Level 1: Suggest  
Level 2: Draft  
Level 3: Prepare  
Level 4: Execute with approval  
Level 5: Auto-execute low-risk internal actions only  

MVP rule:
External actions always require approval.
