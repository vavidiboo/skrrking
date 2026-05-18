import React, { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ErrorInfo, PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import shellHtml from "./shell.html";
import { getReactUiSnapshot, subscribeReactUi } from "./legacyBridge";
import { CardEffectLayer } from "./cardEffects/CardEffectLayer";
import { installCardEffectBridge } from "./cardEffects/effectBus";
import type { ConnectionState, CurrentView, LobbyPlayerState, ReactUiState, SessionPlayerSnapshot, SessionSnapshotResponse } from "./types";

interface ShellErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ShellFragments {
  splashHtml: string;
  toastHtml: string;
  homeInnerHtml: string;
  homeClassName: string;
  lobbyInnerHtml: string;
  lobbyClassName: string;
  gameInnerHtml: string;
  gameClassName: string;
  dialogsHtml: string;
}

interface HtmlFragmentProps {
  html: string;
  marker: string;
}

interface SyncSplashElementOptions {
  visible: boolean;
  mode: string;
  currentView: CurrentView;
}

interface ShellPanelProps {
  id: string;
  visible: boolean;
  className: string;
  html: string;
}

interface LobbySeatLayout {
  rx: number;
  ry: number;
  selfY: number;
  scale: number;
}

interface LobbySeatPlayer extends SessionPlayerSnapshot {
  id?: string;
  name?: string;
  hostId?: string;
  connection_state?: ConnectionState | string;
  state?: LobbyPlayerState | string;
  avatar_url?: string | null;
  afk?: boolean;
}

interface LobbySeatModel {
  player: LobbySeatPlayer | null;
  layout: LobbySeatLayout;
  xPct: number;
  yPct: number;
  isSelf: boolean;
}

interface LobbySeatProps extends LobbySeatModel {}

interface LobbyPortalsProps {
  gameState: SessionSnapshotResponse | null;
  viewerId: string;
  active: boolean;
}

class ShellErrorBoundary extends Component<PropsWithChildren, ShellErrorBoundaryState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ShellErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[SkullKing][ReactShell] Uncaught error in React shell:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div id="react-shell-error" style={{ padding: "20px", color: "#fff", background: "#1a1a2e", minHeight: "100vh", fontFamily: "monospace" }}>
          <h2 style={{ color: "#e74c3c" }}>UI 오류가 발생했습니다</h2>
          <p>게임 로직은 정상 작동 중입니다. 페이지를 새로고침하면 복구됩니다.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: "8px 16px", cursor: "pointer", marginTop: "8px" }}
          >
            새로고침
          </button>
          <details style={{ marginTop: "12px", fontSize: "12px", color: "#aaa" }}>
            <summary>오류 상세</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {String(this.state.error?.message || this.state.error || "Unknown error")}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

let cachedShellFragments: ShellFragments | null = null;

function shellWithoutHidden(className = "") {
  return String(className)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== "hidden")
    .join(" ");
}

