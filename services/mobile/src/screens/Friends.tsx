import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { api, ApiError } from "../api/client";
import type { FriendInvite } from "../api/types";
import { FadeUp } from "../components/Anim";
import { Act, Cta, Empty, Hint, Link, Nav, Outline, Rule, Screen, Spacer, Title } from "../components/Chrome";
import { ORIGIN } from "../config";
import { whenLabel } from "../lib/format";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C } from "../theme/tokens";

/** The link a friend follows. It carries the token and nothing else, and lands where people sign in. */
const inviteUrl = (token: string) => `${ORIGIN}/?invite=${encodeURIComponent(token)}`;

export const Friends = () => {
  const s = useStore();
  const { loadFriends } = s;
  useEffect(() => { void loadFriends(); }, [loadFriends]);

  return (
    <Screen>
      <Nav>
        <Title>FRIENDS</Title>
        <Spacer />
        <Link color={C.text50}>{s.friends ? `${s.friends.friends.length}` : ""}</Link>
      </Nav>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 22, paddingBottom: 8, gap: 10 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {s.invite && <InviteLanding token={s.invite} />}

        {!s.friends && !s.friendsError && <Empty center>Reading your friends…</Empty>}
        {s.friendsError && (
          <View style={{ alignItems: "center" }}>
            <Empty center>{s.friendsError}</Empty>
            <Act style={{ marginTop: 14 }} onPress={() => void s.loadFriends()}>TRY AGAIN →</Act>
          </View>
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
              <Empty style={{ paddingVertical: 14 }}>Nobody yet. Send someone a link and both your maps carry both sets of roasters.</Empty>
            )}
            {s.friends.friends.map((f) => (
              <Pressable key={f.userId} style={st.row} onPress={() => { s.setScope("both"); s.setScreen("roasters"); }}>
                <View style={st.avatar}><Text style={st.avatarText}>{f.initials}</Text></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={st.name}>{f.name}</Text>
                  <Text style={st.sub}>
                    {f.roasters} {f.roasters === 1 ? "roaster" : "roasters"} · {f.sharedBrews} {f.sharedBrews === 1 ? "recipe" : "recipes"} · since {whenLabel(f.since).toLowerCase()}
                  </Text>
                </View>
                <Text style={c(700, 10, 2, C.copperLight)}>MAP →</Text>
              </Pressable>
            ))}

            <Invite />

            {s.friends.sent.length > 0 && (
              <>
                <Rule label="SENT" right={`${s.friends.sent.length}`} />
                {s.friends.sent.map((i) => <Sent key={i.token} invite={i} />)}
              </>
            )}

            <Hint left style={{ paddingTop: 18, paddingBottom: 6 }}>
              A brew log is a private thing. There is no search and nobody is discoverable — the only way
              into someone's is to be handed the key, and both sides have to agree.
            </Hint>
          </>
        )}
      </ScrollView>
    </Screen>
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
    <FadeUp duration={350} style={st.card}>
      <Text style={c(700, 10, 3, C.copperLight)}>AN INVITATION</Text>
      {state.kind === "loading" && <Text style={st.cardSub}>Reading the invitation…</Text>}
      {state.kind === "error" && (
        <>
          <Text style={st.who}>Not this one</Text>
          <Text style={st.cardSub}>{state.msg}</Text>
          <Outline style={{ marginTop: 14 }} onPress={s.clearInvite}>DISMISS</Outline>
        </>
      )}
      {state.kind === "ready" && (
        <>
          <Text style={st.who}>{state.invite.fromName}</Text>
          <Text style={st.cardSub}>wants to swap roasters and recipes. Accept and both maps carry both sets — nothing of yours is visible until you do.</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 16 }}>
            <Cta label={busy ? "ACCEPTING…" : "ACCEPT"} disabled={busy} onPress={() => void accept()} style={{ flex: 1, height: 52, width: undefined }} />
            <Link onPress={s.clearInvite}>NOT NOW</Link>
          </View>
        </>
      )}
    </FadeUp>
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
    <View style={st.row}>
      <View style={[st.avatar, st.avatarDashed]}><Text style={[st.avatarText, { color: C.text50 }]}>?</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.name}>{invite.fromName}</Text>
        <Text style={st.sub}>invited you {whenLabel(invite.createdAt).toLowerCase()}</Text>
      </View>
      <Act onPress={() => void accept()}>ACCEPT →</Act>
    </View>
  );
};

