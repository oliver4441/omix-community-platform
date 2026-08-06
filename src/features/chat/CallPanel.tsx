'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  X,
} from '@/components/ui/icons';
import {
  subscribeCall,
  acceptCall,
  declineCall,
  cancelCall,
  endCall,
  toggleMute,
  toggleCamera,
  toggleScreenShare,
  subscribeScreenShare,
  setVideoElements,
  dismissEndedCall,
  initCallSignaling,
  isMuted,
  isCameraOff,
} from '@/lib/calls';
import type { CallSession, CallEndReason } from '@/lib/types';

const END_LABELS: Record<CallEndReason, string> = {
  ended: 'Call ended',
  missed: 'Missed call',
  'no-answer': 'No answer',
  declined: 'Call declined',
  canceled: 'Call canceled',
  failed: 'Call failed',
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Call duration readout — remounted per call (via key) so it always starts at 00:00. */
function CallTimer() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000
    );
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-[var(--color-txt-muted)] tabular-nums">
      {formatDuration(elapsed)}
    </span>
  );
}

function StatusText({ session }: { session: CallSession }) {
  if (session.status === 'ended') {
    return (
      <span className="text-[var(--color-txt-muted)]">
        {END_LABELS[session.endReason || 'ended']}
      </span>
    );
  }
  if (session.direction === 'outgoing' && session.status === 'ringing') {
    return <span className="text-[var(--color-txt-muted)]">Calling…</span>;
  }
  if (session.status === 'connecting') {
    return <span className="text-[var(--color-txt-muted)]">Connecting…</span>;
  }
  if (session.status === 'ringing') {
    return (
      <span className="text-[var(--color-pri)]">
        Incoming {session.video ? 'video' : 'voice'} call
      </span>
    );
  }
  return (
    <span className="text-[var(--color-success)]">
      {session.video ? 'Video' : 'Voice'} call
    </span>
  );
}

/**
 * Everything that carries per-call UI state. Keyed by session.id so a new call
 * always starts with clean mute/camera toggles and fresh video element refs.
 */
function CallCard({ session }: { session: CallSession }) {
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVideoElements(localRef.current, remoteRef.current);
  }, [session.status, session.video]);

  useEffect(() => {
    const unsub = subscribeScreenShare(setSharing);
    return () => {
      unsub();
    };
  }, []);

  const isActive = session.status === 'active';
  const isEnded = session.status === 'ended';
  const isRinging = session.status === 'ringing';
  const isConnecting = session.status === 'connecting';
  const showLocalPreview = session.video && isConnecting;
  const showRemoteVideo = session.video && isActive;

  return (
    <div className="w-full max-w-lg mx-4 bg-[var(--color-bg-dark)] rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-2xl">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 text-center">
        <div className="text-lg font-bold text-[var(--color-txt)]">
          {session.partnerName}
        </div>
        <div className="text-sm mt-1 flex items-center justify-center gap-2">
          <StatusText session={session} />
          {isActive && <CallTimer />}
        </div>
      </div>

      {/* Media area */}
      <div className="relative mx-4 my-3 rounded-xl overflow-hidden bg-black h-72 flex items-center justify-center">
        {showRemoteVideo ? (
          <>
            <video
              ref={remoteRef}
              playsInline
              autoPlay
              className="w-full h-full object-cover"
            />
            <video
              ref={localRef}
              playsInline
              autoPlay
              muted
              className="absolute bottom-3 right-3 w-28 h-20 object-cover rounded-lg border border-white/20 bg-black"
            />
          </>
        ) : isEnded ? (
          <div className="flex flex-col items-center text-[var(--color-txt-muted)] px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-mid)] flex items-center justify-center mb-3">
              {session.endReason === 'missed' || session.endReason === 'no-answer' ? (
                <PhoneOff size={32} className="text-[var(--color-txt-muted)]" />
              ) : (
                <Phone size={32} className="text-[var(--color-txt-muted)]" />
              )}
            </div>
            <span className="text-base font-semibold text-[var(--color-txt)]">
              {END_LABELS[session.endReason || 'ended']}
            </span>
            <span className="text-xs mt-1">{session.partnerName}</span>
          </div>
        ) : showLocalPreview ? (
          <>
            <video
              ref={localRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-sm text-white/90">
              Connecting…
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-[var(--color-txt-muted)]">
            <div
              className={`w-20 h-20 rounded-full bg-[var(--color-pri-muted)] flex items-center justify-center mb-2 ${
                isRinging ? 'animate-pulse' : ''
              }`}
            >
              <Phone size={32} className="text-[var(--color-pri)]" />
            </div>
            <span className="text-sm">
              {isRinging
                ? 'Ringing…'
                : isConnecting
                  ? 'Connecting…'
                  : 'Connected'}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 px-4 pb-5 pt-1">
        {isEnded ? (
          <button
            onClick={dismissEndedCall}
            className="px-5 h-11 rounded-full bg-[var(--color-bg-mid)] hover:bg-[var(--color-bg-hover)] text-[var(--color-txt)] flex items-center gap-2 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
            <span className="text-sm font-medium">Close</span>
          </button>
        ) : !isActive ? (
          session.direction === 'incoming' ? (
            <>
              <button
                onClick={declineCall}
                className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
                aria-label="Decline call"
              >
                <PhoneOff size={20} />
              </button>
              <button
                onClick={acceptCall}
                className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-colors"
                aria-label="Accept call"
              >
                <Phone size={20} />
              </button>
            </>
          ) : (
            <button
              onClick={cancelCall}
              className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
              aria-label="Cancel call"
            >
              <PhoneOff size={20} />
            </button>
          )
        ) : (
          <>
            {session.video && (
              <button
                onClick={() => {
                  toggleScreenShare().catch(() => {});
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                  sharing
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-[var(--color-bg-mid)] hover:bg-[var(--color-bg-hover)] text-[var(--color-txt)]'
                }`}
                aria-label={sharing ? 'Stop sharing screen' : 'Share screen'}
                title={sharing ? 'Stop sharing screen' : 'Share screen'}
              >
                <Monitor size={18} />
              </button>
            )}
            <button
              onClick={() => {
                toggleCamera();
                setCameraOff(isCameraOff());
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                cameraOff
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-[var(--color-bg-mid)] hover:bg-[var(--color-bg-hover)] text-[var(--color-txt)]'
              }`}
              aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
            </button>
            <button
              onClick={() => {
                toggleMute();
                setMuted(isMuted());
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                muted
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-[var(--color-bg-mid)] hover:bg-[var(--color-bg-hover)] text-[var(--color-txt)]'
              }`}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              onClick={endCall}
              className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors"
              aria-label="End call"
            >
              <PhoneOff size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CallPanel() {
  const [session, setSession] = useState<CallSession | null>(null);

  useEffect(() => {
    initCallSignaling();
    const unsub = subscribeCall(setSession);
    return unsub;
  }, []);

  if (!session) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={session.status === 'ended' ? 'Call ended' : 'Call'}
    >
      <CallCard key={session.id} session={session} />
    </div>
  );
}
