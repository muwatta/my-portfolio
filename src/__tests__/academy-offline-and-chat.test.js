import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chat = readFileSync("src/components/academy/LiveChat.jsx", "utf8");
const room = readFileSync("src/pages/AcademyLiveRoom.jsx", "utf8");
const rescue = readFileSync("src/components/academy/NetworkRescue.jsx", "utf8");
const contact = readFileSync("src/components/academy/ContactAdmin.jsx", "utf8");
const forgot = readFileSync("src/pages/AcademyForgotPassword.jsx", "utf8");
const reset = readFileSync("src/pages/AcademyResetPassword.jsx", "utf8");
const dashboard = readFileSync("src/pages/AcademyDashboard.jsx", "utf8");
const files = readFileSync("src/lib/academyFiles.js", "utf8");
const register = readFileSync(
  "supabase/migrations/20261219000000_register_submission_verbatim.sql",
  "utf8",
);

describe("class chat is persistent and open to everyone in the room", () => {
  it("is mounted in the live room", () => {
    expect(room).toMatch(/<LiveChat/);
  });

  it("sends text to the same table the room already subscribes to", () => {
    expect(chat).toMatch(/from\("academy_live_messages"\)/);
    expect(chat).toMatch(/insert\(\{ room_id: roomId, sender_id: userId, body \}\)/);
  });

  it("is not voice only any more, and the copy says so", () => {
    expect(room).not.toMatch(/Voice notes only/);
    expect(room.replace(/\s+/g, " ")).toMatch(/class chat below/);
  });

  it("does not duplicate the sender's own message when realtime echoes it", () => {
    // Without this the sender sees every message twice.
    expect(chat).toMatch(/current\.some\(\(message\) => message\.id === row\.id\)/);
  });

  it("bounds the body to what the table allows", () => {
    expect(chat).toMatch(/const MAX_BODY = 2000/);
  });

  it("sends on Enter and makes a new line on Shift+Enter", () => {
    expect(chat).toMatch(/event\.key === "Enter" && !event\.shiftKey/);
  });

  it("is honest that an offline message does not send", () => {
    expect(chat).toMatch(/You are offline\. Messages will not send/);
  });
});

describe("losing the network gives a student something to do", () => {
  it("appears when a section actually failed", () => {
    expect(dashboard).toMatch(/anyFailed/);
    expect(dashboard).toMatch(/<NetworkRescue/);
  });

  it("explains that nothing is lost, rather than saying network error", () => {
    const flat = rescue.replace(/\s+/g, " ");
    expect(flat).toMatch(/You are offline/);
    expect(flat).toMatch(/Nothing you have already downloaded is affected/);
    expect(flat).toMatch(/nothing you have done is lost/);
  });

  it("offers real advice, including the queued work case", () => {
    const flat = rescue.replace(/\s+/g, " ");
    expect(flat).toMatch(/Your work is not lost/);
    expect(flat).toMatch(/queued and send themselves/);
  });

  it("plays a quiz built from what the student already downloaded", () => {
    expect(rescue).toMatch(/getOfflineRecords/);
    expect(rescue).toMatch(/OFFLINE_STORES\.exercises/);
    expect(rescue).toMatch(/question_type === "multiple_choice"/);
  });

  it("fetches nothing, so it works with no connection at all", () => {
    const quiz = rescue.slice(rescue.indexOf("function OfflineQuiz"));
    expect(quiz).not.toMatch(/\bfetch\(|supabase\.from/);
  });

  it("explains itself when there is nothing downloaded to ask about", () => {
    const flat = rescue.replace(/\s+/g, " ");
    expect(flat).toMatch(/No offline quiz yet/);
    expect(flat).toMatch(/Download a topic while you have signal/);
  });

  it("shows the right answer after a choice rather than on the next load", () => {
    expect(rescue).toMatch(/border-emerald-500/);
    expect(rescue).toMatch(/isAnswer/);
  });

  it("offers a retry, and the FAQ, and a human", () => {
    const flat = rescue.replace(/\s+/g, " ");
    expect(flat).toMatch(/Try again/);
    expect(flat).toMatch(/\/academy\/faq/);
    expect(rescue).toMatch(/<ContactAdmin/);
  });
});

describe("a stuck student can reach a person", () => {
  it("uses the Academy WhatsApp number in international form", () => {
    expect(contact).toMatch(/const WHATSAPP_NUMBER = "2348142797233"/);
    expect(contact).toMatch(/const WHATSAPP_DISPLAY = "\+234 814 279 7233"/);
    expect(contact).toMatch(/WhatsApp \{WHATSAPP_DISPLAY\}/);
  });

  it("is a real tap, not a number to copy by hand", () => {
    expect(contact).toMatch(/https:\/\/wa\.me\/\$\{WHATSAPP_NUMBER\}/);
    expect(contact).toMatch(/rel="noopener noreferrer"/);
  });

  it("prefills what the student is trying to do", () => {
    expect(contact).toMatch(/defaultMessage\(context\)/);
    expect(contact).toMatch(/My email is/);
  });

  it("offers the two things an administrator can actually do", () => {
    const flat = contact.replace(/\s+/g, " ");
    expect(flat).toMatch(/correct a wrong email address/);
    expect(flat).toMatch(/reset your access/);
  });

  it("appears on both password screens", () => {
    expect(forgot).toMatch(/<ContactAdmin context="resetting my password"/);
    expect(reset).toMatch(/<ContactAdmin context="my reset link has expired"/);
  });
});

describe("students can hand in a screenshot, and the limit holds server side", () => {
  it("accepts image uploads in the browser", () => {
    for (const extension of [".png", ".jpg", ".jpeg", ".webp", ".heic"]) {
      expect(files).toContain(`"${extension}"`);
    }
  });

  it("keeps images under 5 MB in the browser", () => {
    const png = files.slice(files.indexOf('".png"'));
    expect(png).toMatch(/maxBytes: 5 \* 1024 \* 1024/);
  });

  it("enforces 5 MB on the server, not just the browser", () => {
    // A browser check is a suggestion. Only this one holds.
    expect(register).toMatch(/Images must be 5 MB or smaller/);
    expect(register).toMatch(/and p_file_size_bytes > 5242880 then/);
  });

  it("keeps every check the original had", () => {
    // Dropped during a rewrite, and each one was load bearing.
    expect(register).toMatch(/This assignment is not open/);
    expect(register).toMatch(/must be in your own folder/);
    expect(register).toMatch(/file size was not recorded/);
    expect(register).toMatch(/academy_submission_events/);
    expect(register).toMatch(/p_file_path text default null/);
  });

  it("still takes the file path the client sends", () => {
    const client = readFileSync("src/lib/academy.js", "utf8");
    expect(client).toMatch(/p_file_path: filePath/);
    expect(register).toMatch(/p_file_path/);
  });
});
