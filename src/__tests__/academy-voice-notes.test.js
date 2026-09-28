import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatDuration } from "../lib/academy";

const MIGRATIONS = "supabase/migrations";
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(`${MIGRATIONS}/${name}`, "utf8"))
  .join("\n");

function latestDefinition(name) {
  const matches = [
    ...allSql.matchAll(
      new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`,
        "g",
      ),
    ),
  ];
  expect(matches.length, `${name} should exist`).toBeGreaterThan(0);
  return matches.at(-1)[0];
}

const post = latestDefinition("academy_post_voice_note");
const cleanup = latestDefinition("academy_cleanup_live_data");
const room = readFileSync("src/pages/AcademyLiveRoom.jsx", "utf8");
const recorder = readFileSync(
  "src/components/academy/VoiceNoteRecorder.jsx",
  "utf8",
);

describe("the room is voice only", () => {
  it("has no text field left in the room", () => {
    expect(room).not.toMatch(/Send a message/);
    expect(room).not.toMatch(/aria-label="Message"/);
    expect(room).not.toMatch(/sendAcademyLiveMessage/);
  });

  it("closes text off at the privilege level, not just in the interface", () => {
    // A rule that only hides the text box is one UI change away from being wrong.
    expect(allSql).toMatch(
      /drop policy if exists academy_live_messages_self_insert on public\.academy_live_messages/,
    );
    expect(post).toMatch(/body/);
    expect(post).toMatch(/null, p_audio_path/);
  });

  it("tells the student the rule and the retention", () => {
    expect(room).toMatch(/Voice notes only/);
    expect(room).toMatch(/two weeks/);
  });
});

describe("posting a voice note", () => {
  it("needs a live session the caller can reach", () => {
    expect(post).toMatch(/Authentication required/);
    expect(post).toMatch(/academy_can_access_live_room/);
  });

  it("caps the length and the size", () => {
    expect(post).toMatch(/at most 5 minutes/);
    expect(post).toMatch(/at most 2 MB/);
    expect(post).toMatch(/p_duration_seconds > 300/);
    expect(post).toMatch(/p_size_bytes > 2097152/);
  });

  it("only accepts audio a browser actually produces", () => {
    expect(post).toMatch(/Unsupported audio format/);
    expect(post).toMatch(/audio\/\(webm\|ogg\|mp4\|mpeg\|wav\|x-wav\)/);
  });

  it("will not let one member post a note attributed to another", () => {
    expect(post).toMatch(/stored in your own folder/);
    expect(post).toMatch(/required_prefix := auth\.uid\(\)::text/);
  });

  it("stores the audio privately", () => {
    expect(allSql).toMatch(
      /values \('live-voice-notes', 'live-voice-notes', false\)/,
    );
    expect(allSql).toMatch(/academy_voice_notes_self_read/);
  });
});

describe("retention removes the audio, not just the row", () => {
  it("deletes the storage objects for messages that are going", () => {
    // Deleting the row and leaving the recording would keep every voice note
    // forever, which is the opposite of what the window is for.
    expect(cleanup).toMatch(/select coalesce\(array_agg\(audio_path\), '\{\}'\)/);
    expect(cleanup).toMatch(/delete from storage\.objects/);
    expect(cleanup).toMatch(/bucket_id = 'live-voice-notes'/);
  });

  it("keeps the fourteen day window across messages, sessions and heartbeats", () => {
    expect(cleanup).toMatch(/academy_live_messages[\s\S]*'14 days'/);
    expect(cleanup).toMatch(/academy_learning_sessions[\s\S]*'14 days'/);
    expect(cleanup).toMatch(/academy_learning_session_events[\s\S]*'14 days'/);
  });

  it("never touches an active learning session", () => {
    expect(cleanup).toMatch(/where is_active is false/);
  });
});

describe("recording in the browser", () => {
  it("releases the microphone when the component goes away", () => {
    expect(recorder).toMatch(/getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/);
    expect(recorder).toMatch(/useEffect\(\(\) => stopTracks, \[stopTracks\]\)/);
  });

  it("stops on its own at the limit so a note cannot run away", () => {
    expect(recorder).toMatch(/elapsed >= MAX_VOICE_NOTE_SECONDS/);
  });

  it("tells the student when the microphone is blocked", () => {
    expect(recorder).toMatch(/microphone is blocked/);
  });

  it("degrades to read only when the browser cannot record", () => {
    expect(recorder).toMatch(/MediaRecorder/);
    expect(recorder).toMatch(/read only/);
  });

  it("respects a reduced motion preference on the recording dot", () => {
    expect(recorder).toMatch(/motion-reduce:animate-none/);
  });
});

describe("duration formatting", () => {
  it("pads to a clock reading", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(9)).toBe("00:09");
    expect(formatDuration(65)).toBe("01:05");
    expect(formatDuration(300)).toBe("05:00");
  });

  it("never renders NaN for a missing duration", () => {
    expect(formatDuration(null)).toBe("00:00");
    expect(formatDuration(undefined)).toBe("00:00");
  });
});
