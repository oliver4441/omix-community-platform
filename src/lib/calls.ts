import { getChatClient } from "@/lib/ably";
import { getSessionId, Store } from "@/lib/store";
import { api } from "@/lib/api";
import type { RealtimeChannel } from "ably";
import type { CallSession, CallEndReason } from "@/lib/types";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/** How long an unanswered call rings before being given up on. */
const RING_TIMEOUT_MS = 30000;
/** How long the "connecting" phase may last before the call is abandoned. */
const CONNECT_TIMEOUT_MS = 15000;
/** How long the "Missed call" / "No answer" screen stays visible. */
const AUTO_CLEAR_MS = 2600;

interface SignalMessage {
  type: "invite" | "accept" | "decline" | "cancel" | "end" | "sdp" | "ice";
  from?: string;
  /** Caller display name (populated on invites so the callee can show/log it). */
  fromName?: string;
  to?: string;
  video?: boolean;
  /** Channel the call is anchored to (caller's channel); used for SDP/ICE routing. */
  roomId?: string;
  /** Stable id shared by both parties, used for call-log dedupe. */
  callUid?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

type CallListener = (session: CallSession | null) => void;

let current: CallSession | null = null;
let nextCallId = 1;
let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let localVideoEl: HTMLVideoElement | null = null;
let remoteVideoEl: HTMLVideoElement | null = null;
let signalChannel: RealtimeChannel | null = null;
let subscribedSignalChannelId: string | null = null;
let activeChannelId: string | null = null;
let muted = false;
let camOff = false;
const listeners = new Set<CallListener>();

// Per-user "ring" channel — receives invites no matter which channel is viewed.
let userChannel: RealtimeChannel | null = null;
let subscribedUserId: string | null = null;

// Call history logging state
let callLogId: string | null = null;
let callStartedAt = 0;

// Screen sharing state
let screenTrack: MediaStreamTrack | null = null;
let cameraTrack: MediaStreamTrack | null = null;
let screenSharing = false;
let renegotiationPending = false;
const screenShareListeners = new Set<(sharing: boolean) => void>();

function emitScreenShare() {
  screenShareListeners.forEach((l) => l(screenSharing));
}

// SDP/ICE received before the PeerConnection exists are buffered and flushed
// once it is created (fixes the accept race where the offer beats the callee's PC).
let pendingSdp: SignalMessage | null = null;
let pendingIce: SignalMessage[] = [];

let ringTimeout: ReturnType<typeof setTimeout> | null = null;
let connectTimeout: ReturnType<typeof setTimeout> | null = null;
let autoClearTimer: ReturnType<typeof setTimeout> | null = null;

// === Ringtone (WebAudio, no assets) ===
let audioCtx: AudioContext | null = null;
let ringOscs: OscillatorNode[] = [];
let ringGain: GainNode | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freqs: number[], onMs: number, offMs: number, level: number) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  const oscs = freqs.map((f) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    osc.connect(gain);
    osc.start();
    return osc;
  });
  ringOscs = oscs;
  ringGain = gain;
  const ring = (t: number) => {
    if (!ringGain) return;
    ringGain.gain.cancelScheduledValues(t);
    ringGain.gain.setValueAtTime(0, t);
    ringGain.gain.linearRampToValueAtTime(level, t + 0.04);
    ringGain.gain.setValueAtTime(level, t + onMs / 1000 - 0.05);
    ringGain.gain.linearRampToValueAtTime(0, t + onMs / 1000);
  };
  ring(ctx.currentTime + 0.05);
  ringInterval = setInterval(() => ring(ctx.currentTime + 0.05), onMs + offMs);
}

function stopRingtone() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
  if (ringOscs.length) {
    ringOscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    });
    ringOscs = [];
  }
  if (ringGain) {
    try {
      ringGain.disconnect();
    } catch {
      /* already disconnected */
    }
    ringGain = null;
  }
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* unsupported */
    }
  }
}

function emit() {
  // Keep the signal subscription following the call (not the viewed channel),
  // so navigation mid-call doesn't break signaling.
  syncSignalChannel();
  listeners.forEach((l) => l(current));
}

function publish(msg: SignalMessage) {
  // Route through the call's own channel; only fall back to the viewed channel
  // when no call is active.
  const channelId = current?.roomId || activeChannelId;
  if (!channelId) return;
  const channel = getChatClient().realtime.channels.get(`call-${channelId}`);
  channel.publish("call", msg).catch((err) => console.warn("[call] publish failed", err));
}