function getShellFragments(): ShellFragments {
  if (cachedShellFragments) {
    return cachedShellFragments;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${shellHtml}</body>`, "text/html");
  const read = (selector: string): Element => {
    const node = doc.querySelector(selector);
    if (!node) {
      throw new Error(`Missing shell fragment: ${selector}`);
    }
    return node;
  };

  cachedShellFragments = {
    splashHtml: read("#splash").outerHTML,
    toastHtml: read("#toast").outerHTML,
    homeInnerHtml: read("#homePanel").innerHTML,
    homeClassName: shellWithoutHidden(read("#homePanel").className),
    lobbyInnerHtml: read("#lobbyPanel").innerHTML,
    lobbyClassName: shellWithoutHidden(read("#lobbyPanel").className),
    gameInnerHtml: read("#gamePanel").innerHTML,
    gameClassName: shellWithoutHidden(read("#gamePanel").className),
    dialogsHtml: Array.from(doc.querySelectorAll("dialog"))
      .map((node) => node.outerHTML)
      .join("\n"),
  };
  return cachedShellFragments;
}

function normalizeLobbyPlayerState(state: unknown): LobbyPlayerState {
  const safe = String(state || "").trim().toLowerCase();
  if (["not_ready", "ready", "bid", "playing", "finished"].includes(safe)) {
    return safe as LobbyPlayerState;
  }
  return "not_ready";
}

function connectionStateLabel(state: unknown): string {
  const safe = String(state || "").trim().toLowerCase();
  if (safe === "reconnecting") {
    return "Reconnecting";
  }
  if (safe === "disconnected") {
    return "Disconnected";
  }
  return "Connected";
}

function playerInitial(name: unknown): string {
  const safe = String(name || "?").trim();
  return safe ? safe.charAt(0).toUpperCase() : "?";
}

function avatarColor(seed: unknown): string {
  const text = String(seed || "?");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(180deg, hsl(${hue} 70% 66%), hsl(${(hue + 36) % 360} 55% 42%))`;
}

function useReactUiState(): ReactUiState {
  return useSyncExternalStore(subscribeReactUi, getReactUiSnapshot, getReactUiSnapshot);
}

function useDomTarget(selector: string): Element | null {
  const [target, setTarget] = useState<Element | null>(() => document.querySelector(selector));

  useEffect(() => {
    // 즉각 시도
    const el = document.querySelector(selector);
    if (el) {
      setTarget(el);
      return;
    }

    // 요소가 아직 없으면 MutationObserver로 DOM 변경 감지
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        setTarget(found);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selector]);

  return target;
}

function useTextTarget(selector: string, value: string, active = true): void {
  const target = useDomTarget(selector);

  useLayoutEffect(() => {
    if (!target) {
      return;
    }
    if (!active) {
      target.textContent = "";
      return;
    }
    target.textContent = value;
  }, [active, target, value]);
}

function HtmlFragment({ html, marker }: HtmlFragmentProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (node.dataset.fragmentInitialized === "true" && node.dataset.fragmentHtml === html) {
      return;
    }
    node.innerHTML = html;
    node.dataset.fragmentInitialized = "true";
    node.dataset.fragmentHtml = html;
  }, [html]);

  return <div ref={ref} data-shell-fragment={marker} />;
}

function syncSplashElement({ visible, mode, currentView }: SyncSplashElementOptions): void {
  const splash = document.getElementById("splash");
  if (!splash) {
    return;
  }
  const splashMode = mode === "action" ? "action" : "boot";
  const shouldHide = !visible || (currentView !== "home" && splashMode !== "action");
  if (shouldHide) {
    splash.dataset.splashMode = visible ? splashMode : "hidden";
    splash.classList.add("hidden");
    splash.style.display = "none";
    splash.style.opacity = "0";
    splash.style.visibility = "hidden";
    splash.style.pointerEvents = "none";
    return;
  }
  splash.dataset.splashMode = splashMode;
  splash.classList.remove("hidden");
  splash.style.display = "grid";
  splash.style.opacity = "";
  splash.style.visibility = "";
  splash.style.pointerEvents = "";
}

function ShellPanel({ id, visible, className, html }: ShellPanelProps) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    if (node.dataset.panelInitialized === "true" && node.dataset.panelHtml === html) {
      return;
    }
    node.innerHTML = html;
    node.dataset.panelInitialized = "true";
    node.dataset.panelHtml = html;
  }, [html]);

  return (
    <section
      ref={ref}
      id={id}
      className={visible ? className : `${className} hidden`}
      style={{ display: visible ? "" : "none" }}
    />
  );
}

