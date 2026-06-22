# LifeOS Product Experience Contract v0.1

## Core product promise

LifeOS is not a dashboard.
LifeOS is a quiet command center for personal context, memory, review and action.

It should feel like a trusted colleague:
- always available
- rarely interrupting
- clear about why it suggests something
- conservative about user output
- strict about privacy
- useful within the first two hours after install

## Locked UX rules

1. Focus Mode means minimal presence.
2. Review Mode means guided decision surface.
3. Bootstrap Review is the first wow moment.
4. Cards are the primary unit of attention.
5. Human approval is required for external actions.
6. Confidence explanation is mandatory for recommendations.
7. Privacy state is visible when relevant.
8. Frontend renders state; backend determines meaning.
9. Quick Capture is a thought valve, not a chatbot.
10. LifeOS should show the few things that matter now, not everything it knows.

## Product surfaces

### 1. Tray Presence
A tiny status surface that indicates state without demanding attention.

States:
- idle
- capturing
- processing
- focus
- review_ready
- attention_required
- sync_error

### 2. Quick Capture
A global hotkey opens a minimal input field.
On Enter, the note disappears and becomes an Event.

No AI dialogue during capture.

### 3. Bootstrap Review
The first-use experience where LifeOS scans user-approved sources, extracts memory candidates, and presents review cards.

### 4. Review Queue
The primary decision surface for daily use.
Shows 3-5 important items first.

## Premium feel requirements

- no raw JSON shown to users
- no noisy dashboard in first demo
- no spinner-first loading; use progress states and skeleton cards
- all recommendations have source labels
- all recommendations explain confidence
- sensitive cards are clearly marked
- focus mode suppresses non-critical interruptions
- card actions produce learning signals