/** Publish directly to another user's personal ring channel. */
function publishToUser(userId: string | undefined, msg: SignalMessage) {
  if (!userId) return;
  const channel = getChatClient().realtime.channels.get(`call-user-${userId}`);
  channel.publish("call", msg).catch((err) => console.warn("[call] user publish failed", err));
}

/**
 * Subscribe to my own ring channel so I receive invites regardless of which
 * channel I'm viewing. Idempotent per session id (re-subscribes after login).
 */
function ensureUserChannel() {
  if (typeof window === "undefined") return;
  const myId = getSessionId();
  if (!myId || subscribedUserId === myId) return;
  if (userChannel) {
    userChannel.unsubscribe("call");
    userChannel = null;
  }
  subscribedUserId = myId;
  const channel = getChatClient().realtime.channels.get(`call-user-${myId}`);
  channel.subscribe("call", (msg) => handleSignal(msg.data as SignalMessage));
  channel.attach().catch(() => {});
  userChannel = channel;
}

/** Browser notification for incoming calls when the tab isn't in focus. */
function notifyIncomingCall(session: CallSession) {
  if (
    typeof document === "undefined" ||
    !document.hidden ||
    typeof Notification === "undefined" ||
    Notification.permission !== "granted"
  ) {
    return;
  }
  try {
    const n = new Notification(`Incoming ${session.video ? "video" : "voice"} call`, {
      body: `${session.partnerName} is calling you`,
      tag: `call-${session.callUid || session.id}`,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* notifications unsupported */
  }
}

/** Persist a call record (both parties upsert the same id so there's one row). */
async function logCallStart(session: CallSession) {
  if (!session.callUid) return;
  callLogId = session.callUid;
  callStartedAt = Date.now();
  const myId = getSessionId();
  const myName = Store.displayName || "Guest";
  const outgoing = session.direction === "outgoing";
  try {
    await api.createCallLog({
      id: session.callUid,
      callerId: outgoing ? myId : session.partnerId || "",
      calleeId: outgoing ? session.partnerId || "" : myId,
      callerName: outgoing ? myName : session.partnerName,
      calleeName: outgoing ? session.partnerName : myName,
      video: session.video,
      status: "ringing",
      startedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[call] failed to log call start", err);
  }
}

/** Mark the persisted call record as finished with its outcome. */
async function logCallEnd(reason: CallEndReason) {
  if (!callLogId) return;
  const id = callLogId;
  const durationMs = callStartedAt ? Date.now() - callStartedAt : null;
  callLogId = null;
  try {
    await api.createCallLog({
      id,
      status: reason,
      endedAt: new Date().toISOString(),
      durationMs,
    });
  } catch (err) {
    console.warn("[call] failed to log call end", err);
  }
}

function teardownMedia() {
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }
  pc = null;
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  remoteStream = null;
  if (screenTrack) {
    try {
      screenTrack.stop();
    } catch {
      /* already stopped */
    }
  }
  screenTrack = null;
  cameraTrack = null;
  screenSharing = false;
  renegotiationPending = false;
  emitScreenShare();
  pendingSdp = null;
  pendingIce = [];
}

function clearRingTimeout() {
  if (ringTimeout) {
    clearTimeout(ringTimeout);
    ringTimeout = null;
  }
}

function clearConnectTimeout() {
  if (connectTimeout) {
    clearTimeout(connectTimeout);
    connectTimeout = null;
  }
}

/** Give up if the "connecting" phase drags on (e.g. peer vanished after accept). */
function scheduleConnectTimeout() {
  clearConnectTimeout();
  connectTimeout = setTimeout(() => {
    connectTimeout = null;
    if (current?.status === "connecting") finishCall("failed");
  }, CONNECT_TIMEOUT_MS);
}

function clearAutoClear() {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }
}

/**
 * Ends the current call into a brief "ended" state (with a reason) that the UI
 * shows for AUTO_CLEAR_MS before auto-dismissing, so callers/callees aren't
 * left wondering what happened.
 */
function finishCall(reason: CallEndReason) {
  if (!current || current.status === "ended") return;
  stopRingtone();
  clearRingTimeout();
  clearConnectTimeout();
  clearAutoClear();
  logCallEnd(reason).catch(() => {});
  teardownMedia();
  current = { ...current, status: "ended", endReason: reason, endedAt: Date.now() };
  emit();
  autoClearTimer = setTimeout(() => {
    if (current?.status === "ended") {
      current = null;
      emit();
    }
    autoClearTimer = null;
  }, AUTO_CLEAR_MS);
}

/** Unanswered calls are given up on after RING_TIMEOUT_MS. */
function scheduleRingTimeout() {
  clearRingTimeout();
  ringTimeout = setTimeout(() => {
    ringTimeout = null;
    if (!current || current.status !== "ringing") return;
    if (current.direction === "outgoing") {
      publish({ type: "cancel", from: getSessionId(), to: current.partnerId || undefined });
      finishCall("no-answer");
    } else {
      publish({ type: "decline", from: getSessionId(), to: current.partnerId || undefined });
      finishCall("missed");
    }
  }, RING_TIMEOUT_MS);
}

function attachMedia(el: HTMLVideoElement | null, stream: MediaStream | null) {
  if (el && stream) el.srcObject = stream;
}

function createPC() {
  pc = new RTCPeerConnection(RTC_CONFIG);
  localStream?.getTracks().forEach((t) => pc!.addTrack(t, localStream!));
  pc.onicecandidate = (ev) => {
    if (ev.candidate && current?.partnerId) {
      publish({ type: "ice", from: getSessionId(), to: current.partnerId, candidate: ev.candidate.toJSON() });
    }
  };
  pc.ontrack = (ev) => {
    remoteStream = ev.streams[0] || new MediaStream([ev.track]);
    attachMedia(remoteVideoEl, remoteStream);
    if (current) {
      clearConnectTimeout();
      current = { ...current, status: "active" };
      emit();
    }
  };
  pc.onconnectionstatechange = () => {
    if (
      pc?.connectionState === "disconnected" ||
      pc?.connectionState === "failed" ||
      pc?.connectionState === "closed"
    ) {
      finishCall(pc?.connectionState === "failed" ? "failed" : "ended");
    }
  };
  pc.onsignalingstatechange = () => {
    // Retry a renegotiation that was deferred while another offer was in flight.
    if (pc?.signalingState === "stable" && renegotiationPending) {
      renegotiationPending = false;
      renegotiate().catch(() => {});
    }
  };
}

async function handleSdp(msg: SignalMessage) {
  if (!pc) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp!));
    if (msg.sdp?.type === "offer" && current) {
      const answer = await pc!.createAnswer();
      await pc!.setLocalDescription(answer);
      const desc = pc!.localDescription;
      if (desc) {
        publish({ type: "sdp", from: getSessionId(), to: current.partnerId || undefined, sdp: desc });
      }
    }
  } catch (err) {
    console.warn("[call] setRemoteDescription failed", err);
  }
}

