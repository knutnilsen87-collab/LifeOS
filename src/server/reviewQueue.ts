import { BootstrapReview, BootstrapReviewCard, FocusState } from "../shared/types.js";
import { visibleCardsForFocus } from "./domain.js";

export function decorateReviewQueueCards(cards: BootstrapReviewCard[]) {
  return cards.map((card) => ({
    ...card,
    queue: {
      visible_state: queueStateForCard(card),
      is_actionable: card.status === "pending",
      is_sensitive: card.card_type === "sensitive_item_review" || card.privacy.privacy_level === "third_party_sensitive"
    }
  }));
}

export function buildReviewQueueResponse(review: BootstrapReview, focus: FocusState) {
  const decoratedCards = decorateReviewQueueCards(review.cards);
  const visibleIds = new Set(visibleCardsForFocus(decoratedCards, focus).map((card) => card.card_id));
  const visibleCards = decoratedCards.filter((card) => visibleIds.has(card.card_id));

  return {
    bootstrap_id: review.bootstrap_id,
    mode: focus.state === "focus" ? "focus_suppressed" : "guided_cards",
    focus_state: focus.state,
    cards_total: decoratedCards.length,
    cards_remaining: decoratedCards.filter((card) => card.status === "pending").length,
    cards_suppressed: decoratedCards.length - visibleCards.length,
    state_counts: stateCounts(decoratedCards),
    cards: visibleCards
  };
}

function queueStateForCard(card: BootstrapReviewCard) {
  const handling = card.linked_objects.sensitive_handling;
  if (handling === "restricted") {
    return "restricted";
  }
  if (handling === "reviewed") {
    return "reviewed";
  }
  if (card.status === "approved") {
    return "saved";
  }
  if (card.status === "archived") {
    return "archived";
  }
  if (card.status === "rejected") {
    return "rejected";
  }
  if (card.status === "edited") {
    return "reviewed";
  }
  return "pending";
}

function stateCounts(cards: BootstrapReviewCard[]) {
  const counts: Record<string, number> = {
    pending: 0,
    saved: 0,
    archived: 0,
    restricted: 0,
    reviewed: 0,
    rejected: 0
  };
  cards.forEach((card) => {
    counts[queueStateForCard(card)] = (counts[queueStateForCard(card)] ?? 0) + 1;
  });
  return counts;
}

