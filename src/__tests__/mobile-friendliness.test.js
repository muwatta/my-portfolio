import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const sourceFiles = walk("src").filter(
  (file) => file.endsWith(".jsx") && !file.includes("__tests__"),
);
const sources = new Map(
  sourceFiles.map((file) => [file, readFileSync(file, "utf8")]),
);

describe("mobile shell", () => {
  const html = readFileSync("index.html", "utf8");
  const css = readFileSync("src/index.css", "utf8");

  it("declares a device width viewport", () => {
    expect(html).toMatch(/name="viewport"[^>]*width=device-width/);
  });

  it("stops long words such as emails forcing a sideways scroll", () => {
    expect(css).toMatch(/overflow-x:\s*hidden/);
    expect(css).toMatch(/overflow-wrap:\s*break-word/);
  });

  it("does not shrink below the narrowest common phone", () => {
    expect(css).toMatch(/min-width:\s*320px/);
  });

  it("honours the home indicator on fixed bars", () => {
    const layout = sources.get("src/components/academy/AcademyLayout.jsx");
    expect(layout).toMatch(/env\(safe-area-inset-bottom\)/);
  });
});

describe("legibility on a phone", () => {
  it("uses no text below 11px anywhere", () => {
    const offenders = [...sources.entries()]
      .filter(([, code]) => /text-\[(8|9|10)px\]/.test(code))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});

describe("tap targets", () => {
  // Classes that guarantee a comfortable touch height, whether written inline or
  // supplied by a component class in index.css.
  const TALL = ["min-h-11", "min-h-12", "h-11", "h-12", "py-2", "py-3"];
  const SHORT = /(^|\s)(py-1|py-0\.5|h-6|h-7|h-8|w-6|w-7|w-8)(\s|$)/;

  it("gives every button and link a 44px or larger touch target", () => {
    const offenders = [];
    sources.forEach((code, file) => {
      for (const match of code.matchAll(
        /<(button|a|Link|NavLink)\b.*?(\/?>)/gs,
      )) {
        const className = match[0].match(/className="([^"]*)"/)?.[1];
        if (!className) continue;
        const classList = className.split(/\s+/);
        if (classList.includes("sr-only")) continue;
        const short = SHORT.test(className);
        const tall = TALL.some((utility) => classList.includes(utility));
        // button-primary, button-secondary and button-ghost all carry min-h-11.
        const tallViaComponent = classList.some((name) =>
          name.startsWith("button-"),
        );
        if (short && !tall && !tallViaComponent) {
          const line = code.slice(0, match.index).split("\n").length;
          offenders.push(`${file}:${line} ${className.slice(0, 60)}`);
        }
      }
    });
    expect(offenders).toEqual([]);
  });
});

describe("form accessibility on a phone", () => {
  const STUDENT_FORMS = [
    "src/pages/AcademyLogin.jsx",
    "src/pages/AcademySignup.jsx",
    "src/pages/AcademyForgotPassword.jsx",
    "src/pages/AcademyResetPassword.jsx",
  ];

  it("gives every student form field an accessible name", () => {
    const offenders = [];
    STUDENT_FORMS.forEach((file) => {
      const code = sources.get(file);
      for (const match of code.matchAll(/<input\b.*?\/>/gs)) {
        const tag = match[0];
        const before = code.slice(Math.max(0, match.index - 400), match.index);
        const wrapped =
          before.lastIndexOf("<label") > before.lastIndexOf("</label>");
        if (!wrapped && !tag.includes("aria-label") && !tag.includes("id=")) {
          offenders.push(`${file}: ${tag.replace(/\s+/g, " ").slice(0, 70)}`);
        }
      }
    });
    expect(offenders).toEqual([]);
  });

  it("keeps the account fields out of the browser's autofill heuristics", () => {
    const login = sources.get("src/pages/AcademyLogin.jsx");
    expect(login).toMatch(/autoComplete="email"/);
    expect(login).toMatch(/autoComplete="current-password"/);

    const signup = sources.get("src/pages/AcademySignup.jsx");
    expect(signup).toMatch(/autoComplete="name"/);
    expect(signup).toMatch(/autoComplete="new-password"/);
  });
});

describe("inline panels are not announced as modals", () => {
  it("does not mark a non modal panel aria-modal", () => {
    const offenders = [...sources.entries()]
      .filter(([, code]) => /aria-modal="true"/.test(code))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