function handleIce(msg: SignalMessage) {
  if (!pc || !msg.candidate) return;
  pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch((err) =>
    console.warn("[call] addIceCandidate failed", err)
  );
}

function flushPendingIce() {
  if (!pc) return;
  const ice = pendingIce;
  pendingIce = [];
  ice.forEach((m) => handleIce(m));
}

/** Process buffered signals once the PeerConnection exists (offer first, then ICE). */
function flushPendingSignals() {
  if (!pc) return;
  if (pendingSdp) {
    const msg = pendingSdp;
    pendingSdp = null;
    handleSdp(msg).then(flushPendingIce).catch(flushPendingIce);
  } else {
    flushPendingIce();
  }
}

async function setupMedia(video: boolean): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      video ? { video: true, audio: true } : { video: false, audio: true }
    );
    localStream = stream;
    attachMedia(localVideoEl, stream);
    return true;
  } catch (err) {
    console.warn("[call] media access failed", err);
    return false;
  }
}

function handleSignal(msg: SignalMessage) {
  const myId = getSessionId();
  if (msg.to && msg.to !== myId && msg.type !== "end") return;

  switch (msg.type) {
    case "invite": {
      // Busy: politely decline on the caller's ring channel so they know.
      if (current && current.status !== "ended") {
        publishToUser(msg.from, { type: "decline", from: myId, to: msg.from });
        return;
      }
      if (msg.to !== myId) return;
      ensureUserChannel();
      muted = false;
      camOff = false;
      current = {
        id: nextCallId++,
        callUid: msg.callUid,
        roomId: msg.roomId || activeChannelId || "",
        direction: "incoming",
        video: Boolean(msg.video),
        partnerId: msg.from || null,
        partnerName: msg.fromName || msg.from || "Guest",
        status: "ringing",
      };
      emit();
      scheduleRingTimeout();
      stopRingtone();
      tone([440], 1000, 500, 0.08);
      vibrate([800, 400, 800, 400, 800]);
      logCallStart(current).catch(() => {});
      notifyIncomingCall(current);
      break;
    }
    case "accept": {
      if (!current || current.direction !== "outgoing" || current.status !== "ringing") return;
      if (msg.from !== current.partnerId) return;
      stopRingtone();
      current = { ...current, status: "connecting" };
      emit();
      clearRingTimeout();
      scheduleConnectTimeout();
      callerConnect().catch(() => finishCall("failed"));
      break;
    }
    case "decline": {
      if (current?.direction === "outgoing" && current.status === "ringing" && msg.from === current.partnerId) {
        finishCall("declined");
      }
      break;
    }
    case "cancel": {
      if (current?.direction === "incoming" && current.status === "ringing" && msg.from === current.partnerId) {
        finishCall("canceled");
      }
      break;
    }
    case "end": {
      if (current && current.status !== "ended") finishCall("ended");
      break;
    }
    case "sdp": {
      if (!current || msg.to !== myId || msg.from !== current.partnerId) return;
      if (!pc) {
        pendingSdp = msg;
        return;
      }
      handleSdp(msg);
      break;
    }
    case "ice": {
      if (!current || msg.to !== myId || msg.from !== current.partnerId || !msg.candidate) return;
      if (!pc) {
        pendingIce.push(msg);
        return;
      }
      handleIce(msg);
      break;
    }
  }
}