const copyLink = async (url: string, done: string, fallback: string) => {
  try { await Clipboard.setStringAsync(url); return done; } catch { return fallback; }
};

const Sent = ({ invite }: { invite: FriendInvite }) => {
  const s = useStore();
  const copy = async () => {
    const url = inviteUrl(invite.token);
    s.showToast(await copyLink(url, "Link copied — send it however you like", url));
  };
  const revoke = async () => {
    try { await api.revokeInvite(invite.token); await s.loadFriends(); s.showToast("Invitation withdrawn"); }
    catch { s.showToast("Could not withdraw it"); }
  };
  return (
    <View style={st.row}>
      <View style={[st.avatar, st.avatarDashed]}><Text style={[st.avatarText, { color: C.text50 }]}>✦</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.name} numberOfLines={1}>{invite.toEmail ?? "Anyone with the link"}</Text>
        <Text style={st.sub}>sent {whenLabel(invite.createdAt).toLowerCase()} · not accepted yet</Text>
      </View>
      <Act onPress={() => void copy()}>COPY</Act>
      <Act quiet onPress={() => void revoke()} label="Withdraw invitation">✕</Act>
    </View>
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
      const url = inviteUrl(invite.token);
      if (posted) {
        s.showToast(`Invitation sent to ${invite.toEmail}`);
      } else if (addressed) {
        // No mail went out, so hand the user the link rather than let them think one did.
        s.showToast(await copyLink(url, `Link copied — ${invite.toEmail} also sees it when they open Brewbook`, `${invite.toEmail} will see the invitation when they open Brewbook`));
      } else {
        s.showToast(await copyLink(url, "Link copied — send it however you like", url));
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
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TextInput value={email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="their email — optional" placeholderTextColor={C.text45}
          onChangeText={setEmail} onSubmitEditing={() => { if (email.trim()) void send(true); }} style={st.input} />
        <Act disabled={busy || !email.trim()} onPress={() => void send(true)} style={{ height: 46 }}>INVITE →</Act>
      </View>
      <Hint left style={{ paddingTop: 8 }}>
        {s.me?.features?.emailInvites
          ? "They get an email with the link, and see the invitation next time they open Brewbook."
          : "Email is not set up on this deployment — an addressed invitation waits for them in Brewbook, and you get the link to send yourself."}
      </Hint>
      <Outline disabled={busy} onPress={() => void send(false)}>OR COPY A LINK</Outline>
    </>
  );
};

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.copper15, minHeight: 44 },
  name: g(600, 14),
  sub: { ...g(400, 11, 0, C.text50), marginTop: 2 },
  avatar: { width: 38, height: 38, borderWidth: 1, borderColor: C.copper55, alignItems: "center", justifyContent: "center", backgroundColor: C.copper10 },
  avatarDashed: { borderStyle: "dashed" },
  avatarText: c(700, 12, 1, C.copperLight),
  card: { borderWidth: 1, borderColor: C.copper55, backgroundColor: C.copper08, padding: 18 },
  who: { ...g(700, 22, 1), marginTop: 8 },
  cardSub: { ...g(400, 13, 0, C.text75), lineHeight: 19.5, marginTop: 8 },
  input: { ...g(400, 13), flex: 1, minWidth: 0, height: 46, backgroundColor: C.panel, borderWidth: 1, borderColor: C.copper30, paddingHorizontal: 12, paddingVertical: 0 },
});
