import { describe, expect, it } from "vitest";
import {
  ACADEMY_PASSWORD_MIN_LENGTH,
  getAcademyPasswordErrorMessage,
  getAcademyPasswordProblems,
  isAcademyPasswordStrong,
} from "../lib/password";

// These have to agree with the Supabase Auth config documented in the README.
// That setting cannot be read from SQL, so this test is the guard: if someone
// weakens the rule here without weakening it there, the two drift apart.
describe("academy password policy", () => {
  it("requires the documented minimum length", () => {
    expect(ACADEMY_PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("rejects passwords that miss any requirement", () => {
    expect(isAcademyPasswordStrong("Abcdef1!")).toBe(true);

    expect(getAcademyPasswordProblems("Ab1!efg")).toContain(
      "At least 8 characters",
    );
    expect(getAcademyPasswordProblems("abcdefg1!")).toContain("An uppercase letter");
    expect(getAcademyPasswordProblems("ABCDEFG1!")).toContain("A lowercase letter");
    expect(getAcademyPasswordProblems("Abcdefgh!")).toContain("A number");
    expect(getAcademyPasswordProblems("Abcdefg123")).toContain(
      "A symbol, for example ! @ # $",
    );
  });

  it("names every unmet requirement so the message is actionable", () => {
    const problems = getAcademyPasswordProblems("abc");
    expect(problems).toEqual(
      expect.arrayContaining([
        "At least 8 characters",
        "An uppercase letter",
        "A number",
        "A symbol, for example ! @ # $",
      ]),
    );
  });

  it("treats a space as a symbol but still rejects padded passwords", () => {
    // The server accepts any non-alphanumeric, including a space, so the client
    // must not invent a stricter rule or students hit a wall the server has not
    // raised yet.
    expect(isAcademyPasswordStrong("Abcdefg1 ")).toBe(true);
  });
});

describe("academy password error messages", () => {
  it("translates the server length message", () => {
    expect(
      getAcademyPasswordErrorMessage({
        message: "Password should be at least 8 characters.",
      }),
    ).toBe("Use at least 8 characters.");
  });

  it("translates the server character-class message", () => {
    const message =
      "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789, !@#$%^&*()";
    expect(getAcademyPasswordErrorMessage({ message })).toBe(
      "Use a mix of lowercase and uppercase letters, a number, and a symbol.",
    );
  });

  it("handles the weak_password error code, which carries no usable text", () => {
    expect(
      getAcademyPasswordErrorMessage({ code: "weak_password", message: "" }),
    ).toMatch(/mix uppercase/i);
  });

  it("returns an actionable message when the server sends nothing useful", () => {
    expect(getAcademyPasswordErrorMessage({})).toMatch(/could not save/i);
  });

  it("passes through an unrelated error untouched", () => {
    expect(
      getAcademyPasswordErrorMessage({ message: "Email not confirmed" }),
    ).toBe("Email not confirmed");
  });
});