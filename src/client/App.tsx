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

  const pendingCards = cardsResponse?.cards ?? [];
  const presence = focus?.state === "focus" ? "focus" : cardsResponse?.cards_remaining ? "review_ready" : busy ? "processing" : "idle";

  useEffect(() => {
    refreshFocus();
  }, []);

  useEffect(() => {
    if (bootstrapId) {
      refreshCards(bootstrapId);
      refreshMemory();
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

      <section className="review-grid">
        {pendingCards.map((card) => {
          const primaryAction = findAction(card, "primary");
          const archiveAction = findAction(card, "secondary");
          const sourceAction = findAction(card, "ghost");
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
            </div>
            <ul className="reasons">
              {(card.trust.confidence_reasons as string[]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <div className="actions">
              {primaryAction && (
              <button onClick={() => act(card, String(primaryAction.action_type))} title={String(primaryAction.result_preview ?? primaryAction.label)}>
                <CheckIcon size={17} />
                <span>{String(primaryAction.label)}</span>
              </button>
              )}
              {archiveAction && (
              <button onClick={() => act(card, String(archiveAction.action_type))} title={String(archiveAction.result_preview ?? archiveAction.label)}>
                <ArchiveIcon size={17} />
                <span>{String(archiveAction.label)}</span>
              </button>
              )}
              {sourceAction && (
              <button onClick={() => setMessage(`Source: ${String(card.display.source_label)}`)} title={String(sourceAction.label)}>
                <EyeIcon size={17} />
              </button>
              )}
            </div>
          </article>
          );
        })}
      </section>
    </main>
  );
}

function findAction(card: BootstrapReviewCard, style: string) {
  return card.actions.find((action) => action.style === style);
}
