import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/AcademyAdminExamBuilder.jsx", "utf8");
const lib = readFileSync("src/lib/academy.js", "utf8");
const accessRepair = readFileSync(
  "supabase/migrations/20261350000000_assessment_staff_read_grants.sql",
  "utf8",
);
const sql = readFileSync(
  "supabase/migrations/20261292000000_exam_builder.sql",
  "utf8",
);
const aliasFix = readFileSync(
  "supabase/migrations/20261294000000_exam_builder_alias_fix.sql",
  "utf8",
);
const preview = readFileSync(
  "supabase/migrations/20261296000000_exam_builder_preview.sql",
  "utf8",
);
const probe = readFileSync(
  "supabase/migrations/20261295000000_builder_probe.sql",
  "utf8",
);
const publishedRead = readFileSync(
  "supabase/migrations/20261298000000_exam_student_published_read.sql",
  "utf8",
);
const scheduling = readFileSync(
  "supabase/migrations/20261339000000_exam_scheduling_and_result_release.sql",
  "utf8",
);
const studentDashboard = readFileSync("src/pages/AcademyDashboard.jsx", "utf8");
const studentRunner = readFileSync(
  "src/components/academy/AcademyExamRunner.jsx",
  "utf8",
);
const studentNav = readFileSync(
  "src/components/academy/StudentSectionNav.jsx",
  "utf8",
);

describe("options are re-lettered so a student's answer letter is always right", () => {
  // This is the specific risk: a question authored with keys 1/2/3/4 and an
  // answer of "3" must arrive as A/B/C/D with the answer on C. Carrying the old
  // key across would mark every student wrong.
  it("rebuilds the options as A, B, C, D whatever they were written as", () => {
    expect(sql).toMatch(/clean_keys := array_append\(clean_keys, chr\(64 \+ i\)/);
  });

  it("finds the right option before the letters are rewritten", () => {
    expect(sql).toMatch(
      /select j into answer_index[\s\S]*?where upper\(coalesce\(keys\[j\], ''\)\) = upper\(coalesce\(question_row\.correct_key, ''\)\)/,
    );
    expect(sql).toMatch(/correct_key := clean_keys\[answer_index\]/);
  });

  it("turns a true/false question into A True, B False, in that order", () => {
    expect(sql).toMatch(
      /out_options := '\[\{"key":"A","label":"True"\},\{"key":"B","label":"False"\}\]'/,
    );
  });

  it("accepts a true/false answer written as the word False", () => {
    expect(sql).toMatch(
      /when lower\(coalesce\(question_row\.correct_key, ''\)\) in \('b', 'false', 'no'\) then 'B'/,
    );
  });

  it("refuses a question whose answer matches none of its options", () => {
    expect(sql).toMatch(/no answer key that matches one of its options/);
  });

  it("refuses an MCQ with fewer than two filled in options", () => {
    expect(sql).toMatch(/needs at least two filled in options/);
  });

  it("was verified, not assumed", () => {
    // keysABCD/ansC: written as 1/2/3/4 with answer 3, stored as A/B/C/D on C.
    expect(probe).toMatch(/add_mcq=keysABCD\/ansC/);
    expect(probe).toMatch(/add_tf=ansB/);
  });
});

describe("an exam can be built by hand or automatically", () => {
  it("offers both, and the automatic one takes a mix", () => {
    expect(page).toMatch(/addAcademyExamQuestion/);
    expect(page).toMatch(/fillAcademyExamFromMix/);
    expect(page).toMatch(/Build it automatically/);
  });

  describe("assessment data failures are recoverable", () => {
    it("shows a retry action instead of treating a failed exam query as empty", () => {
      expect(page).toMatch(/title="Examinations could not be loaded"/);
      expect(page).toMatch(/onRetry={loadExams}/);
      expect(page).toMatch(/examLoadError/);
    });

    it("keeps the question list and publishing disabled until exam contents load", () => {
      expect(page).toMatch(/title="Questions for this examination could not be loaded"/);
      expect(page).toMatch(/onRetry=\{\(\) => loadExamContents\(selectedId\)\}/);
      expect(page).toMatch(/contentsLoading \|\| Boolean\(contentsLoadError\)/);
    });

    it("restores staff-only RLS-backed table access for assessment reads", () => {
      expect(accessRepair).toMatch(
        /grant select, insert, update, delete\s+on public\.academy_exam_questions to authenticated/,
      );
      expect(accessRepair).toMatch(
        /grant select on public\.academy_exams to authenticated/,
      );
    });
  });

  it("asks for a difficulty and type mix, not a single number", () => {
    expect(lib).toMatch(/difficulty_counts: mix\.difficulties/);
    expect(lib).toMatch(/type_counts: mix\.types/);
  });

  it("provides an easy CSV upload path from the builder and back", () => {
    const questionBank = readFileSync(
      "src/pages/AcademyAdminQuestionBank.jsx",
      "utf8",
    );
    expect(page).toMatch(/Upload a test CSV in the question bank/);
    expect(page).toMatch(/automatically select up to 50 questions/);
    expect(questionBank).toMatch(/accept="\.csv,text\/csv"/);
    expect(questionBank).toMatch(/Download CSV template/);
    expect(questionBank).toMatch(/Back to exam builder/);
  });

  it("reports a pool it could not fill rather than filling it from elsewhere", () => {
    expect(sql).toMatch(/shortfall/);
    expect(page).toMatch(/the bank could not fill/);
    // Proven live: asking for five hard questions with none in the bank.
    expect(probe).toMatch(/shortfall=true/);
  });

  it("will not add the same question twice", () => {
    expect(sql).toMatch(/Already in this examination/);
  });
});

describe("an exam is a draft until it is published", () => {
  it("cannot be changed once it is out", () => {
    expect(sql).toMatch(
      /Questions can only be changed while the examination is a draft/,
    );
  });

  it("validates before publishing and says what is wrong", () => {
    expect(sql).toMatch(/academy_exam_validate\(p_exam_id\)/);
    expect(sql).toMatch(/This examination is not ready to publish/);
    expect(page).toMatch(/Validate and publish/);
    expect(page).toMatch(/Everything checks out/);
  });

  it("marks it active or scheduled from the start time", () => {
    expect(sql).toMatch(
      /set status = case when starts_at <= now\(\) then 'active' else 'scheduled' end/,
    );
  });
});

describe("duration is per exam, never a global default", () => {
  it("is stored on the exam", () => {
    expect(sql).toMatch(/p_duration_minutes integer default null/);
    expect(lib).toMatch(
      /\/\/ Per exam, because a Python paper and a Robotics paper are not the same\n\s*\/\/ length\. Never a global default\./,
    );
  });

  it("is required and bounded", () => {
    expect(sql).toMatch(/chosen_duration < 1 or chosen_duration > 600/);
  });
});

describe("a teacher can read the key, a student cannot", () => {
  it("has a staff only preview for the builder", () => {
    expect(preview).toMatch(
      /Only teachers can see the questions in an examination/,
    );
    expect(preview).toMatch(/grant execute on function public\.academy_exam_paper_preview\(uuid\) to authenticated/);
  });

  it("still keeps the link table closed to a plain select", () => {
    // The preview goes through a function precisely because the table holds the
    // snapshot with the key in it.
    const rls = readFileSync(
      "supabase/migrations/20261255000000_assessment_rls.sql",
      "utf8",
    );
    expect(rls).toMatch(/revoke select on public\.academy_exam_question_links/);
  });
});

describe("the builder is reachable", () => {
  it("is routed and in the admin navigation", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    const nav = readFileSync(
      "src/components/academy/AdminContentNav.jsx",
      "utf8",
    );
    expect(app).toMatch(
      /<Route\s+path="\/academy\/admin\/exams"\s+element=\{<AcademyAdminExamBuilder \/>\}/,
    );
    expect(app).toMatch(
      /<Route\s+path="\/academy\/admin\/exam-results"\s+element=\{<AcademyAdminExamResults \/>\}/,
    );
    expect(app).toMatch(
      /<Route\s+path="\/academy\/admin\/question-bank"\s+element=\{<AcademyAdminQuestionBank \/>\}/,
    );
    expect(app).not.toMatch(
      /<AcademyAdminGuard>\s*<AcademyAdminExamBuilder \/>/,
    );
    expect(nav).toMatch(/Exam builder/);
  });
});