async function callerConnect() {
  if (!current) return;
  const ok = await setupMedia(current.video);
  if (!ok) return finishCall("failed");
  createPC();
  flushPendingSignals();
  try {
    const offer = await pc!.createOffer();
    await pc!.setLocalDescription(offer);
    const desc = pc!.localDescription;
    if (desc) {
      publish({
        type: "sdp",
        from: getSessionId(),
        to: current.partnerId || undefined,
        sdp: desc,
      });
    }
  } catch (err) {
    console.warn("[call] offer failed", err);
    finishCall("failed");
  }
}

function syncSignalChannel() {
  // While a call is live, keep listening on the call's channel; otherwise follow
  // the viewed channel.
  const target = current && current.status !== "ended" ? current.roomId : activeChannelId;
  if (subscribedSignalChannelId === target) return;
  if (signalChannel) {
    signalChannel.unsubscribe("call");
    signalChannel = null;
  }
  subscribedSignalChannelId = target;
  if (!target) return;
  const channel = getChatClient().realtime.channels.get(`call-${target}`);
  channel.subscribe("call", (msg) => handleSignal(msg.data as SignalMessage));
  channel.attach().catch(() => {});
  signalChannel = channel;
}

export function setActiveChannel(channelId: string | null) {
  activeChannelId = channelId;
  ensureUserChannel();
  syncSignalChannel();
}

export async function initiateCall(partnerId: string, partnerName: string, video: boolean): Promise<void> {
  if (current && current.status !== "ended") return;
  if (!activeChannelId) return;
  ensureUserChannel();
  muted = false;
  camOff = false;
  clearAutoClear();
  const callUid = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  current = {
    id: nextCallId++,
    callUid,
    roomId: activeChannelId,
    direction: "outgoing",
    video,
    partnerId,
    partnerName,
    status: "ringing",
  };
  emit();
  stopRingtone();
  tone([440, 480], 2000, 4000, 0.06);
  scheduleRingTimeout();
  // Deliver the invite to the partner's personal ring channel so they get it
  // no matter which channel they're viewing.
  publishToUser(partnerId, {
    type: "invite",
    from: getSessionId(),
    fromName: Store.displayName || "Guest",
    to: partnerId,
    video,
    roomId: activeChannelId,
    callUid,
  });
  logCallStart(current).catch(() => {});
}

export function acceptCall(): void {
  if (!current || current.direction !== "incoming" || current.status !== "ringing") return;
  stopRingtone();
  clearRingTimeout();
  current = { ...current, status: "connecting" };
  emit();
  scheduleConnectTimeout();
  publish({ type: "accept", from: getSessionId(), to: current.partnerId || undefined });
  setupMedia(current.video).then((ok) => {
    if (!ok) return finishCall("failed");
    createPC();
    flushPendingSignals();
  });
}

