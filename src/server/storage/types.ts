import {
  BootstrapReview,
  BootstrapReviewCard,
  EventRecord,
  FocusState,
  ActionProposal,
  Briefing,
  IntegrationSource,
  InteractionSignal,
  LifeEntity,
  LifeObject,
  MemoryCandidate,
  MemoryItem,
  OperatingModeState,
  PrivacyAuditEntry
} from "../../shared/types.js";

export interface Repository<T> {
  get(id: string): T | undefined;
  set(id: string, value: T): void;
  values(): T[];
  clear(): void;
  readonly size: number;
}

export type EventRepository = Repository<EventRecord>;
export type BootstrapReviewRepository = Repository<BootstrapReview>;
export type BootstrapReviewCardRepository = Repository<BootstrapReviewCard>;
export type MemoryCandidateRepository = Repository<MemoryCandidate>;
export type MemoryItemRepository = Repository<MemoryItem>;
export type InteractionSignalRepository = Repository<InteractionSignal>;
export type FocusStateRepository = Repository<FocusState>;
export type LifeEntityRepository = Repository<LifeEntity>;
export type LifeObjectRepository = Repository<LifeObject>;
export type PrivacyAuditRepository = Repository<PrivacyAuditEntry>;
export type ActionProposalRepository = Repository<ActionProposal>;
export type IntegrationSourceRepository = Repository<IntegrationSource>;
export type BriefingRepository = Repository<Briefing>;
export type OperatingModeRepository = Repository<OperatingModeState>;

export interface LifeOSStorage {
  readonly driver: "memory" | "sqlite";
  events: EventRepository;
  bootstrapReviews: BootstrapReviewRepository;
  bootstrapCards: BootstrapReviewCardRepository;
  candidates: MemoryCandidateRepository;
  memoryItems: MemoryItemRepository;
  interactionSignals: InteractionSignalRepository;
  focusStates: FocusStateRepository;
  lifeEntities: LifeEntityRepository;
  lifeObjects: LifeObjectRepository;
  privacyAudits: PrivacyAuditRepository;
  actionProposals: ActionProposalRepository;
  integrationSources: IntegrationSourceRepository;
  briefings: BriefingRepository;
  operatingModes: OperatingModeRepository;
  reset(): void;
  close?(): void;
}