describe("the alias collision is recorded, not just fixed", () => {
  it("explains that a subquery alias cannot shadow a plpgsql variable", () => {
    expect(aliasFix).toMatch(/aliased n rather than i because i is a variable/);
  });
});

describe("a draft paper is not readable by a student", () => {
  // Starting a draft was already refused by the attempt function, but a class
  // member could still read the exam row itself and see the title, duration and
  // instructions in their list. Both the row policy and the client query now
  // require a status a student is allowed to see.
  it("keeps drafts and archived papers out of the student row policy", () => {
    expect(publishedRead).toMatch(
      /status in \(\s*'scheduled', 'active', 'closed', 'graded', 'results_published'\s*\)/,
    );
    expect(publishedRead).not.toMatch(/'draft'/);
    expect(publishedRead).not.toMatch(/'archived'/);
  });

  it("still lets a teacher see every status", () => {
    expect(publishedRead).toMatch(/public\.academy_is_teacher\(\)/);
  });

  it("repeats the filter on the client query", () => {
    expect(lib).toMatch(
      /\.in\("status", \[\s*"scheduled",\s*"active",\s*"closed",\s*"graded",\s*"results_published"/,
    );
  });
});

describe("tests are scheduled and delivered to the assigned class", () => {
  it("requires a class and a valid availability window when creating a test", () => {
    expect(page).toMatch(/Student class/);
    expect(page).toMatch(/Choose the class that will take this test/);
    expect(page).toMatch(/Closes at/);
    expect(scheduling).toMatch(/Choose the class that will take this examination/);
    expect(scheduling).toMatch(/Set a valid start and close time/);
  });

  it("shows published scheduled or active tests on the student dashboard", () => {
    expect(studentDashboard).toContain("getAcademyAvailableExams");
    expect(studentDashboard).toMatch(/scheduledExams\.map/);
    expect(studentDashboard).toMatch(/\/academy\/exams\?exam=/);
    expect(studentNav).toMatch(/\{ label: "Tests", to: "\/academy\/exams"/);
  });

  it("supports immediate or staff-controlled score release", () => {
    expect(page).toMatch(/Release each score immediately after submission/);
    expect(page).toMatch(/Hold scores until staff release them/);
    expect(scheduling).toMatch(/results_release_mode = 'immediate'/);
    expect(scheduling).toMatch(/academy_exam_sync_leaderboard\(new\.exam_id\)/);
    expect(page).toMatch(/getAcademyTeacherClasses/);
  });

  it("discourages copying during the test without exposing answer keys", () => {
    expect(studentRunner).toMatch(/onCopy=\{blockCopy\}/);
    expect(studentRunner).toMatch(/onContextMenu=\{blockCopy\}/);
    expect(studentRunner).toMatch(/className="select-none space-y-4 print:hidden"/);
    expect(studentRunner).toMatch(/visibilitychange/);
  });
});
