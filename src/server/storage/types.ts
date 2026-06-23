import {
  BootstrapReview,
  BootstrapReviewCard,
  EventRecord,
  FocusState,
  ActionProposal,
  ActionDraft,
  Briefing,
  IntegrationSource,
  MigrationRecord,
  InteractionSignal,
  LifeEntity,
  LifeObject,
  MemoryCandidate,
  MemoryItem,
  ObservabilityEvent,
  OperatingModeState,
  PrivacyAuditEntry,
  UserSession
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
export type ActionDraftRepository = Repository<ActionDraft>;
export type IntegrationSourceRepository = Repository<IntegrationSource>;
export type BriefingRepository = Repository<Briefing>;
export type OperatingModeRepository = Repository<OperatingModeState>;
export type UserSessionRepository = Repository<UserSession>;
export type ObservabilityEventRepository = Repository<ObservabilityEvent>;
export type MigrationRepository = Repository<MigrationRecord>;

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
  actionDrafts: ActionDraftRepository;
  integrationSources: IntegrationSourceRepository;
  briefings: BriefingRepository;
  operatingModes: OperatingModeRepository;
  userSessions: UserSessionRepository;
  observabilityEvents: ObservabilityEventRepository;
  migrations: MigrationRepository;
  reset(): void;
  close?(): void;
}
