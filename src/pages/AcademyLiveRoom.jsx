import { useEffect, useState } from "react";
import {
  getAcademyLiveMessages,
  getAcademyLiveRooms,
  joinAcademyLiveRoom,
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user.id]);
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