export function declineCall(): void {
  if (current?.direction === "incoming") {
    publish({ type: "decline", from: getSessionId(), to: current.partnerId || undefined });
  }
  finishCall("declined");
}

export function cancelCall(): void {
  if (current?.direction === "outgoing") {
    publish({ type: "cancel", from: getSessionId(), to: current.partnerId || undefined });
  }
  finishCall("canceled");
}

export function endCall(): void {
  if (current) {
    publish({ type: "end", from: getSessionId(), to: current.partnerId || undefined });
  }
  finishCall("ended");
}

/** Manually dismiss the brief "Call ended" / "Missed call" overlay early. */
export function dismissEndedCall(): void {
  if (current?.status === "ended") {
    clearAutoClear();
    current = null;
    emit();
  }
}

export function toggleMute(): void {
  if (!localStream) return;
  muted = !muted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
}

export function toggleCamera(): void {
  if (!localStream) return;
  camOff = !camOff;
  localStream.getVideoTracks().forEach((t) => (t.enabled = !camOff));
}

export function setVideoElements(local: HTMLVideoElement | null, remote: HTMLVideoElement | null): void {
  localVideoEl = local;
  remoteVideoEl = remote;
  attachMedia(localVideoEl, localStream);
  attachMedia(remoteVideoEl, remoteStream);
}

export function subscribeCall(listener: CallListener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function isMuted(): boolean {
  return muted;
}

export function isCameraOff(): boolean {
  return camOff;
}

/** Send a fresh offer to the partner (used after track swaps like screen share). */
async function renegotiate() {
  if (!pc || !current) return;
  if (pc.signalingState !== "stable") {
    // Defer until the in-flight negotiation settles (see onsignalingstatechange).
    renegotiationPending = true;
    return;
  }
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const desc = pc.localDescription;
    if (desc) {
      publish({ type: "sdp", from: getSessionId(), to: current.partnerId || undefined, sdp: desc });
    }
  } catch (err) {
    console.warn("[call] renegotiation failed", err);
  }
}

/** Start/stop screen sharing on an active video call. Returns the new state. */
export async function toggleScreenShare(): Promise<boolean> {
  if (!pc || !current || current.status !== "active") return screenSharing;

  if (screenSharing) {
    stopScreenShare();
    return false;
  }

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    const track = displayStream.getVideoTracks()[0];
    if (!track) {
      displayStream.getTracks().forEach((t) => t.stop());
      return false;
    }
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
    if (!sender) {
      displayStream.getTracks().forEach((t) => t.stop());
      return false;
    }
    cameraTrack = sender.track;
    screenTrack = track;
    screenSharing = true;
    emitScreenShare();
    await sender.replaceTrack(track);
    track.addEventListener("ended", () => {
      if (!screenSharing) return;
      screenSharing = false;
      screenTrack = null;
      emitScreenShare();
      const restore = cameraTrack;
      cameraTrack = null;
      if (restore && pc) {
        const s = pc.getSenders().find((x) => x.track && x.track.kind === "video");
        s?.replaceTrack(restore).then(() => renegotiate()).catch(() => {});
      }
    });
    await renegotiate();
    return true;
  } catch (err) {
    console.warn("[call] screen share failed", err);
    return false;
  }
}

async function stopScreenShare() {
  if (!screenTrack) return;
  const sender = pc?.getSenders().find((s) => s.track && s.track.kind === "video");
  const restore = cameraTrack;
  screenTrack = null;
  screenSharing = false;
  cameraTrack = null;
  emitScreenShare();
  if (sender && restore) {
    await sender.replaceTrack(restore);
    await renegotiate();
  }
}

export function isScreenSharing(): boolean {
  return screenSharing;
}

/** Subscribe to screen-share state changes (e.g. browser-native stop button). */
export function subscribeScreenShare(cb: (sharing: boolean) => void): () => void {
  screenShareListeners.add(cb);
  cb(screenSharing);
  return () => {
    screenShareListeners.delete(cb);
  };
}

/** Ensure the personal ring channel is subscribed (called once at app start). */
export function initCallSignaling(): void {
  ensureUserChannel();
}

// End any active call when the tab is closed so the far side doesn't hang.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (current && current.status !== "ended") {
      publish({ type: "end", from: getSessionId(), to: current.partnerId || undefined });
      logCallEnd("ended").catch(() => {});
    }
  });
}
