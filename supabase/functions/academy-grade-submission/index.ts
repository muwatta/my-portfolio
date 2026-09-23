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

  const tests = submission.academy_assignments?.automated_tests;
  if (!executorUrl || !executorKey) {
    await setState(serviceClient, submission.id, "grading_unavailable", "Trusted grading executor is not configured.");
    return json({ status: "grading_unavailable" }, 503);
  }
  if (
    typeof submission.source_code !== "string" ||
    submission.source_code.length === 0 ||
    submission.source_code.length > MAX_SOURCE_LENGTH ||
    !Array.isArray(tests) ||
    tests.length === 0 ||
    tests.length > MAX_TESTS
  ) {
    await setState(serviceClient, submission.id, "grading_failed", "Submission or assignment tests are invalid.");
    return json({ status: "grading_failed" }, 422);
  }
  const dangerousPatterns = [
    /\b(?:import|from)\s+(?:os|sys|subprocess|socket|requests|urllib|pathlib)\b/i,
    /\b(?:eval|exec|compile|__import__|open)\s*\(/i,
  ];
  if (dangerousPatterns.some((pattern) => pattern.test(submission.source_code))) {
    await setState(serviceClient, submission.id, "grading_failed", "Submission uses a restricted Python feature.");
    return json({ status: "grading_failed" }, 422);
  }
  if (tests.some((test: { name?: unknown; input?: unknown; expected?: unknown }) =>
    typeof test.name !== "string" ||
    !Array.isArray(test.input) ||
    JSON.stringify(test.input).length > 2000 ||
    !Object.prototype.hasOwnProperty.call(test, "expected")
  )) {
    await setState(serviceClient, submission.id, "grading_failed", "Assignment tests are invalid.");
    return json({ status: "grading_failed" }, 422);
  }

  await setState(serviceClient, submission.id, "grading", null);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
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
    if (!response.ok) throw new Error(`Trusted executor returned HTTP ${response.status}.`);
    const result = await response.json();
    if (["syntax_error", "runtime_error", "timeout"].includes(result?.status)) {
      await setState(
        serviceClient,
        submission.id,
        "grading_failed",
        result.error ?? "Submission could not be executed.",
      );
      return json({ status: "grading_failed" }, 422);
    }
    if (
      result?.status !== "completed" ||
      !Array.isArray(result.tests) ||
      result.tests.length !== tests.length ||
      result.tests.some((test: { name?: unknown; passed?: unknown }) => typeof test.name !== "string" || typeof test.passed !== "boolean")
    ) {
      throw new Error("Trusted executor returned malformed results.");
    }
    const passedTests = result.tests.filter((test: { passed: boolean }) => test.passed).length;
    const totalTests = result.tests.length;
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
      test_summary: { tests: result.tests },
      deterministic_feedback: { tests: result.tests },
      deterministic_source: "trusted_executor",
      executor_name: Deno.env.get("GRADING_EXECUTOR_NAME") ?? "external",
      executor_version: Deno.env.get("GRADING_EXECUTOR_VERSION") ?? "1",
      ai_feedback_status: "pending",
    });
    if (resultError) throw resultError;
    await setState(serviceClient, submission.id, "graded", null);
    return json({ status: "graded", passed_tests: passedTests, total_tests: totalTests, objective_score: objectiveScore });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Trusted executor timed out."
      : error instanceof Error ? error.message : "Trusted grading failed.";
    await setState(serviceClient, submission.id, "grading_unavailable", message);
    return json({ status: "grading_unavailable" }, 503);
  } finally {
    clearTimeout(timeout);
  }
});

async function setState(client: ReturnType<typeof createClient>, submissionId: string, status: string, error: string | null) {
  await client.from("academy_submissions").update({
    status,
    grading_error: error,
    grading_attempted_at: new Date().toISOString(),
  }).eq("id", submissionId);
}
