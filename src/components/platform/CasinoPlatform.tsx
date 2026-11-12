"use client";

import { useEffect, useState } from "react";
import { useCasinoSocket } from "@/lib/use-casino-socket";
import { getStoredPseudo, storePseudo } from "@/lib/device-token";
import type { RoomSummary } from "@/lib/types";

type View = "lobby" | "table" | "account";
const number = (value: number) => value.toLocaleString("fr-FR");
const labels = { lobby: "Le casino", table: "Ma table", account: "Mon compte" };
function Clock({ ms }: { ms: number }) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return <span className="countdown">{[Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, "0")).join(":")}</span>;
}
function Icon({ name }: { name: "rooms" | "table" | "account" | "clock" | "arrow" | "check" }) {
  const paths = {
    rooms: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    table: <><ellipse cx="12" cy="9" rx="9" ry="5"/><path d="M3 9v5c0 7 18 7 18 0V9M7 19v3m10-3v3"/></>,
    account: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    check: <><path d="M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6z"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function TableArt({ theme = "emerald" }: { theme?: string }) {
  return <div className={`room-art ${theme}`} aria-hidden="true"><div className="art-light"/><div className="art-felt"><span>LA TABLE 21</span><small>BLACKJACK PAYS 3 TO 2</small><i/><i/><i/><i/><i/></div><div className="art-card first">A<span>♠</span></div><div className="art-card second">K<span>♥</span></div><div className="art-chip red"/><div className="art-chip blue"/></div>;
}
export function CasinoPlatform({ initialView = "lobby" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [now, setNow] = useState(0);
  const [filterFree, setFilterFree] = useState(false);
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const { player, table, rooms, currentRoomId, connected, deviceRemembered, joinRoom, errorMessage, clearError } = useCasinoSocket(pseudo);
  useEffect(() => {
    try { const saved = getStoredPseudo(); if (saved) { setPseudo(saved); setNickname(saved); } } catch {}
    const tick = () => setNow(Date.now()); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (pendingRoom && currentRoomId === pendingRoom && connected) { setView("table"); setPendingRoom(null); }
  }, [pendingRoom, currentRoomId, connected]);
  useEffect(() => { if (errorMessage || !connected) setPendingRoom(null); }, [errorMessage, connected]);
  const currentRoom = rooms.find(r => r.id === currentRoomId);
  const mySeats = table?.seats.filter(s => s.playerId === player?.id) ?? [];
  const playing = mySeats.some(s => s.hands.length > 0) && table?.phase !== "idle" && table?.phase !== "betting";
  const visibleRooms = rooms.filter(r => !filterFree || r.occupiedSeats < r.capacity);
  function createAccount() {
    const value = nickname.trim();
    if (value.length < 2 || value.length > 16) { setLocalError("Choisissez un pseudo de 2 à 16 caractères."); return; }
    setLocalError(""); try { storePseudo(value); } catch {}
    setPseudo(value);
  }
  function enterRoom(room: RoomSummary) { clearError(); setLocalError(""); setPendingRoom(room.id); joinRoom(room.id); }
  const bonusMs = player ? player.nextBonusAt - now : 3600000;
  const roomPhase = (room: RoomSummary) => room.phase === "idle" || room.phase === "betting" ? "Mises ouvertes" : "Manche en cours";
  return <div className={`platform view-${view}`}>
    <aside className="casino-sidebar">
      <button className="brand" onClick={() => setView("lobby")} aria-label="La Table 21, accueil"><span className="brand-seal">21</span><span>LA TABLE<small>SALON PRIVÉ</small></span></button>
      <div className="nav-caption">VOTRE CASINO</div>
      <nav aria-label="Navigation principale">{(["lobby", "table", "account"] as View[]).map((item, index) => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}><Icon name={(["rooms", "table", "account"] as const)[index]}/><span>{labels[item]}</span>{item === "table" && mySeats.length > 0 && <i className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><span className={`live-indicator ${connected ? "online" : ""}`}/>{connected ? "Casino en ligne" : "Connexion au casino"}<small>BLACKJACK · JETONS VIRTUELS</small></div>
    </aside>
    <div className="platform-body">
      <header className="platform-header"><div className="breadcrumb">SALON PRIVÉ <span>/</span> <strong>{view === "table" ? currentRoom?.name ?? "Ma table" : labels[view]}</strong></div><div className="header-account"><div className="header-bank"><small>VOTRE RÉSERVE</small><strong><span className="coin-symbol">21</span>{player ? number(player.balance) : "—"}<span>jetons</span></strong></div><button className="avatar" onClick={() => setView("account")} aria-label="Ouvrir mon compte">{(player?.pseudo ?? nickname)[0]?.toUpperCase() ?? "21"}</button></div></header>
      {(errorMessage || localError) && <button className="platform-error" role="alert" onClick={() => { clearError(); setLocalError(""); }}>{errorMessage || localError}<span>×</span></button>}
      {playing && view !== "table" && <button className="ongoing-round" onClick={() => setView("table")}><span className="live-indicator online"/>Votre manche continue dans {currentRoom?.name}.<strong>Revenir à la table →</strong></button>}
      {view === "lobby" && <main className="lobby-content">
        <section className="lobby-hero"><div className="hero-copy"><div className="eyebrow"><span/>L’EXPÉRIENCE LA TABLE 21</div><h1>Votre place<br/><em>vous attend.</em></h1><p>Choisissez votre room, prenez place et retrouvez le plaisir d’une vraie table de blackjack.</p>{!player ? <form className="account-entry" onSubmit={e => { e.preventDefault(); createAccount(); }}><label htmlFor="pseudo">Votre pseudo</label><div><input id="pseudo" value={nickname} onChange={e => setNickname(e.target.value.slice(0, 16))} maxLength={16} minLength={2} placeholder="Comment vous appeler ?" autoComplete="nickname" disabled={Boolean(pseudo)}/><button className="gold-button" disabled={Boolean(pseudo)}>{pseudo ? "Connexion…" : "Entrer au casino"}<Icon name="arrow"/></button></div><small>Votre compte est mémorisé sur cet appareil, sans inscription par SMS.</small></form> : <><button className="gold-button" onClick={() => document.getElementById("rooms")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Choisir ma room<Icon name="arrow"/></button><div className="welcome-back"><Icon name="check"/>Bienvenue, {player.pseudo}. Votre réserve vous attend.</div></>}</div><div className="hero-scene"><TableArt/><div className="scene-caption"><span className="live-indicator online"/>BLACKJACK 3D<small>À hauteur de joueur.</small></div><div className="scene-mark">21</div></div></section>
        <div className="casino-facts"><span><b>3:2</b>Le blackjack récompensé</span><span><b>7</b>Places par table</span><span><b>+3 000</b>Jetons chaque heure</span></div>
        <section className="rooms-section" id="rooms"><div className="section-heading"><div><div className="eyebrow">À VOUS DE JOUER</div><h2>Les rooms du salon</h2></div><div className="room-filters"><button className={!filterFree ? "selected" : ""} onClick={() => setFilterFree(false)}>Toutes</button><button className={filterFree ? "selected" : ""} onClick={() => setFilterFree(true)}>Places disponibles</button></div></div><div className="room-grid">{visibleRooms.map((room, index) => <article className={`room-card theme-${room.theme}`} key={room.id}><div className="room-card-visual"><TableArt theme={room.theme}/><span className="room-index">0{index + 1}</span><span className="room-phase"><i className={`live-indicator ${room.phase === "idle" || room.phase === "betting" ? "online" : ""}`}/>{roomPhase(room)}</span></div><div className="room-card-info"><div className="room-title"><h3>{room.name}</h3><span>{room.minBet} — {room.maxBet}</span></div><p>{room.description}</p><div className="room-occupancy"><div className="place-dots" aria-label={`${room.occupiedSeats} places occupées sur ${room.capacity}`}>{Array.from({ length: room.capacity }, (_, i) => <i key={i} className={i < room.occupiedSeats ? "taken" : ""}/>)}</div><span><b>{room.capacity - room.occupiedSeats}</b> places libres</span></div><button className="room-enter" disabled={!player || !connected || Boolean(pendingRoom)} onClick={() => enterRoom(room)}>{pendingRoom === room.id ? "Ouverture…" : room.occupiedSeats === room.capacity ? "Observer la table" : "Rejoindre la room"}<Icon name="arrow"/></button></div></article>)}{rooms.length === 0 && <div className="rooms-loading">{pseudo ? "Connexion aux rooms…" : "Ouvrez votre compte pour découvrir les tables en direct."}</div>}{rooms.length > 0 && visibleRooms.length === 0 && <div className="rooms-loading">Les tables sont complètes pour le moment. Vous pouvez les observer avec le filtre « Toutes ».</div>}</div><div className="rooms-live"><span className={`live-indicator ${connected ? "online" : ""}`}/>{connected ? "Disponibilités actualisées en direct" : "En attente de connexion"}<span>·</span>Plusieurs cases possibles à une même table</div></section>
        <section className="hourly-card"><div className="hourly-icon"><Icon name="clock"/></div><div><div className="eyebrow">LE RENDEZ-VOUS DU SALON</div><h2>3 000 jetons, chaque heure.</h2><p>Votre réserve se recharge automatiquement, pendant vos parties et même en votre absence.</p></div><div className="hourly-count"><small>PROCHAIN CRÉDIT</small><Clock ms={bonusMs}/><span>+3 000 jetons</span></div></section>
      </main>}
      {view === "table" && <main className="game-content"><div className="game-topline"><button onClick={() => setView("lobby")}>← Toutes les rooms</button><span><span className={`live-indicator ${connected ? "online" : ""}`}/>{currentRoom?.occupiedSeats ?? 0}/{currentRoom?.capacity ?? 7} places occupées</span><div>Prochain bonus <Clock ms={bonusMs}/><b>+3 000</b></div></div><div className="game-frame">{player && connected ? <iframe key={currentRoomId} src={`/game/index.html?embedded=1&room=${encodeURIComponent(currentRoomId)}`} title={`La Table 21 — ${currentRoom?.name ?? "Blackjack 3D"}`} allow="autoplay; fullscreen; gamepad" allowFullScreen/> : <div className="game-placeholder"><span className="brand-seal">21</span><h2>Votre table vous attend</h2><p>Ouvrez votre compte depuis l’accueil pour prendre place.</p><button className="gold-button" onClick={() => setView("lobby")}>Ouvrir le casino<Icon name="arrow"/></button></div>}</div><div className="game-ruleline"><span>BLACKJACK 3:2</span><span>LE CROUPIER RESTE À 17</span><span>COMPTE MÉMORISÉ SUR CET APPAREIL</span></div></main>}
      {view === "account" && <main className="account-content"><div className="eyebrow">VOTRE ESPACE PERSONNEL</div><h1>Un compte.<br/><em>Votre rythme.</em></h1>{player ? <><section className="profile-card"><div className="profile-identity"><span className="avatar large">{player.pseudo[0]?.toUpperCase()}</span><div><h2>{player.pseudo}</h2><p><Icon name="check"/>{deviceRemembered ? "Compte mémorisé sur cet appareil" : "Compte ouvert pour cette session"}</p></div></div><div className="profile-balance"><small>RÉSERVE DISPONIBLE</small><strong>{number(player.balance)}<span>jetons</span></strong><button className="gold-button" onClick={() => setView("lobby")}>Retrouver les rooms<Icon name="arrow"/></button></div></section><div className="account-stats"><article><small>MAINS GAGNÉES</small><strong>{number(player.totalWins)}</strong></article><article><small>BLACKJACKS</small><strong>{number(player.totalBlackjacks)}</strong></article><article><small>MAINS PERDUES</small><strong>{number(player.totalLosses)}</strong></article></div><section className="hourly-card account-hourly"><div className="hourly-icon"><Icon name="clock"/></div><div><h2>Votre prochain rendez-vous</h2><p>+3 000 jetons par heure. Vos gains restent sur votre compte et les heures d’absence sont rattrapées à votre retour.</p></div><div className="hourly-count"><small>PROCHAIN CRÉDIT</small><Clock ms={bonusMs}/></div></section><div className="device-note"><Icon name="check"/><div><h3>Votre compte vous suit sur cet appareil</h3><p>Revenez avec le même navigateur pour retrouver votre réserve et vos statistiques. Conservez ses données de navigation pour garder l’accès à votre compte.</p></div></div></> : <section className="profile-card"><p>Votre compte se crée automatiquement quand vous entrez au casino.</p><button className="gold-button" onClick={() => setView("lobby")}>Créer mon compte sur cet appareil<Icon name="arrow"/></button></section>}</main>}
      <footer className="platform-footer"><span>LA TABLE 21 · SALON PRIVÉ</span><span>Un jeu de blackjack avec des jetons virtuels.</span></footer>
    </div>
  </div>;
}
