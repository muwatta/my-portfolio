import { readFileSync } from "node:fs";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chain = readFileSync(
  "supabase/migrations/20261305000000_lesson_prerequisite_chain.sql",
  "utf8",
);
const publishedChain = readFileSync(
  "supabase/migrations/20261343000000_published_lesson_prerequisite_chain.sql",
  "utf8",
);
const publishPython = readFileSync(
  "supabase/migrations/20261344000000_python_publish_course_content.sql",
  "utf8",
);

const authState = vi.hoisted(() => ({
  current: { user: { id: "student-1" } },
}));
const api = vi.hoisted(() => ({
  getAcademyLessons: vi.fn(),
  getAcademyLesson: vi.fn(),
  markLessonStarted: vi.fn(),
  markLessonComplete: vi.fn(),
  isAcademyLessonUnlocked: vi.fn(),
}));
const queue = vi.hoisted(() => ({ operations: [] }));

vi.mock("../hooks/useAcademyAuth", () => ({
  useAcademyAuth: () => authState.current,
}));

vi.mock("../lib/academy", () => api);

vi.mock("../lib/academyOffline", () => ({
  fetchWithOfflineFallback: ({ fetcher }) =>
    fetcher().then((result) => ({ ...result, offline: false })),
}));

vi.mock("../lib/academySync", () => ({
  enqueueAcademyOperation: vi.fn(async (userId, operation) => {
    queue.operations.push(operation);
  }),
}));

import AcademyLessons from "../pages/AcademyLessons";
import AcademyLesson from "../pages/AcademyLesson";

const COURSE = { id: "course-1", title: "C++ for Robotics" };
const WEEK = { id: "week-1", week_number: 1, title: "Thinking Like a Programmer" };

// getAcademyLessons returns a flat array and the page groups it by week, so the
// fixture is flat too.
const LESSONS = [
  {
    id: "l1",
    lesson_number: 1,
    title: "Thinking Like a Programmer",
    objectives: ["Plan a solution"],
    status: "completed",
    academy_weeks: WEEK,
  },
  {
    id: "l2",
    lesson_number: 2,
    title: "C++ Fundamentals",
    objectives: ["Declare variables"],
    status: "available",
    academy_weeks: WEEK,
  },
  {
    id: "l3",
    lesson_number: 3,
    title: "Your First Program",
    objectives: ["Print something"],
    status: "locked",
    academy_weeks: WEEK,
  },
];

describe("the prerequisite chain in the database", () => {
  it("populates the column the gating function already read", () => {
    // Nothing in this project had ever set prerequisite_lesson_id, so the chain
    // evaluated to "no prerequisite" and every lesson unlocked at once. The
    // gating existed; it had nothing to gate.
    expect(chain).toMatch(/set prerequisite_lesson_id = o\.previous_id/);
    expect(chain).toMatch(/lag\(l\.id\) over/);
  });

  it("chains in week then lesson order within one course", () => {
    expect(chain).toMatch(/order by w\.week_number, l\.lesson_number, l\.id/);
    expect(chain).toMatch(/where w\.course_id = p_course_id/);
  });

  it("leaves the first lesson of a course unchained", () => {
    // lag() returns null for the first row, which is exactly the lesson that
    // should have nothing before it.
    expect(chain).toMatch(/prerequisite_lesson_id is distinct from o\.previous_id/);
  });

  it("applies to every course rather than a hardcoded list", () => {
    expect(chain).toMatch(
      /for course_row in select id from public\.academy_courses loop/,
    );
  });

  it("stops the unlock function being callable by anyone", () => {
    expect(chain).toMatch(
      /revoke execute on function public\.academy_lesson_is_unlocked_for_student\(uuid, uuid\) from public, anon/,
    );
  });

  it("does not let hidden lessons block the next published lesson", () => {
    expect(publishedChain).toMatch(/lesson\.published\s+and lesson\.status = 'published'/);
    expect(publishedChain).toMatch(/lag\(lesson\.id\) over/);
  });

  it("rebuilds prerequisites when lesson visibility or ordering changes", () => {
    expect(publishedChain).toMatch(
      /after insert or delete or update of\s+week_id, lesson_number, sort_order, published, status/,
    );
    expect(publishedChain).toMatch(/academy_rechain_course_lessons\(new_course_id\)/);
    expect(publishedChain).toMatch(
      /after insert or delete or update of course_id, week_number\s+on public\.academy_weeks/,
    );
    expect(publishedChain).toMatch(/select public\.academy_rechain_course_lessons\(course\.id\)/);
  });

  it("publishes Python lessons and their linked learning activities", () => {
    expect(publishPython.match(/slug = 'python-for-ai-machine-learning'/g)).toHaveLength(4);
    expect(publishPython.match(/set status = 'published'/g)).toHaveLength(4);
    expect(publishPython).toMatch(/update public\.academy_lessons/);
    expect(publishPython).toMatch(/update public\.academy_exercises/);
    expect(publishPython).toMatch(/update public\.academy_assignments/);
    expect(publishPython).toMatch(/update public\.academy_lesson_activities/);
    expect(publishPython).toMatch(/status <> 'archived'/);
    expect(publishPython).toMatch(/release_at = now\(\)/);
  });
});

