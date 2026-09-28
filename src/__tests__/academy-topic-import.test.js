import { describe, expect, it } from "vitest";
import {
  TOPIC_IMPORT_TEMPLATE,
  parseTopicRows,
} from "../lib/academyContent";

describe("bulk topic import parsing", () => {
  it("rejects empty input with a helpful message", () => {
    expect(parseTopicRows("").error).toMatch(/Paste or upload/i);
  });

  it("reads a JSON array", () => {
    const { rows, error } = parseTopicRows(
      '[{"title":"Loops","objectives":["for","while"]}]',
    );
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Loops");
    expect(rows[0].objectives).toEqual(["for", "while"]);
  });

  it("rejects JSON that is not an array", () => {
    expect(parseTopicRows('{"title":"Loops"}').error).toMatch(/must be an array/i);
  });

  it("rejects malformed JSON", () => {
    expect(parseTopicRows('[{"title":').error).toMatch(/not valid JSON/i);
  });

  it("reads CSV with a title column", () => {
    const { rows, error } = parseTopicRows(
      'title,objectives,lesson_number,points\n"Loops","for|while",1,10',
    );
    expect(error).toBeNull();
    expect(rows[0]).toMatchObject({
      title: "Loops",
      lesson_number: 1,
      points: 10,
    });
    expect(rows[0].objectives).toEqual(["for", "while"]);
  });

  it("handles quoted CSV fields containing commas", () => {
    const { rows } = parseTopicRows(
      'title,objectives\n"Loops, part one","for|while"',
    );
    expect(rows[0].title).toBe("Loops, part one");
  });

  it("handles escaped quotes inside a CSV field", () => {
    const { rows } = parseTopicRows('title\n"He said ""hi"""');
    expect(rows[0].title).toBe('He said "hi"');
  });

  it("requires a title column in CSV", () => {
    expect(parseTopicRows("name,points\nLoops,10").error).toMatch(
      /needs a title column/i,
    );
  });

  it("reads Markdown headings with bullet objectives", () => {
    const { rows, error } = parseTopicRows(
      "# Loops and iteration\n- for loops\n- while loops\n\n# Functions\n- def\n- return",
    );
    expect(error).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: "Loops and iteration",
      objectives: ["for loops", "while loops"],
    });
    expect(rows[1].title).toBe("Functions");
  });

  it("treats deeper Markdown headings as topics too", () => {
    const { rows } = parseTopicRows("### A\n### B");
    expect(rows.map((row) => row.title)).toEqual(["A", "B"]);
  });

  it("leaves a blank lesson number null so the database can assign one", () => {
    const { rows } = parseTopicRows('title,lesson_number\nLoops,');
    expect(rows[0].lesson_number).toBeNull();
  });

  it("keeps an explicit zero rather than treating it as missing", () => {
    const { rows } = parseTopicRows('title,lesson_number\nLoops,0');
    expect(rows[0].lesson_number).toBe(0);
  });

  it("keeps the late policy when supplied", () => {
    const { rows } = parseTopicRows('title,late_policy\nLoops,closed');
    expect(rows[0].late_policy).toBe("closed");
  });

  it("defaults the late policy when the column is absent", () => {
    const { rows } = parseTopicRows("title\nLoops");
    expect(rows[0].late_policy).toBe("accept_penalty");
  });

  it("always produces the same keys so the validator can rely on them", () => {
    const { rows } = parseTopicRows('title\nLoops');
    expect(Object.keys(rows[0]).sort()).toEqual([
      "content",
      "due_at",
      "late_policy",
      "lesson_number",
      "objectives",
      "points",
      "release_at",
      "slug",
      "title",
    ]);
  });

  it("ships a template the parser accepts", () => {
    const { rows, error } = parseTopicRows(TOPIC_IMPORT_TEMPLATE);
    expect(error).toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("Loops and iteration");
    expect(rows[1].late_policy).toBe("closed");
  });
});
