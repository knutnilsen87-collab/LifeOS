import {
  BootstrapReview,
  BootstrapReviewCard,
  EventRecord,
  FocusState,
  InteractionSignal,
  MemoryCandidate,
  MemoryItem
} from "../shared/types.js";

export class LifeOSStore {
  events = new Map<string, EventRecord>();
  bootstrapReviews = new Map<string, BootstrapReview>();
  bootstrapCards = new Map<string, BootstrapReviewCard>();
  candidates = new Map<string, MemoryCandidate>();
  memoryItems = new Map<string, MemoryItem>();
  interactionSignals = new Map<string, InteractionSignal>();
  focusStates = new Map<string, FocusState>();

  reset() {
    this.events.clear();
    this.bootstrapReviews.clear();
    this.bootstrapCards.clear();
    this.candidates.clear();
    this.memoryItems.clear();
    this.interactionSignals.clear();
    this.focusStates.clear();
  }
}

export const store = new LifeOSStore();