describe("a locked lesson is not a link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queue.operations = [];
    authState.current = { user: { id: "student-1" } };
    api.getAcademyLessons.mockResolvedValue({
      data: LESSONS,
      error: null,
      configured: true,
    });
  });

  function renderList() {
    return render(
      <MemoryRouter>
        <AcademyLessons />
      </MemoryRouter>,
    );
  }

  it("links the lessons that are open", async () => {
    renderList();
    const link = await screen.findByRole("link", { name: /C\+\+ Fundamentals/ });
    expect(link).toHaveAttribute("href", "/academy/lessons/l2");
  });

  it("does not link the locked one", async () => {
    renderList();
    await screen.findByText("Your First Program");
    // A link that refuses to go anywhere reads as missing content rather than
    // as something still to be earned.
    expect(screen.queryByRole("link", { name: /Your First Program/ })).toBeNull();
  });

  it("says the locked lesson is locked, and why", async () => {
    renderList();
    await screen.findByText("Your First Program");
    const card = screen.getByText("Your First Program").closest("[aria-disabled]");
    expect(card).not.toBeNull();
    expect(card.getAttribute("aria-disabled")).toBe("true");
    expect(card.getAttribute("title")).toMatch(/finish the previous lesson/i);
  });

  it("still shows its title, so the student can see what is ahead", async () => {
    renderList();
    expect(await screen.findByText("Your First Program")).toBeInTheDocument();
  });
});

describe("a locked lesson will not open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.current = { user: { id: "student-1" } };
    api.getAcademyLesson.mockResolvedValue({
      data: { id: "l3", title: "Your First Program", progress: {} },
      error: null,
      configured: true,
    });
    api.isAcademyLessonUnlocked.mockResolvedValue({ data: true, error: null });
    api.markLessonStarted.mockResolvedValue({ error: null });
  });

  function renderLesson(lessonId) {
    return render(
      <MemoryRouter initialEntries={[`/academy/lessons/${lessonId}`]}>
        <Routes>
          <Route path="/academy/lessons/:id" element={<AcademyLesson />} />
          <Route path="/academy/lessons" element={<p>Lessons list</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("asks the server before rendering, rather than after", async () => {
    // It used to mark the lesson started first and swallow the refusal, which
    // meant a locked lesson still displayed its content.
    renderLesson("l2");
    await waitFor(() =>
      expect(api.isAcademyLessonUnlocked).toHaveBeenCalledWith("l2", "student-1"),
    );
    expect(api.markLessonStarted).toHaveBeenCalledWith("l2", "student-1");
  });

  it("shows a locked screen and never loads the content", async () => {
    api.isAcademyLessonUnlocked.mockResolvedValue({ data: false, error: null });
    renderLesson("l3");
    expect(
      await screen.findByText(/this lesson is not unlocked yet/i),
    ).toBeInTheDocument();
    expect(api.getAcademyLesson).not.toHaveBeenCalled();
    expect(api.markLessonStarted).not.toHaveBeenCalled();
  });

  it("explains the way out and links back to the lessons", async () => {
    api.isAcademyLessonUnlocked.mockResolvedValue({ data: false, error: null });
    renderLesson("l3");
    const back = await screen.findByRole("link", { name: /back to your lessons/i });
    expect(back).toHaveAttribute("href", "/academy/lessons");
  });

  it("stays open when the check itself fails, rather than locking everyone out", async () => {
    // Failing closed here would strand a student on a network blip and would be
    // a lie about their progress. The server still refuses a locked lesson when
    // it is actually started, so the worst case is a page whose actions fail.
    api.isAcademyLessonUnlocked.mockResolvedValue({
      data: null,
      error: { message: "network" },
    });
    renderLesson("l2");
    await waitFor(() => expect(api.getAcademyLesson).toHaveBeenCalled());
    expect(screen.queryByText(/not unlocked yet/i)).toBeNull();
  });
});

describe("a teacher's reorder drives the unlock order", () => {
  const reorder = readFileSync(
    "supabase/migrations/20261321000000_lesson_reorder_chain.sql",
    "utf8",
  );
  const followOrder = readFileSync(
    "supabase/migrations/20261322000000_rechain_follows_sort_order.sql",
    "utf8",
  );

  it("initialises the position counter", () => {
    // It declared `position integer;` and did `position + 1`. In plpgsql an
    // uninitialised integer is NULL and NULL + 1 is NULL, so the first lesson in
    // every reorder was written with sort_order = NULL. Nothing stopped it until
    // the sort_order > 0 check, which then made reordering fail outright.
    expect(reorder).toMatch(/position integer := 0;/);
    expect(reorder).toMatch(/position := position \+ 1;/);
  });

  it("rebuilds the chain inside the reorder, so the two cannot drift", () => {
    expect(reorder).toMatch(
      /perform public\.academy_rechain_course_lessons\(course_id\)/,
    );
  });

  it("the chain follows the displayed order, not the lesson number", () => {
    // Verified live: swapping lessons 3 and 4 put lesson 4 on screen before
    // lesson 3 while lesson 4 still required lesson 3, so a student was told to
    // finish something further down the page.
    expect(followOrder).toMatch(
      /order by w\.week_number, l\.sort_order, l\.lesson_number, l\.id/,
    );
  });

  it("keeps a total order, so the same input always gives the same chain", () => {
    expect(followOrder).toMatch(/l\.lesson_number, l\.id/);
  });
});
