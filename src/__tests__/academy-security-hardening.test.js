import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  readTextBodyLimited,
  RequestBodyTooLargeError,
} from "../../supabase/functions/_shared/http.ts";

const headers = JSON.parse(readFileSync("vercel.json", "utf8")).headers;
const headerValues = Object.fromEntries(
  headers
    .flatMap((entry) => entry.headers)
    .map(({ key, value }) => [key.toLowerCase(), value]),
);
const signup = readFileSync("src/pages/AcademySignup.jsx", "utf8");
const login = readFileSync("src/pages/AcademyLogin.jsx", "utf8");
const forgotPassword = readFileSync(
  "src/pages/AcademyForgotPassword.jsx",
  "utf8",
);
const auth = readFileSync("src/context/AcademyAuthContext.jsx", "utf8");
const main = readFileSync("src/main.jsx", "utf8");
const authConfig = readFileSync("supabase/config.toml", "utf8");

describe("Academy response security headers", () => {
  it("sets clickjacking, MIME sniffing, transport and referrer protections globally", () => {
    expect(headerValues["x-frame-options"]).toBe("DENY");
    expect(headerValues["x-content-type-options"]).toBe("nosniff");
    expect(headerValues["strict-transport-security"]).toContain("max-age=");
    expect(headerValues["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("blocks object embedding and framing in the content security policy", () => {
    expect(headerValues["content-security-policy"]).toContain(
      "object-src 'none'",
    );
    expect(headerValues["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
  });
});

describe("Academy authentication bot protection", () => {
  it("uses Turnstile on sign-in, signup, resend and password reset", () => {
    for (const page of [signup, login, forgotPassword]) {
      expect(page).toContain("TurnstileChallenge");
      expect(page).toContain("isTurnstileRequired");
      expect(page).toContain("captchaToken");
    }
    expect(auth).toContain("captchaToken");
    expect(authConfig).toContain(
      'password_requirements = "lower_upper_letters_digits_symbols"',
    );
    expect(authConfig).toContain("secure_password_change = true");
  });

  it("fails closed on production builds without a configured site key", () => {
    const challenge = readFileSync(
      "src/lib/turnstile.js",
      "utf8",
    );
    expect(challenge).toContain(
      "import.meta.env.PROD || Boolean(TURNSTILE_SITE_KEY)",
    );
    const widget = readFileSync(
      "src/components/academy/TurnstileChallenge.jsx",
      "utf8",
    );
    expect(widget).toContain('import.meta.env.PROD ? "missing-key" : "disabled"');
  });
});

describe("Edge Function input size limits", () => {
  it("accepts bounded text and rejects oversized streamed request bodies", async () => {
    const request = new Request("https://academy.example.test/action", {
      method: "POST",
      body: "small",
    });
    await expect(readTextBodyLimited(request, 8)).resolves.toBe("small");

    const oversized = new Request("https://academy.example.test/action", {
      method: "POST",
      body: "too large",
    });
    await expect(readTextBodyLimited(oversized, 4)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError,
    );
  });

  it("caps and validates privileged account and grading function requests", () => {
    for (const file of [
      "supabase/functions/academy-admin-manage-user/index.ts",
      "supabase/functions/academy-grade-submission/index.ts",
      "supabase/functions/academy-ai-grade-submission/index.ts",
      "supabase/functions/academy-ai-feedback/index.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("readTextBodyLimited");
      expect(source).toContain("RequestBodyTooLargeError");
    }
    expect(
      readFileSync(
        "supabase/functions/academy-admin-manage-user/index.ts",
        "utf8",
      ),
    ).toContain("A valid target_user_id is required.");
  });
});

describe("untrusted DOM content", () => {
  it("builds the service-worker update prompt without an HTML injection sink", () => {
    expect(main).not.toMatch(/message\.innerHTML\s*=/);
    expect(main).toContain("label.textContent =");
  });
});
