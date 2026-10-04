import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { friendlyError } from "../../lib/utils";

const MAX_BODY = 2000;

// Live room chat.
//
// The academy_live_messages table has always carried a body column alongside
// audio_path, and the row level policies already allow a signed in participant
// to insert their own message into a room they can reach. What was missing was
// any way to type one: the room was voice only, so the table held nothing but
// recordings. Messages are persisted server side, so they survive a reload and
// are delivered to everyone in the room through the realtime subscription that
// the room already opens.
export default function LiveChat({
  roomId,
  userId,
  isAdmin = false,
  disabled = false,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const activeRoom = useRef(roomId);

  useEffect(() => {
    activeRoom.current = roomId;
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    // Only text messages. Voice notes are rendered by the room itself, and
    // showing them here too would duplicate the recording player.
    supabase
      .from("academy_live_messages")
      .select("id, sender_id, body, created_at")
      .eq("room_id", roomId)
      .not("body", "is", null)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError(friendlyError(loadError, "Chat could not be loaded."));
          setMessages([]);
        } else {
          setMessages(data ?? []);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`live-chat:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "academy_live_messages",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            if (payload.old?.room_id === roomId && payload.old?.id) {
              setMessages((current) =>
                current.filter((message) => message.id !== payload.old.id),
              );
            }
            return;
          }
          const row = payload.new;
          if (payload.eventType !== "INSERT" || row?.room_id !== roomId || !row?.body) return;
          setMessages((current) => {
            if (current.some((message) => message.id === row.id)) return current;
            return [...current, row].slice(-200);
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !roomId || sending) return;
    if (body.length > MAX_BODY) {
      setError(`Keep messages under ${MAX_BODY} characters.`);
      return;
    }

    setSending(true);
    setError("");
    const { error: sendError } = await supabase
      .from("academy_live_messages")
      .insert({ room_id: roomId, sender_id: userId, body });

    setSending(false);
    if (sendError) {
      setError(friendlyError(sendError, "Your message could not be sent."));
      return;
    }
    setDraft("");
  }

  async function deleteMessage(messageId) {
    if (!isAdmin || !roomId) return;
    if (!window.confirm("Delete this class chat message? This cannot be undone.")) {
      return;
    }
    setError("");
    const { error: deleteError } = await supabase
      .from("academy_live_messages")
      .delete()
      .eq("id", messageId)
      .eq("room_id", roomId);
    if (deleteError) {
      setError(friendlyError(deleteError, "The message could not be deleted."));
      return;
    }
    setMessages((current) => current.filter((message) => message.id !== messageId));
  }

  if (!roomId) return null;

  return (
    <section className="flex max-h-96 flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
          Class chat
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Everyone in this room can read and post. Messages stay saved unless
          an administrator removes one.
        </p>
      </header>

      <div className="min-h-32 flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              isMine={message.sender_id === userId}
              isAdmin={isAdmin && !disabled}
              onDelete={deleteMessage}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-800"
        onSubmit={send}
      >
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <textarea
            className="field min-h-11 resize-y"
            rows={1}
            value={draft}
            maxLength={MAX_BODY}
            disabled={disabled || sending}
            placeholder="Type a message"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter makes a new line, which is what a chat
              // box is expected to do on a phone keyboard too.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(event);
              }
            }}
          />
        </label>
        <button
          className="button-primary shrink-0"
          type="submit"
          disabled={disabled || sending || !draft.trim()}
        >
          {sending ? "..." : "Send"}
        </button>
      </form>

      {error && (
        <p role="alert" className="px-4 pb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {disabled && (
        <p className="px-4 pb-3 text-sm text-amber-700 dark:text-amber-300">
          You are offline. Messages will not send until you reconnect.
        </p>
      )}
    </section>
  );
}

function ChatBubble({ message, isMine, isAdmin, onDelete }) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
      {isAdmin && (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          aria-label={`Delete message: ${message.body.slice(0, 40)}`}
          onClick={() => onDelete(message.id)}
        >
          Delete
        </button>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isMine
            ? "bg-cyan-600 text-white"
            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`mt-1 text-[11px] ${
            isMine ? "text-cyan-100" : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {new Date(message.created_at).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
