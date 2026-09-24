import { describe, expect, it } from "vitest";
import {
  getAcademySignupErrorMessage,
  isValidAcademyRegistrationNumber,
  normalizeAcademyRegistrationNumber,
} from "../lib/registration";

describe("Academy registration numbers", () => {
  it.each(["ATE-26-001", "ATE-26-999", " ate-27-042 "])(
    "accepts %s after normalization",
    (value) => {
      expect(isValidAcademyRegistrationNumber(value)).toBe(true);
    },
  );

  it.each([
    "ATE-26-1",
    "ATE26001",
    "ATE-2026-001",
    "ATE-26-ABC",
    "ATE-26-000",
    "ATE-26-001-XYZ",
  ])("rejects %s", (value) => {
    expect(isValidAcademyRegistrationNumber(value)).toBe(false);
  });

  it("stores one canonical representation", () => {
    expect(normalizeAcademyRegistrationNumber("  ate-26-014 ")).toBe(
      "ATE-26-014",
    );
  });

  it("returns a safe rate-limit message without exposing Supabase details", () => {
    expect(
      getAcademySignupErrorMessage({
        code: "over_request_rate_limit",
        message: "You have sent too many requests recently",
      }),
    ).toBe(
      "Too many signup attempts were made recently. Please wait a few minutes before trying again.",
    );
  });

  it("returns a safe existing-account message", () => {
    expect(
      getAcademySignupErrorMessage({
        code: "auth/email-already-in-use",
        message: "raw Supabase detail",
      }),
    ).toContain("may already exist");
  });
});