function LobbySeat({ player, layout, xPct, yPct, isSelf }: LobbySeatProps) {
  const style = {
    left: `calc(50% + ${xPct}%)`,
    top: `calc(50% + ${yPct}%)`,
    transform: `translate(-50%, -50%) scale(calc(${layout.scale} * var(--lobby-seat-scale, 1)))`,
  };

  if (!player) {
    return (
      <div className="seat" style={style}>
        <div className="ava"></div>
        <div className="meta">
          <div className="n">Open Slot</div>
          <div className="s">다음 참가자 대기 중</div>
        </div>
        <div className="ready bot">Invite</div>
      </div>
    );
  }

  const isHost = Boolean(player.id) && String(player.id) === String(player.hostId || "");
  const isBot = String(player.id || "").startsWith("bot-") || /bot/i.test(String(player.name || ""));
  const normalizedState = normalizeLobbyPlayerState(player.state);
  const connState = connectionStateLabel(player.connection_state);
  const stateLabel =
    normalizedState === "ready"
      ? "Ready"
      : normalizedState === "bid"
        ? "Bid"
        : normalizedState === "playing"
          ? "Playing"
          : normalizedState === "finished"
            ? "Finished"
            : "not ready";
  const statusParts = isHost ? ["Host", "방 설정 가능"] : ["상태", stateLabel];
  statusParts.push(connState);
  if (player.afk) {
    statusParts.push("AFK");
  }

  const badgeText = isHost ? "Host" : isBot ? "BOT" : stateLabel;
  const badgeClass = isBot
    ? "ready bot"
    : normalizedState === "ready"
      ? "ready is-ready"
      : normalizedState === "bid"
        ? "ready is-bid"
        : normalizedState === "playing"
          ? "ready is-playing"
          : normalizedState === "finished"
            ? "ready is-finished"
            : "ready not-ready";

  return (
    <div className={isSelf ? "seat seat-self me" : "seat"} style={style}>
      <div
        className={`ava${player.avatar_url ? " has-discord-avatar" : ""}`}
        style={player.avatar_url ? undefined : { background: avatarColor(player.id || player.name || "?") }}
      >
        {player.avatar_url ? (
          <img src={player.avatar_url} alt={player.name || "Player"} loading="lazy" />
        ) : (
          playerInitial(player.name)
        )}
      </div>
      <div className="meta">
        <div className="n">{player.name || "Player"}</div>
        <div className="s">{statusParts.join(" · ")}</div>
      </div>
      <div className={badgeClass}>{badgeText}</div>
    </div>
  );
}

function buildLobbySeatModel(gameState: SessionSnapshotResponse | null | undefined, viewerId: string): LobbySeatModel[] {
  const players = (Array.isArray(gameState?.players) ? gameState.players : []) as LobbySeatPlayer[];
  const maxPlayers = Math.max(2, Math.min(8, Number(gameState?.settings?.max_players || gameState?.settings?.maxPlayers || 6)));
  const mePlayer =
    players.find((player) => String(player?.id || "") === String(viewerId || "")) ||
    (players.length === 1 ? players[0] : null);
  const others = players.filter((player) => String(player?.id || "") !== String(viewerId || ""));
  const slots: Array<LobbySeatPlayer | null> = mePlayer ? [mePlayer, ...others] : [...players];
  const hasOpenSlot = slots.length < maxPlayers;
  if (hasOpenSlot) {
    slots.push(null);
  }
  const visibleSeatCount = Math.max(2, Math.min(maxPlayers, slots.length));
  const layoutByCount: Record<number, LobbySeatLayout> = {
    2: { rx: 34, ry: 26, selfY: 28, scale: 0.98 },
    3: { rx: 38, ry: 27, selfY: 29, scale: 0.96 },
    4: { rx: 41, ry: 28, selfY: 30, scale: 0.94 },
    5: { rx: 43, ry: 29, selfY: 31, scale: 0.92 },
    6: { rx: 44, ry: 30, selfY: 32, scale: 0.9 },
    7: { rx: 45, ry: 31, selfY: 33, scale: 0.88 },
    8: { rx: 46, ry: 32, selfY: 34, scale: 0.86 },
  };
  const layout = layoutByCount[visibleSeatCount] || layoutByCount[6];

  const positionForIndex = (index: number): { xPct: number; yPct: number } => {
    if (!mePlayer) {
      const angle = (-Math.PI / 2) + ((Math.PI * 2) / visibleSeatCount) * index;
      return {
        xPct: Math.cos(angle) * layout.rx,
        yPct: Math.sin(angle) * layout.ry,
      };
    }

    if (index === 0) {
      return { xPct: 0, yPct: layout.selfY ?? layout.ry };
    }
    if (visibleSeatCount === 2) {
      return { xPct: 0, yPct: -layout.ry };
    }
    if (visibleSeatCount === 3 && others.length === 1 && hasOpenSlot) {
      return index === 1
        ? { xPct: 0, yPct: -layout.ry }
        : { xPct: layout.rx, yPct: -4 };
    }

    const restCount = visibleSeatCount - 1;
    const restIndex = index - 1;
    const span = restCount <= 1 ? 0 : Math.min(Math.PI * 0.9, Math.PI * (0.22 * restCount + 0.18));
    const startAngle = (-Math.PI / 2) - span / 2;
    const angle = restCount <= 1 ? -Math.PI / 2 : startAngle + (span * restIndex) / (restCount - 1);
    return {
      xPct: Math.cos(angle) * layout.rx,
      yPct: Math.sin(angle) * layout.ry,
    };
  };

  return Array.from({ length: visibleSeatCount }, (_, index) => {
    const player = slots[index]
      ? {
          ...slots[index],
          hostId: gameState?.host_id || "",
        }
      : null;
    return {
      player,
      layout,
      ...positionForIndex(index),
      isSelf: Boolean(player) && String(player?.id || "") === String(viewerId || ""),
    };
  });
}

