import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAcademyLiveMessages,
  getAcademyLiveRooms,
  joinAcademyLiveRoom,
  leaveAcademyLiveRoom,
  formatDuration,
  getVoiceNoteUrl,
} from "../lib/academy";
import VoiceNoteRecorder from "../components/academy/VoiceNoteRecorder";
import LiveChat from "../components/academy/LiveChat";
import { supabase } from "../lib/supabase";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { friendlyError } from "../lib/utils";

export default function AcademyLiveRoom() {
  const { user } = useAcademyAuth();
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState([]);
  const [state, setState] = useState("loading");
  const [participants, setParticipants] = useState([]);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [mediaState, setMediaState] = useState("off");
  const [mediaError, setMediaError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const setConnection = () => setOffline(!navigator.onLine);
    window.addEventListener("online", setConnection);
    window.addEventListener("offline", setConnection);
    return () => {
      window.removeEventListener("online", setConnection);
      window.removeEventListener("offline", setConnection);
    };
  }, []);
  const [muted, setMuted] = useState(false);
  const channelRef = useRef(null);
  const peersRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  useEffect(() => {
    getAcademyLiveRooms().then(({ data, error, configured }) => {
      setRooms(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, []);
  const loadMessages = useCallback(() => {
    if (!roomId) return Promise.resolve();
    return getAcademyLiveMessages(roomId).then(({ data }) =>
      setMessages(data ?? []),
    );
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return undefined;
    loadMessages();
    joinAcademyLiveRoom(roomId, user.id);
    if (!supabase) return undefined;
    const channel = supabase
      .channel(`academy-room-${roomId}`)
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = Object.values(state)
          .flat()
          .map((item) => item.user_id)
          .filter(Boolean);
        setParticipants([...new Set(ids)]);
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key && key !== user.id && user.id < key) {
          createPeer(key, true);
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        closePeer(key);
      })
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        if (!payload || payload.to !== user.id) return;
        handleSignal(payload);
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "academy_live_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) =>
          setMessages((current) => {
            if (current.some((message) => message.id === payload.new.id)) {
              return current;
            }
            return [...current, payload.new].sort((a, b) =>
              String(a.created_at).localeCompare(String(b.created_at)),
            );
          }),
      )
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            joined_at: new Date().toISOString(),
          });
        }
      });
    channelRef.current = channel;
    return () => {
      // The room owns this mutable peer registry until its channel closes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const peers = peersRef.current;
      void supabase.removeChannel(channel);
      channelRef.current = null;
      peers.forEach((peer) => peer.close());
      peers.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      leaveAcademyLiveRoom(roomId);
      setConnectedPeers([]);
      setParticipants([]);
    };
    // The signaling callbacks intentionally close over the room's user identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user.id]);

  useEffect(() => {
    const stream = localStreamRef.current;
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function sendSignal(payload) {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: "broadcast",
      event: "signal",
      payload,
    });
  }

  function registerPeer(peerId, peer) {
    peersRef.current.set(peerId, peer);
    setConnectedPeers([...peersRef.current.keys()]);
  }

  function closePeer(peerId) {
    peersRef.current.get(peerId)?.close();
    peersRef.current.delete(peerId);
    setConnectedPeers([...peersRef.current.keys()]);
  }

  function createPeer(peerId, initiator = false) {
    if (peersRef.current.has(peerId)) return peersRef.current.get(peerId);
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    localStreamRef.current
      ?.getTracks()
      .forEach((track) => peer.addTrack(track, localStreamRef.current));
    peer.onicecandidate = (event) => {
      if (event.candidate)
        sendSignal({
          to: peerId,
          from: user.id,
          type: "candidate",
          candidate: event.candidate,
        });
    };
    peer.ontrack = (event) => {
      if (!remoteAudioRef.current) return;
      remoteAudioRef.current.srcObject = event.streams[0];
      remoteAudioRef.current.play().catch(() => {});
    };
    peer.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peer.connectionState))
        closePeer(peerId);
    };
    registerPeer(peerId, peer);
    if (initiator) {
      peer
        .createOffer()
        .then((offer) => peer.setLocalDescription(offer))
        .then(() =>
          sendSignal({
            to: peerId,
            from: user.id,
            type: "offer",
            description: peer.localDescription,
          }),
        );
    }
    return peer;
  }

  async function handleSignal(signal) {
    const peer = createPeer(signal.from, false);
    if (signal.type === "offer") {
      await peer.setRemoteDescription(signal.description);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal({
        to: signal.from,
        from: user.id,
        type: "answer",
        description: peer.localDescription,
      });
    } else if (signal.type === "answer") {
      await peer.setRemoteDescription(signal.description);
    } else if (signal.type === "candidate" && signal.candidate) {
      await peer.addIceCandidate(signal.candidate);
    }
  }

  async function enableMicrophone() {
    setMediaError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError("This browser does not provide microphone access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      setMediaState("on");
      peersRef.current.forEach((peer) =>
        stream.getTracks().forEach((track) => peer.addTrack(track, stream)),
      );
    } catch (error) {
      setMediaState("off");
      setMediaError(friendlyError(error, "Microphone access was denied."));
    }
  }

  function toggleMute() {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Realtime classroom
        </p>
        <h1 className="mt-2 text-3xl font-bold">Live learning</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Join an active room for attendance and moderated text chat.
        </p>
       </header>
       {offline && (
         <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
           Live classroom requires an internet connection. Downloaded lesson materials remain available offline.
         </p>
       )}
       {state === "loading" && <p>Loading rooms...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Live rooms could not be loaded.
        </p>
      )}
      {state === "ready" && rooms.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm dark:border-slate-700">
          No live classrooms are scheduled.
        </p>
      )}
      {rooms.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <nav className="space-y-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setRoomId(room.id)}
                className={`w-full border-l-4 p-4 text-left ${roomId === room.id ? "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}
              >
                <span className="font-semibold">{room.title}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {room.status}
                </span>
              </button>
            ))}
          </nav>
          <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {roomId && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 text-sm dark:border-slate-800">
                <span className="font-semibold">
                  {participants.length} participant
                  {participants.length === 1 ? "" : "s"}
                </span>
                <span className="text-slate-500">
                  {connectedPeers.length} audio connection
                  {connectedPeers.length === 1 ? "" : "s"}
                </span>
                <button
                  className="button-secondary px-3 py-1.5"
                  type="button"
                  onClick={mediaState === "on" ? toggleMute : enableMicrophone}
                >
                  {mediaState === "on"
                    ? muted
                      ? "Unmute"
                      : "Mute"
                    : "Enable microphone"}
                </button>
                {mediaError && (
                  <span role="alert" className="text-red-600">
                    {mediaError}
                  </span>
                )}
                <audio
                  ref={remoteAudioRef}
                  autoPlay
                  aria-label="Classroom audio"
                />
              </div>
            )}
            <div className="min-h-72 space-y-3 p-5">
              {!roomId && (
                <p className="text-sm text-slate-500">Choose a room to join.</p>
              )}
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No voice notes yet. The first one is yours.
                </p>
              ) : null}
              {messages.map((message) => (
                <VoiceNote
                  key={message.id}
                  message={message}
                  isMine={message.sender_id === user.id}
                />
              ))}
            </div>
            {roomId && (
              <div className="border-t border-slate-200 p-4 dark:border-slate-800">
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  Record a voice note, or use the class chat below. Everything
                  here disappears after two weeks.
                </p>
                <div className="mb-4">
                  <LiveChat
                    roomId={roomId}
                    userId={user.id}
                    disabled={offline}
                  />
                </div>
                <VoiceNoteRecorder
                  roomId={roomId}
                  disabled={offline}
                  onPosted={loadMessages}
                />
                {offline ? (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    Reconnect to record. The room is not available offline.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function VoiceNote({ message, isMine }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!message.audio_path) return undefined;
    getVoiceNoteUrl(message.id, message.audio_path).then((result) => {
      if (cancelled) return;
      if (result.error) setError("This recording could not be loaded.");
      else setUrl(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [message.id, message.audio_path]);

  return (
    <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
      <p className="text-sm font-semibold">
        {isMine ? "You" : "Participant"}
        <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
          {formatDuration(message.duration_seconds)} ·{" "}
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </p>
      {error ? (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : url ? (
        <audio
          controls
          preload="none"
          src={url}
          className="mt-2 w-full"
          aria-label="Voice note"
        />
      ) : (
        <p className="mt-1 text-sm text-slate-500">Loading the recording</p>
      )}
    </div>
  );
}
