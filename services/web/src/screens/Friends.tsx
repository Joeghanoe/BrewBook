import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { FriendInvite } from "../api/types";
import { Rule } from "../components/Chrome";
import { whenLabel } from "../lib/format";
import { useStore } from "../state/store";

/** The link a friend follows. It carries the token and nothing else. */
const inviteUrl = (token: string) => `${window.location.origin}/?invite=${encodeURIComponent(token)}`;

export const Friends = () => {
  const s = useStore();
  const { loadFriends } = s;
  useEffect(() => { void loadFriends(); }, [loadFriends]);

  return (
    <div className="screen">
      <div className="nav">
        <div className="title">FRIENDS</div>
        <div style={{ flex: 1 }} />
        <span className="link" style={{ color: "var(--text-50)" }}>{s.friends ? `${s.friends.friends.length}` : ""}</span>
      </div>

      <div className="friends-body">
        {s.invite && <InviteLanding token={s.invite} />}

        {!s.friends && !s.friendsError && <div className="empty" style={{ textAlign: "center" }}>Reading your friends…</div>}
        {s.friendsError && (
          <div className="empty" style={{ textAlign: "center" }}>
            <div>{s.friendsError}</div>
            <button className="act" style={{ marginTop: 14 }} onClick={() => void s.loadFriends()}>TRY AGAIN →</button>
          </div>
        )}

        {s.friends && (
          <>
            {s.friends.received.length > 0 && (
              <>
                <Rule label="WAITING ON YOU" right={`${s.friends.received.length}`} />
                {s.friends.received.map((i) => <Received key={i.token} invite={i} />)}
              </>
            )}

            <Rule label="YOUR FRIENDS" right={`${s.friends.friends.length}`} />
            {s.friends.friends.length === 0 && (
              <div className="empty" style={{ padding: "14px 0" }}>
                Nobody yet. Send someone a link and both your maps carry both sets of roasters.
              </div>
            )}
            {s.friends.friends.map((f) => (
              <button key={f.userId} className="friend-row" onClick={() => { s.setScope("both"); s.setScreen("roasters"); }}>
                <div className="avatar">{f.initials}</div>
                <div className="body">
                  <div className="name">{f.name}</div>
                  <div className="sub">
                    {f.roasters} {f.roasters === 1 ? "roaster" : "roasters"} · {f.sharedBrews} {f.sharedBrews === 1 ? "recipe" : "recipes"} · since {whenLabel(f.since).toLowerCase()}
                  </div>
                </div>
                <span className="go">MAP →</span>
              </button>
            ))}

            <Invite />

            {s.friends.sent.length > 0 && (
              <>
                <Rule label="SENT" right={`${s.friends.sent.length}`} />
                {s.friends.sent.map((i) => <Sent key={i.token} invite={i} />)}
              </>
            )}

            <div className="hint" style={{ textAlign: "left", padding: "18px 0 6px" }}>
              A brew log is a private thing. There is no search and nobody is discoverable — the only way
              into someone's is to be handed the key, and both sides have to agree.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/** The invitation the user arrived on. Reading it is all they can do until they accept. */
const InviteLanding = ({ token }: { token: string }) => {
  const s = useStore();
  const [state, setState] = useState<{ kind: "loading" } | { kind: "error"; msg: string } | { kind: "ready"; invite: FriendInvite }>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setState({ kind: "ready", invite: await api.readInvite(token) }); }
    catch (e) { setState({ kind: "error", msg: e instanceof ApiError ? e.message : "This invitation could not be read." }); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);

  const accept = async () => {
    setBusy(true);
    try {
      const friend = await api.acceptInvite(token);
      s.clearInvite();
      await s.loadFriends();
      s.setScope("both");
      s.showToast(`You and ${friend.name} are friends — their roasters are on your map`);
    } catch (e) {
      setBusy(false);
      s.showToast(e instanceof ApiError ? e.message : "The invitation could not be accepted");
    }
  };

  return (
    <div className="invite-card">
      <div className="kicker">AN INVITATION</div>
      {state.kind === "loading" && <div className="sub">Reading the invitation…</div>}
      {state.kind === "error" && (
        <>
          <div className="who">Not this one</div>
          <div className="sub">{state.msg}</div>
          <button className="outline" style={{ marginTop: 14 }} onClick={s.clearInvite}>DISMISS</button>
        </>
      )}
      {state.kind === "ready" && (
        <>
          <div className="who">{state.invite.fromName}</div>
          <div className="sub">
            wants to swap roasters and recipes. Accept and both maps carry both sets — nothing of yours is
            visible until you do.
          </div>
          <div className="acts">
            <button className="cta" disabled={busy} onClick={() => void accept()}><span>{busy ? "ACCEPTING…" : "ACCEPT"}</span></button>
            <button className="link" onClick={s.clearInvite}>NOT NOW</button>
          </div>
        </>
      )}
    </div>
  );
};

const Received = ({ invite }: { invite: FriendInvite }) => {
  const s = useStore();
  const accept = async () => {
    try {
      const friend = await api.acceptInvite(invite.token);
      await s.loadFriends();
      s.showToast(`You and ${friend.name} are friends`);
    } catch (e) {
      s.showToast(e instanceof ApiError ? e.message : "The invitation could not be accepted");
    }
  };
  return (
    <div className="friend-row">
      <div className="avatar dashed">?</div>
      <div className="body">
        <div className="name">{invite.fromName}</div>
        <div className="sub">invited you {whenLabel(invite.createdAt).toLowerCase()}</div>
      </div>
      <button className="act" onClick={() => void accept()}>ACCEPT →</button>
    </div>
  );
};

const Sent = ({ invite }: { invite: FriendInvite }) => {
  const s = useStore();
  const copy = async () => {
    const url = inviteUrl(invite.token);
    try { await navigator.clipboard.writeText(url); s.showToast("Link copied — send it however you like"); }
    catch { s.showToast(url); }
  };
  const revoke = async () => {
    try { await api.revokeInvite(invite.token); await s.loadFriends(); s.showToast("Invitation withdrawn"); }
    catch { s.showToast("Could not withdraw it"); }
  };
  return (
    <div className="friend-row">
      <div className="avatar dashed">✦</div>
      <div className="body">
        <div className="name">{invite.toEmail ?? "Anyone with the link"}</div>
        <div className="sub">sent {whenLabel(invite.createdAt).toLowerCase()} · not accepted yet</div>
      </div>
      <button className="act" onClick={() => void copy()}>COPY</button>
      <button className="act quiet" onClick={() => void revoke()} aria-label="Withdraw invitation">✕</button>
    </div>
  );
};

/** You send someone a link, or invite them by email. Nothing else (§5). */
const Invite = () => {
  const s = useStore();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (addressed: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const { invite, posted } = await api.createInvite(addressed ? email.trim() : null);
      setEmail("");
      await s.loadFriends();
      if (posted) {
        s.showToast(`Invitation sent to ${invite.toEmail}`);
      } else if (addressed) {
        // No mail went out, so hand the user the link rather than let them think one did.
        const url = inviteUrl(invite.token);
        try { await navigator.clipboard.writeText(url); s.showToast(`Link copied — ${invite.toEmail} also sees it when they open Brewbook`); }
        catch { s.showToast(`${invite.toEmail} will see the invitation when they open Brewbook`); }
      } else {
        const url = inviteUrl(invite.token);
        try { await navigator.clipboard.writeText(url); s.showToast("Link copied — send it however you like"); }
        catch { s.showToast(url); }
      }
    } catch (e) {
      s.showToast(e instanceof ApiError ? e.message : "The invitation could not be created");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Rule label="ADD A FRIEND" />
      <div className="invite-form">
        <input
          value={email}
          type="email"
          inputMode="email"
          placeholder="their email — optional"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) void send(true); }}
        />
        <button className="act" disabled={busy || !email.trim()} onClick={() => void send(true)}>INVITE →</button>
      </div>
      <div className="hint" style={{ textAlign: "left", paddingTop: 8 }}>
        {s.me?.features?.emailInvites
          ? "They get an email with the link, and see the invitation next time they open Brewbook."
          : "Email is not set up on this deployment — an addressed invitation waits for them in Brewbook, and you get the link to send yourself."}
      </div>
      <button className="outline" style={{ width: "100%", marginTop: 10 }} disabled={busy} onClick={() => void send(false)}>
        OR COPY A LINK
      </button>
    </>
  );
};
