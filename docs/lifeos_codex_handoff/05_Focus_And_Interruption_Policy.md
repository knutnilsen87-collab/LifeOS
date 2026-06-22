# Focus and Interruption Policy v0.1

## Purpose

LifeOS must be helpful without becoming intrusive.

The system should interrupt only when:
1. the item is time-critical,
2. the item is relevant to active context,
3. the user is in an interruptible state.

## Focus states

- focus
- review
- deep_work
- meeting
- idle
- planning
- unknown

MVP can support only:
- focus
- review

## Focus Mode rules

When state is `focus`:
- suppress non-critical reminders
- suppress insight cards
- allow quick capture confirmation
- batch everything else
- show only tray status

Allowed notification types:
- critical_deadline
- user_requested_alarm

Suppressed:
- suggested_followup
- daily_review
- low_priority_task
- memory_insight

## Review Mode rules

When state is `review`:
- show Review Queue
- show max 3-5 important cards first
- allow action proposals
- allow memory review
- allow source inspection

## Manual override

MVP must include a manual toggle:
- Focus Mode
- Review Mode

Automatic inference can come later.

## Presence state mapping

| FocusState | Presence state | UX |
|---|---|---|
| focus | focus | quiet dot |
| review | review_ready | open review surface |
| processing | processing | subtle skeleton/progress |
| attention_required | attention_required | amber glow |

## Hard rule

If in doubt, do not interrupt.