function LobbyPortals({ gameState, viewerId, active }: LobbyPortalsProps) {
  const playerListTarget = useDomTarget("#playerList");
  const maxPlayers = Number(gameState?.settings?.max_players || gameState?.settings?.maxPlayers || 6);

  useTextTarget(
    "#lobbyRoomCode",
    `Room Code · ${String(gameState?.session_id || "-").toUpperCase()}`,
    active && Boolean(gameState),
  );
  useTextTarget(
    "#lobbyPlayersChip",
    `${(gameState?.players || []).length}/${maxPlayers} Players`,
    active && Boolean(gameState),
  );
  useTextTarget(
    "#lobbyRoomCode",
    `Room Code - ${String(gameState?.session_id || "-").toUpperCase()}`,
    active && Boolean(gameState),
  );

  if (!active || !gameState) {
    return null;
  }

  const seats = buildLobbySeatModel(gameState, viewerId);
  const roomCodeTarget = null;

  return (
    <>
      {roomCodeTarget ? createPortal(`Room Code · ${String(gameState.session_id || "-").toUpperCase()}`, roomCodeTarget) : null}
      {playerListTarget ? createPortal(
        <>
          {seats.map((seat, index) => (
            <LobbySeat
              key={seat.player ? String(seat.player.id || index) : `open-${index}`}
              player={seat.player}
              layout={seat.layout}
              xPct={seat.xPct}
              yPct={seat.yPct}
              isSelf={seat.isSelf}
            />
          ))}
        </>,
        playerListTarget,
      ) : null}
    </>
  );
}

function AppShell() {
  const { currentView, gameState, viewerId, splashVisible, splashMode } = useReactUiState();
  const fragments = useMemo(() => getShellFragments(), []);

  useEffect(() => {
    installCardEffectBridge();
  }, []);

  useEffect(() => {
    const showHome = currentView === "home";
    document.body.classList.toggle("mode-home", showHome);
    document.body.classList.toggle("mode-session", !showHome);
  }, [currentView]);

  useEffect(() => {
    syncSplashElement({
      visible: splashVisible,
      mode: splashMode,
      currentView,
    });
  }, [currentView, splashMode, splashVisible]);

  return (
    <div id="react-shell">
      <HtmlFragment marker="splash" html={fragments.splashHtml} />
      <HtmlFragment marker="toast" html={fragments.toastHtml} />
      <main className="layout">
        <ShellPanel
          id="homePanel"
          visible={currentView === "home"}
          className={fragments.homeClassName}
          html={fragments.homeInnerHtml}
        />
        <ShellPanel
          id="lobbyPanel"
          visible={currentView === "lobby"}
          className={fragments.lobbyClassName}
          html={fragments.lobbyInnerHtml}
        />
        <ShellPanel
          id="gamePanel"
          visible={currentView === "game"}
          className={fragments.gameClassName}
          html={fragments.gameInnerHtml}
        />
      </main>
      <LobbyPortals gameState={gameState} viewerId={viewerId} active={currentView === "lobby"} />
      <HtmlFragment marker="dialogs" html={fragments.dialogsHtml} />
      <CardEffectLayer boardSelector="#gamePanel .table-wrap" />
    </div>
  );
}

export function App() {
  return (
    <ShellErrorBoundary>
      <AppShell />
    </ShellErrorBoundary>
  );
}
