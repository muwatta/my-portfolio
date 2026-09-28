import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_SOURCE_LENGTH = 50_000;
const MAX_TESTS = 50;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Executor replies we treat as the student's problem, not ours. */
const EXECUTOR_VERDICTS = ["syntax_error", "runtime_error", "timeout"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const executorUrl = Deno.env.get("GRADING_EXECUTOR_URL");
  const executorKey = Deno.env.get("GRADING_EXECUTOR_KEY");
  if (!authorization || !supabaseUrl || !anonKey || !serviceKey)
    return json({ error: "Authentication or Supabase configuration is missing." }, 401);
  if (!executorUrl || !executorKey)
    return json({ status: "grading_unavailable" }, 503);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userResult } = await userClient.auth.getUser();
  if (!userResult.user) return json({ error: "Authentication required." }, 401);

  let input: { submission_id?: string };
  try {
    input = JSON.parse(await request.text());
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }
  if (typeof input.submission_id !== "string")
    return json({ error: "submission_id is required" }, 400);

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: submission, error: submissionError } = await serviceClient
    .from("academy_submissions")
    .select("id, student_id, source_code, assignment_id, academy_assignments(points, automated_tests)")
    .eq("id", input.submission_id)
    .maybeSingle();
  if (submissionError || !submission) return json({ error: "Submission not found." }, 404);

  const { data: isTeacher } = await userClient.rpc("academy_is_teacher");
  const { data: isAdmin } = await userClient.rpc("academy_is_admin");
  if (submission.student_id !== userResult.user.id && !isTeacher && !isAdmin)
    return json({ error: "Submission access denied." }, 403);

  // A submission is a snapshot, so it is graded at most once. Without this the
  // endpoint could be called repeatedly against the same code to burn executor
  // time and cost, since nothing else limited how often a student could ask.
  const { data: existing } = await serviceClient
    .from("academy_submission_results")
    .select("objective_score, objective_status, tests_passed, tests_total")
    .eq("submission_id", submission.id)
    .maybeSingle();
  if (existing)
    return json({
      status: "graded",
      passed_tests: existing.tests_passed,
      total_tests: existing.tests_total,
      objective_score: existing.objective_score,
      cached: true,
    });

  const tests = submission.academy_assignments?.automated_tests;
  if (
    typeof submission.source_code !== "string" ||
    submission.source_code.length === 0 ||
    submission.source_code.length > MAX_SOURCE_LENGTH ||
    !Array.isArray(tests) ||
    tests.length === 0 ||
    tests.length > MAX_TESTS
  )
    return fail(serviceClient, submission.id, "Submission or assignment tests are invalid.");

  // A cheap pre-filter for the most obvious mistakes, not a security boundary.
  // It is trivially bypassed, so it must never be described as one. The real
  // boundary is that this function never executes student code at all: it is
  // posted to a separate isolated executor, and nothing here runs it.
  const obvious = [
    /\b(?:import|from)\s+(?:os|sys|subprocess|socket|requests|urllib|pathlib)\b/i,
    /\b(?:eval|exec|compile|__import__|open)\s*\(/i,
  ];
  if (obvious.some((pattern) => pattern.test(submission.source_code)))
    return fail(serviceClient, submission.id, "Submission uses a restricted Python feature.");

  if (
    tests.some((test: { name?: unknown; input?: unknown; expected?: unknown }) =>
      typeof test.name !== "string" ||
      !Array.isArray(test.input) ||
      JSON.stringify(test.input).length > 2000 ||
      !Object.prototype.hasOwnProperty.call(test, "expected"))
  )
    return fail(serviceClient, submission.id, "Assignment tests are invalid.");

  await setState(serviceClient, submission.id, "grading", null);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let result: {
    status?: string;
    error?: string;
    tests?: { name: string; passed: boolean }[];
  };
  try {
    const response = await fetch(executorUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${executorKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source_code: submission.source_code,
        tests,
        max_score: submission.academy_assignments?.points ?? 100,
      }),
    });
    // A 5xx or a dropped connection is ours to retry, so it stays 503. Anything
    // the executor actually answered is a verdict about the submission.
    if (!response.ok) {
      await setState(
        serviceClient,
        submission.id,
        "grading_unavailable",
        `Trusted executor returned HTTP ${response.status}.`,
      );
      return json({ status: "grading_unavailable" }, 503);
    }
    result = await response.json();
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Trusted executor timed out."
      : error instanceof Error ? error.message : "Trusted grading failed.";
    await setState(serviceClient, submission.id, "grading_unavailable", message);
    return json({ status: "grading_unavailable" }, 503);
  } finally {
    clearTimeout(timeout);
  }

  if (EXECUTOR_VERDICTS.includes(result?.status ?? ""))
    return fail(serviceClient, submission.id, result.error ?? "Submission could not be executed.");

  // Output we cannot trust is a terminal answer for a human to look at, not a
  // transient outage. Reporting it as unavailable would leave the submission
  // retrying forever with no teacher ever shown a reason.
  const expected = tests.map((test: { name: string }) => test.name);
  const returned = Array.isArray(result?.tests) ? result.tests : [];
  const trustworthy =
    result?.status === "completed" &&
    returned.length === tests.length &&
    returned.every(
      (test: { name?: unknown; passed?: unknown }) =>
        typeof test.name === "string" && typeof test.passed === "boolean",
    ) &&
    // Correlate names, so an executor that returns the right count of invented
    // passes cannot manufacture a full score for code that fails everything.
    new Set(returned.map((test: { name: string }) => test.name)).size === new Set(expected).size &&
    returned.every((test: { name: string }) => expected.includes(test.name));

  if (!trustworthy)
    return fail(
      serviceClient,
      submission.id,
      "Trusted executor returned results that could not be verified.",
    );

  const passedTests = returned.filter((test: { passed: boolean }) => test.passed).length;
  const totalTests = returned.length;
  const maxScore = Number(submission.academy_assignments?.points ?? 100);
  const objectiveScore = Number(((passedTests / totalTests) * maxScore).toFixed(2));

  const { error: resultError } = await serviceClient.from("academy_submission_results").upsert({
    submission_id: submission.id,
    assignment_id: submission.assignment_id,
    student_id: submission.student_id,
    objective_score: objectiveScore,
    objective_status: passedTests === totalTests ? "passed" : passedTests ? "partial" : "failed",
    final_score: objectiveScore,
    score: objectiveScore,
    max_score: maxScore,
    tests_passed: passedTests,
    tests_total: totalTests,
    passed_tests: passedTests,
    failed_tests: totalTests - passedTests,
    test_summary: { tests: returned },
    deterministic_feedback: { tests: returned },
    deterministic_source: "trusted_executor",
    executor_name: Deno.env.get("GRADING_EXECUTOR_NAME") ?? "external",
    executor_version: Deno.env.get("GRADING_EXECUTOR_VERSION") ?? "1",
    ai_feedback_status: "pending",
  });
  // Previously swallowed, so a failed result write still returned 200 and the
  // grade silently vanished with no record that it was ever attempted.
  if (resultError)
    return json({ status: "grading_unavailable", error: "Could not record the grade." }, 503);

  await setState(serviceClient, submission.id, "graded", null);
  return json({
    status: "graded",
    passed_tests: passedTests,
    total_tests: totalTests,
    objective_score: objectiveScore,
  });
});

/** Terminal student facing failure, surfaced to a teacher. */
async function fail(
  client: ReturnType<typeof createClient>,
  submissionId: string,
  reason: string,
) {
  await setState(client, submissionId, "grading_failed", reason);
  return json({ status: "grading_failed", error: reason }, 422);
}

async function setState(
  client: ReturnType<typeof createClient>,
  submissionId: string,
  status: string,
  error: string | null,
) {
  const { error: writeError } = await client
    .from("academy_submissions")
    .update({
      status,
      grading_error: error,
      grading_attempted_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (writeError) console.error("setState failed", submissionId, status, writeError.message);
}
