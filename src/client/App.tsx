import { useEffect, useMemo, useState } from "react";
import { BootstrapReviewCard, FocusState } from "../shared/types.js";
import { ArchiveIcon, CheckIcon, DotIcon, EyeIcon, PlayIcon, ShieldIcon } from "./icons.js";

const sampleNote = `LifeOS mote 21. juni

Vi bestemte at MVP-en skal fokusere paa Memory Search, Bootstrap Review og Smart Reminders.
Pricing skal testes som abonnement paa 29-49 USD per maaned.

Jeg lovet aa kontakte investor innen fredag med en kort demo og en oppsummering av produktstrategien.

Ola nevnte at klientnotatet inneholder sensitiv informasjon og ikke bor deles eksternt uten godkjenning.`;

type CardsResponse = {
  bootstrap_id: string;
  mode: string;
  focus_state: string;
  cards_total: number;
  cards_remaining: number;
  cards_suppressed: number;
  state_counts?: Record<string, number>;
  cards: BootstrapReviewCard[];
};

export function App() {
  const [focus, setFocus] = useState<FocusState | null>(null);
  const [bootstrapId, setBootstrapId] = useState<string | null>(null);
  const [cardsResponse, setCardsResponse] = useState<CardsResponse | null>(null);
  const [note, setNote] = useState(sampleNote);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Ready to build an initial state from approved text.");
  const [activeMemoryCount, setActiveMemoryCount] = useState(0);
  const [sourceCard, setSourceCard] = useState<BootstrapReviewCard | null>(null);
  const [memoryQuestion, setMemoryQuestion] = useState("What did we decide about pricing?");
  const [groundedAnswer, setGroundedAnswer] = useState<Record<string, any> | null>(null);
  const [consoleSnapshot, setConsoleSnapshot] = useState<Record<string, any> | null>(null);
  const [betaSnapshot, setBetaSnapshot] = useState<Record<string, any> | null>(null);
  const [graphSnapshot, setGraphSnapshot] = useState<Record<string, any> | null>(null);

  const pendingCards = cardsResponse?.cards ?? [];
  const presence = focus?.state === "focus" ? "focus" : cardsResponse?.cards_remaining ? "review_ready" : busy ? "processing" : "idle";

  useEffect(() => {
    refreshFocus();
  }, []);

  useEffect(() => {
    if (bootstrapId) {
      refreshCards(bootstrapId);
      refreshMemory();
      refreshConsole();
    }
  }, [bootstrapId, focus?.state]);

  const progressLabel = useMemo(() => {
    if (!cardsResponse) {
      return "No review has been started";
    }
    if (cardsResponse.focus_state === "focus") {
      return `${cardsResponse.cards_suppressed} item(s) batched until Review Mode`;
    }
    return `${cardsResponse.cards_remaining} card(s) ready`;
  }, [cardsResponse]);

  async function refreshFocus() {
    const response = await fetch("/api/v1/focus-state");
    setFocus(await response.json());
  }

  async function refreshMemory() {
    const response = await fetch("/api/v1/memory/active");
    const data = await response.json();
    setActiveMemoryCount(data.items_total);
  }

  async function refreshConsole() {
    const [consoleResponse, betaResponse, graphResponse] = await Promise.all([
      fetch("/api/v1/review-console"),
      fetch("/api/v1/beta/readiness"),
      fetch("/api/v1/entity-graph")
    ]);
    setConsoleSnapshot(await consoleResponse.json());
    setBetaSnapshot(await betaResponse.json());
    setGraphSnapshot(await graphResponse.json());
  }

  async function refreshCards(id: string) {
    const response = await fetch(`/api/v1/bootstrap/${id}/cards`);
    setCardsResponse(await response.json());
  }

  async function startBootstrap() {
    setBusy(true);
    setMessage("Scanning approved text and building review cards...");
    const response = await fetch("/api/v1/bootstrap/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: "wsp_personal_default",
        raw_text: note,
        sources: [
          {
            source_type: "pasted_text",
            display_name: "Approved meeting note",
            source_ref: "demo_meeting_note",
            approved_by_user: true
          }
        ]
      })
    });
    const data = await response.json();
    setBootstrapId(data.bootstrap_id);
    setMessage("Bootstrap Review is ready.");
    setBusy(false);
    await refreshConsole();
  }

  async function changeFocus(state: "focus" | "review") {
    const response = await fetch("/api/v1/focus-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state })
    });
    setFocus(await response.json());
  }

  async function act(card: BootstrapReviewCard, action_type: string) {
    if (!bootstrapId) {
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/v1/bootstrap/${bootstrapId}/cards/${card.card_id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type,
        user_feedback: {
          interaction: action_type === "archive_candidate" ? "button_archive" : "button_accept",
          confidence_feedback: "correct"
        }
      })
    });
    const data = await response.json();
    setMessage(data.feedback?.message ?? "Action recorded.");
    await refreshCards(bootstrapId);
    await refreshMemory();
    await refreshConsole();
    setBusy(false);
  }

  function handleCardAction(card: BootstrapReviewCard, action: Record<string, unknown>) {
    const actionType = String(action.action_type);
    if (actionType === "view_source") {
      setMessage(`Source: ${String(card.display.source_label)}`);
      setSourceCard(card);
      return;
    }
    void act(card, actionType);
  }

  async function askMemory() {
    if (!memoryQuestion.trim()) {
      return;
    }
    setBusy(true);
    const response = await fetch("/api/v1/memory/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: memoryQuestion })
    });
    setGroundedAnswer(await response.json());
    setBusy(false);
  }

  async function setMode(operating_mode: string, product_mode: string) {
    const response = await fetch("/api/v1/modes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operating_mode, product_mode })
    });
    const mode = await response.json();
    setConsoleSnapshot((current) => ({ ...(current ?? {}), mode }));
  }

  async function proposalAction(proposalId: string, action: string) {
    setBusy(true);
    await fetch(`/api/v1/action-proposals/${proposalId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    await refreshConsole();
    setBusy(false);
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <div className={`presence presence-${presence}`}>
            <DotIcon size={14} />
            <span>{presence.replace("_", " ")}</span>
          </div>
          <h1>LifeOS Review</h1>
        </div>
        <div className="mode-toggle" aria-label="Focus mode">
          <button className={focus?.state === "focus" ? "active" : ""} onClick={() => changeFocus("focus")}>
            Focus
          </button>
          <button className={focus?.state === "review" ? "active" : ""} onClick={() => changeFocus("review")}>
            Review
          </button>
        </div>
      </section>

      <section className="capture-band">
        <div className="capture-copy">
          <h2>Approved Source</h2>
          <p>{message}</p>
          <div className="mini-stats">
            <span>{progressLabel}</span>
            <span>{activeMemoryCount} active memories</span>
            {cardsResponse?.state_counts && <span>{cardsResponse.state_counts.restricted ?? 0} restricted</span>}
          </div>
        </div>
        <div className="capture-tool">
          <textarea value={note} onChange={(event) => setNote(event.target.value)} aria-label="Approved text source" />
          <button className="primary-action" onClick={startBootstrap} disabled={busy || !note.trim()} title="Start Bootstrap Review">
            <PlayIcon size={18} />
            <span>Start Review</span>
          </button>
        </div>
      </section>

      {busy && (
        <section className="skeleton-row" aria-label="Processing">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </section>
      )}

      <section className="memory-band">
        <div>
          <span className="eyebrow">Memory Search</span>
          <h2>Source-grounded answers</h2>
        </div>
        <div className="memory-search">
          <input value={memoryQuestion} onChange={(event) => setMemoryQuestion(event.target.value)} aria-label="Ask saved memory" />
          <button onClick={askMemory} disabled={busy || !memoryQuestion.trim()} title="Ask saved memory">
            Ask
          </button>
        </div>
        {groundedAnswer && (
          <div className="answer-panel">
            <p>{String(groundedAnswer.answer)}</p>
            <div className="badges">
              <span>{groundedAnswer.grounded ? "grounded" : "not grounded"}</span>
              <span>{`confidence ${Number(groundedAnswer.confidence ?? 0).toFixed(2)}`}</span>
            </div>
            {Array.isArray(groundedAnswer.citations) && groundedAnswer.citations.length > 0 && (
              <ol>
                {groundedAnswer.citations.map((citation: Record<string, unknown>) => (
                  <li key={String(citation.citation_id)}>
                    <strong>{String(citation.memory_title)}</strong>
                    <span>{String(citation.excerpt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </section>

      {consoleSnapshot && (
        <section className="console-grid">
          <div className="console-panel panel-wide">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Memory Layers</span>
                <h2>Lifecycle</h2>
              </div>
              <span className="panel-count">{consoleSnapshot.lifecycle?.memories_total ?? 0}</span>
            </div>
            <div className="strata-row">
              {(consoleSnapshot.lifecycle?.strata ?? []).map((item: Record<string, unknown>) => (
                <span key={String(item.stratum)}>{`${String(item.stratum)} ${Number(item.count ?? 0)}`}</span>
              ))}
            </div>
          </div>

          <div className="console-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Objects</span>
                <h2>Decisions / Tasks</h2>
              </div>
              <span className="panel-count">{consoleSnapshot.objects?.objects_total ?? 0}</span>
            </div>
            <ul className="compact-list">
              {(consoleSnapshot.objects?.objects ?? []).slice(0, 4).map((item: Record<string, unknown>) => (
                <li key={String(item.object_id)}>
                  <strong>{String(item.title)}</strong>
                  <span>{`${String(item.object_type)} · ${String(item.status)}`}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="console-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Privacy</span>
                <h2>Audit</h2>
              </div>
              <span className="panel-count">{consoleSnapshot.privacy?.blocked_total ?? 0}</span>
            </div>
            <ul className="compact-list">
              {(consoleSnapshot.privacy?.entries ?? []).slice(0, 4).map((entry: Record<string, unknown>) => (
                <li key={String(entry.audit_id)}>
                  <strong>{String(entry.verdict)}</strong>
                  <span>{String(entry.reason)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="console-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Action Layer</span>
                <h2>Proposals</h2>
              </div>
              <span className="panel-count">{consoleSnapshot.actions?.proposals_total ?? 0}</span>
            </div>
            <ul className="compact-list">
              {(consoleSnapshot.actions?.proposals ?? []).slice(0, 3).map((proposal: Record<string, unknown>) => (
                <li key={String(proposal.proposal_id)}>
                  <strong>{String(proposal.title)}</strong>
                  <span>{String(proposal.status)}</span>
                  <div className="inline-actions">
                    <button onClick={() => proposalAction(String(proposal.proposal_id), "approve")} disabled={busy}>
                      Approve
                    </button>
                    <button onClick={() => proposalAction(String(proposal.proposal_id), "execute")} disabled={busy}>
                      Prepare
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="console-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Brief</span>
                <h2>{String(consoleSnapshot.briefing?.title ?? "Daily LifeOS Brief")}</h2>
              </div>
            </div>
            <ul className="compact-list">
              {(consoleSnapshot.briefing?.sections ?? []).map((section: Record<string, unknown>) => (
                <li key={String(section.title)}>
                  <strong>{String(section.title)}</strong>
                  <span>{Array.isArray(section.items) && section.items.length > 0 ? section.items.join(", ") : "Clear"}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="console-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Modes</span>
                <h2>{`${String(consoleSnapshot.mode?.operating_mode ?? "review")} / ${String(consoleSnapshot.mode?.product_mode ?? "founder")}`}</h2>
              </div>
            </div>
            <div className="mode-buttons">
              <button onClick={() => setMode("deep_work", "developer")}>Dev</button>
              <button onClick={() => setMode("planning", "strategy")}>Strategy</button>
              <button onClick={() => setMode("review", "founder")}>Founder</button>
            </div>
          </div>

          <div className="console-panel panel-wide">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Integrations / Mobile</span>
                <h2>Surfaces</h2>
              </div>
              <span className="panel-count">{consoleSnapshot.integrations?.integrations_total ?? 0}</span>
            </div>
            <div className="strata-row">
              {(consoleSnapshot.integrations?.integrations ?? []).map((source: Record<string, unknown>) => (
                <span key={String(source.integration_id)}>{`${String(source.display_name)} · ${String(source.ingestion_status)}`}</span>
              ))}
            </div>
          </div>

          <div className="console-panel panel-wide">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Beta V1</span>
                <h2>{String(betaSnapshot?.status ?? "local readiness")}</h2>
              </div>
              <span className="panel-count">{graphSnapshot?.nodes?.length ?? 0}</span>
            </div>
            <div className="strata-row">
              <span>{`session ${String(betaSnapshot?.session?.role ?? "owner")}`}</span>
              <span>{`backup ${String(betaSnapshot?.backup?.checksum ?? "").slice(0, 8)}`}</span>
              <span>{`migrations ${Number(betaSnapshot?.migrations?.migrations_total ?? 0)}`}</span>
              <span>{`graph edges ${Number(graphSnapshot?.edges?.length ?? 0)}`}</span>
              <span>{`external ${String(betaSnapshot?.guardrails?.external_execution ?? "disabled")}`}</span>
            </div>
          </div>
        </section>
      )}

      <section className="review-grid">
        {!busy && pendingCards.length === 0 && (
          <article className="review-card accent-teal">
            <div className="card-head">
              <div>
                <span className="eyebrow">Review Queue</span>
                <h3>No cards waiting</h3>
              </div>
              <CheckIcon size={22} />
            </div>
            <p className="body">Start a Bootstrap Review or switch back from Focus Mode when you want LifeOS to surface pending context.</p>
          </article>
        )}
        {pendingCards.map((card) => {
          return (
          <article className={`review-card accent-${card.visual.accent}`} key={card.card_id}>
            <div className="card-head">
              <div>
                <span className="eyebrow">{String(card.display.subtitle)}</span>
                <h3>{String(card.display.title)}</h3>
              </div>
              {card.privacy.privacy_level === "third_party_sensitive" ? <ShieldIcon size={22} /> : <CheckIcon size={22} />}
            </div>
            <p className="body">{String(card.display.body)}</p>
            <div className="badges">
              <span>{String(card.display.source_label)}</span>
              <span>{String(card.display.confidence_label)}</span>
              <span>{String(card.display.privacy_label)}</span>
              {card.queue && <span>{String((card.queue as Record<string, unknown>).visible_state)}</span>}
            </div>
            <ul className="reasons">
              {(card.trust.confidence_reasons as string[]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <div className="actions">
              {card.actions.map((action) => (
                <button
                  key={String(action.action_id)}
                  onClick={() => handleCardAction(card, action)}
                  title={String(action.result_preview ?? action.label)}
                >
                  {actionIcon(String(action.action_type))}
                  <span>{String(action.label)}</span>
                </button>
              ))}
            </div>
          </article>
          );
        })}
      </section>

      {sourceCard && (
        <aside className="source-drawer" aria-label="Source details">
          <div className="source-panel">
            <div className="drawer-head">
              <div>
                <span className="eyebrow">Source</span>
                <h2>{String(sourceCard.display.source_label)}</h2>
              </div>
              <button onClick={() => setSourceCard(null)} title="Close source drawer">
                Close
              </button>
            </div>
            <p>{String(sourceCard.display.body)}</p>
            <dl>
              <div>
                <dt>Privacy</dt>
                <dd>{String(sourceCard.display.privacy_label)}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{String(sourceCard.display.confidence_label)}</dd>
              </div>
              <div>
                <dt>Linked event</dt>
                <dd>{String((sourceCard.linked_objects.event_ids as string[] | undefined)?.[0] ?? "Unknown")}</dd>
              </div>
            </dl>
          </div>
        </aside>
      )}
    </main>
  );
}

function actionIcon(actionType: string) {
  if (actionType === "archive_candidate") {
    return <ArchiveIcon size={17} />;
  }
  if (actionType === "view_source") {
    return <EyeIcon size={17} />;
  }
  return <CheckIcon size={17} />;
}
