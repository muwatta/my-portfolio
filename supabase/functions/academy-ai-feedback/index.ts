import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const providerKey = Deno.env.get("AI_PROVIDER_API_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey)
    return json({ error: "Supabase is not configured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userResult } = await userClient.auth.getUser();
  if (!userResult.user) return json({ error: "Authentication required" }, 401);
  const { data: teacher } = await userClient.rpc("academy_is_teacher");
  const { data: admin } = await userClient.rpc("academy_is_admin");
  if (!teacher && !admin)
    return json({ error: "Teacher or admin access required" }, 403);

  let input: { submission_id?: string; deterministic_feedback?: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Malformed JSON" }, 400);
  }
  if (!input.submission_id)
    return json({ error: "submission_id is required" }, 400);

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: result, error: resultError } = await serviceClient
    .from("academy_submission_results")
    .select(
      "submission_id, objective_score, objective_status, deterministic_feedback",
    )
    .eq("submission_id", input.submission_id)
    .maybeSingle();
  if (resultError || !result)
    return json({ error: "Deterministic result not found" }, 404);

  // AI receives only objective grading metadata, never names, email addresses, or source files.
  const deterministicFeedback =
    input.deterministic_feedback ?? result.deterministic_feedback ?? {};
  if (!providerKey) {
    return json(
      {
        ai_feedback_status: "disabled",
        ai_feedback: null,
        objective_score: result.objective_score,
        deterministic_feedback: deterministicFeedback,
      },
      200,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const providerResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${providerKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("AI_FEEDBACK_MODEL") ?? "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Give concise, encouraging educational feedback based only on deterministic grading metadata. Never invent a score.",
            },
            {
              role: "user",
              content: JSON.stringify({
                objective_score: result.objective_score,
                objective_status: result.objective_status,
                deterministic_feedback: deterministicFeedback,
              }),
            },
          ],
        }),
      },
    );
    if (providerResponse.status === 429) {
      await updateAiResult(
        serviceClient,
        input.submission_id,
        "rate_limited",
        null,
      );
      return json({
        ai_feedback_status: "rate_limited",
        ai_feedback: null,
        objective_score: result.objective_score,
      });
    }
    if (!providerResponse.ok) {
      await updateAiResult(serviceClient, input.submission_id, "failed", null);
      return json({
        ai_feedback_status: "failed",
        ai_feedback: null,
        objective_score: result.objective_score,
      });
    }
    const providerJson = await providerResponse.json();
    const feedback = providerJson?.choices?.[0]?.message?.content;
    if (typeof feedback !== "string" || !feedback.trim()) {
      await updateAiResult(serviceClient, input.submission_id, "failed", null);
      return json({
        ai_feedback_status: "failed",
        ai_feedback: null,
        objective_score: result.objective_score,
      });
    }
    await updateAiResult(
      serviceClient,
      input.submission_id,
      "available",
      feedback.trim(),
    );
    return json({
      ai_feedback_status: "available",
      ai_feedback: feedback.trim(),
      objective_score: result.objective_score,
    });
  } catch (error) {
    const status =
      error instanceof DOMException && error.name === "AbortError"
        ? "failed"
        : "failed";
    await updateAiResult(serviceClient, input.submission_id, status, null);
    return json({
      ai_feedback_status: status,
      ai_feedback: null,
      objective_score: result.objective_score,
    });
  } finally {
    clearTimeout(timeout);
  }
});

async function updateAiResult(
  client: ReturnType<typeof createClient>,
  submissionId: string,
  status: string,
  feedback: string | null,
) {
  await client
    .from("academy_submission_results")
    .update({
      ai_feedback_status: status,
      ai_feedback: feedback === null ? null : { text: feedback },
    })
    .eq("submission_id", submissionId);
}
