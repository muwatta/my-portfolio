import { useEffect, useRef, useState } from "react";
import {
  getAcademyLiveMessages,
  getAcademyLiveRooms,
  joinAcademyLiveRoom,
  leaveAcademyLiveRoom,
  sendAcademyLiveMessage,
} from "../lib/academy";
import { supabase } from "../lib/supabase";
import { useAcademyAuth } from "../hooks/useAcademyAuth";

export default function AcademyLiveRoom() {
  const { user } = useAcademyAuth();
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [state, setState] = useState("loading");
  const [participants, setParticipants] = useState([]);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [mediaState, setMediaState] = useState("off");
  const [mediaError, setMediaError] = useState("");
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
  useEffect(() => {
    if (!roomId) return undefined;
    getAcademyLiveMessages(roomId).then(({ data }) => setMessages(data ?? []));
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
        (payload) => setMessages((current) => [...current, payload.new]),
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
      supabase.removeChannel(channel);
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
      setMediaError(error.message || "Microphone access was denied.");
    }
  }

  function toggleMute() {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
  }
  async function send(event) {
    event.preventDefault();
    if (!body.trim() || !roomId) return;
    const { data } = await sendAcademyLiveMessage(roomId, user.id, body);
    if (data)
      setMessages((current) =>
        current.some((item) => item.id === data.id)
          ? current
          : [...current, data],
      );
    setBody("");
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
              {messages.map((message) => (
                <p
                  key={message.id}
                  className="rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800"
                >
                  <span className="font-semibold">
                    {message.sender_id === user.id ? "You" : "Participant"}
                    :{" "}
                  </span>
                  {message.body}
                </p>
              ))}
            </div>
            {roomId && (
              <form
                className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
                onSubmit={send}
              >
                <input
                  className="field"
                  value={body}
                  maxLength={2000}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Send a message"
                  aria-label="Message"
                />
                <button className="button-primary" type="submit">
                  Send
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
