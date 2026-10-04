import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILE_RULES, validateAcademyFile } from "../lib/academyFiles";

const assignment = readFileSync("src/pages/AcademyAssignment.jsx", "utf8");
const cppEditor = readFileSync("src/components/academy/CppEditor.jsx", "utf8");
const pythonEditor = readFileSync(
  "src/components/academy/PythonEditor.jsx",
  "utf8",
);
const gradeFunction = readFileSync(
  "supabase/functions/academy-grade-submission/index.ts",
  "utf8",
);
const academyLib = readFileSync("src/lib/academy.js", "utf8");

describe("a C++ assignment offers the C++ editor", () => {
  it("chooses the editor from the course language, not from the starter code", () => {
    // Sniffing the source would give a lesson with no starter snippet the wrong
    // editor, and a C++ lesson whose snippet happens to be blank would silently
    // become a Python submission.
    expect(assignment).toMatch(
      /assignment\?\.academy_courses\?\.language === "cpp"/,
    );
    expect(assignment).toContain("<CppEditor");
    expect(assignment).toContain("<PythonEditor");
  });

  it("fetches the course language with the assignment", () => {
    expect(academyLib).toMatch(
      /getAcademyAssignment[\s\S]*?academy_courses!inner\(id, slug, title, language\)/,
    );
  });

  it("keeps the submit button gated on the prop so the lesson terminal gains none", () => {
    expect(cppEditor).toMatch(/\{onSubmit && \(/);
    expect(cppEditor).toContain("Submit code");
    expect(pythonEditor).toMatch(/\{onSubmit && \(/);
  });

  it("loads an uploaded C++ file into the editor instead of discarding it", () => {
    expect(assignment).toMatch(/\.\(py\|cpp\|cc\|cxx\|h\|hpp\)\$|py\|cpp\|cc\|cxx\|h\|hpp/);
  });

  it("offers C++ uploads only on a C++ assignment", () => {
    expect(assignment).toMatch(/language === "cpp"[\s\S]*?\.cpp/);
  });
});

describe("C++ files are accepted by the shared validator", () => {
  for (const extension of [".cpp", ".cc", ".cxx", ".h", ".hpp"]) {
    it(`accepts ${extension} within the 5 MB limit`, () => {
      expect(FILE_RULES[extension]).toBeDefined();
      const result = validateAcademyFile({
        name: `answer${extension}`,
        size: 4 * 1024,
        type: "text/plain",
      });

      it("caps all supported file types at 5 MB", () => {
        for (const rule of Object.values(FILE_RULES)) {
          expect(rule.maxBytes).toBe(5 * 1024 * 1024);
        }
      });
      expect(result.valid).toBe(true);
    });
  }

  it("rejects a C++ file larger than 5 MB", () => {
    const result = validateAcademyFile({
      name: "answer.cpp",
      size: 5 * 1024 * 1024 + 1,
      type: "text/plain",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/5 MB or smaller/i);
  });

  it("still rejects an unsupported extension", () => {
    const result = validateAcademyFile({
      name: "answer.exe",
      size: 10,
      type: "application/octet-stream",
    });
    expect(result.valid).toBe(false);
  });
});

describe("grading does not apply Python rules to C++", () => {
  it("skips the Python pre-filter for a known non-Python course", () => {
    // Embedded C++ legitimately calls open(), exec() and compile(). The old
    // filter rejected those with "restricted Python feature", so a valid
    // embedded answer could never be graded.
    expect(gradeFunction).toMatch(
      /language !== "cpp" && language !== "shell"/,
    );
    expect(gradeFunction).toMatch(/academy_courses\(language\)/);
  });

  it("keeps filtering when the language cannot be determined", () => {
    // Failing closed here matters: a broken join must not quietly remove the
    // check from Python submissions.
    const guard = gradeFunction.match(
      /if \(language !== "cpp" && language !== "shell"\) \{([\s\S]*?)\n {4}\}/,
    );
    expect(guard).not.toBeNull();
    expect(guard?.[1]).toMatch(/obvious/);
    expect(guard?.[1]).toMatch(/restricted Python feature/);
  });

  it("still never executes student code in this function", () => {
    expect(gradeFunction).toContain("never executes student code");
    expect(gradeFunction).toContain("executorUrl");
  });
});