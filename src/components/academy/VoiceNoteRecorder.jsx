import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_VOICE_NOTE_BYTES,
  MAX_VOICE_NOTE_SECONDS,
  formatDuration,
  sendAcademyVoiceNote,
} from "../../lib/academy";
import { friendlyError } from "../../lib/utils";

// The room is voice only, so this is the only way to post. Recording happens in
// the browser and the audio is uploaded once the student stops, so nothing sits
// in memory while they are still talking.
export default function VoiceNoteRecorder({ roomId, onPosted, disabled }) {
  const [state, setState] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);

  const supported =
    typeof navigator !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop the microphone on unmount, otherwise the browser keeps the recording
  // indicator on after the student leaves the page.
  useEffect(() => stopTracks, [stopTracks]);

  async function start() {
    setError("");
    if (!supported) {
      setError("This browser cannot record audio. Try Chrome or Safari.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // A quiet level meter, so a student can tell the mic is actually picking
      // them up rather than recording silence.
      const context = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = context;
      const analyser = context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const read = () => {
        analyser.getByteFrequencyData(samples);
        const average =
          samples.reduce((total, value) => total + value, 0) / samples.length;
        setLevel(Math.min(100, Math.round((average / 255) * 300)));
        rafRef.current = requestAnimationFrame(read);
      };
      read();

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => upload(chunksRef.current, startedAtRef.current);
      recorderRef.current = recorder;
      recorder.start();

      startedAtRef.current = Date.now();
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_VOICE_NOTE_SECONDS) {
          stop();
        }
      }, 250);
    } catch {
      setError("The microphone is blocked. Allow access, then try again.");
      stopTracks();
      setState("idle");
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    stopTracks();
    setState("uploading");
  }

  function discard() {
    chunksRef.current = [];
    stopTracks();
    recorderRef.current = null;
    setState("idle");
    setSeconds(0);
  }

  async function upload(chunks, startedAt) {
    const durationSeconds = Math.max(1, (Date.now() - startedAt) / 1000);
    const blob = new Blob(chunks, {
      type: recorderRef.current?.mimeType || chunks[0]?.type || "audio/webm",
    });

    if (blob.size === 0) {
      setError("That recording was empty, so it was not sent.");
      setState("idle");
      return;
    }
    if (blob.size > MAX_VOICE_NOTE_BYTES) {
      setError("That note is too long. Keep it under two minutes.");
      setState("idle");
      return;
    }

    const { error: failure } = await sendAcademyVoiceNote({
      roomId,
      blob,
      durationSeconds,
    });
    setState("idle");
    setSeconds(0);

    if (failure) {
      setError(friendlyError(failure, "That note could not be sent."));
      return;
    }
    onPosted?.();
  }

  if (!supported) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        This browser cannot record audio, so the room is read only here. Chrome
        or Safari on a phone both work.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {state === "idle" ? (
        <button
          type="button"
          className="button-primary inline-flex items-center gap-2"
          onClick={start}
          disabled={disabled}
        >
          <MicIcon />
          Record a voice note
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-50 px-3 text-sm font-semibold text-red-800 dark:bg-red-950/50 dark:text-red-200"
            role="status"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600 motion-reduce:animate-none" />
            {formatDuration(seconds)}
            {state === "uploading" ? " sending" : " recording"}
          </span>

          <span
            aria-hidden="true"
            className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <span
              className="block h-full rounded-full bg-emerald-500 transition-[width] duration-75"
              style={{ width: `${level}%` }}
            />
          </span>

          {state === "recording" ? (
            <button type="button" className="button-secondary" onClick={stop}>
              Stop and send
            </button>
          ) : null}
          <button type="button" className="button-ghost" onClick={discard}>
            Discard
          </button>
        </div>
      )}

      {state === "recording" ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Stops on its own at {formatDuration(MAX_VOICE_NOTE_SECONDS)}.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 fill-current"
    >
      <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
    </svg>
  );
}
