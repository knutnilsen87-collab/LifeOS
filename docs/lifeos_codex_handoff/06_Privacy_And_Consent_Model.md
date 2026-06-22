# Privacy and Consent Model v0.1

## Purpose

LifeOS will contain information about the user and third parties.
Privacy must be modeled at entity and item level, not only at document level.

## Privacy levels

- public
- shared_business
- private_user
- third_party_sensitive
- strictly_personal
- secret
- unknown

Unknown must be treated as restrictive.

## Object-level tagging

Attach privacy tags to:
- Event
- MemoryItem
- Entity
- ActionProposal
- BootstrapReviewCard

## Allowed uses

Examples:
- personal_recall
- task_extraction
- semantic_search
- planning
- daily_review

## Forbidden uses

Examples:
- external_sharing_without_approval
- model_training
- public_summary
- cross_workspace_sharing
- autonomous_external_action

## Third-party rule

If data contains third-party sensitive info:
- do not include in proactive suggestions unless relevant
- do not include in external messages without user review
- do not train models on it
- do not show in broad summaries
- do not share across workspaces

## Secrets rule

Detected secrets must not be stored in raw form.
For MVP, classify as `secret` and redact the value.

## Approval rule

External action requires approval if:
- it sends a message
- it invites a person
- it changes a shared calendar
- it shares a document
- it includes third-party data
- it uses sensitive information
