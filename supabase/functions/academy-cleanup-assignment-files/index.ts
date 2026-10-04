import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "assignment-submissions";
const RETENTION_DAYS = 30;
const BATCH_SIZE = 100;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    console.error("Assignment file cleanup is missing Supabase configuration.");
    return json({ error: "Cleanup is not configured." }, 500);
  }

  if (request.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
    return json({ error: "Service role authorization required." }, 401);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  let removedFiles = 0;

  while (true) {
    const { data: submissions, error: queryError } = await service
      .from("academy_submissions")
      .select("id, file_path")
      .not("file_path", "is", null)
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error("Could not find expired assignment uploads.", queryError);
      return json({ error: "Expired uploads could not be listed." }, 500);
    }
    if (!submissions?.length) break;

    const filePaths = submissions
      .map((submission) => submission.file_path)
      .filter((filePath): filePath is string => Boolean(filePath));
    const { error: removeError } = await service.storage
      .from(BUCKET)
      .remove(filePaths);

    if (removeError) {
      console.error("Could not remove expired assignment uploads.", removeError);
      return json({ error: "Expired uploads could not be removed." }, 500);
    }

    const ids = submissions.map((submission) => submission.id);
    const { error: updateError } = await service
      .from("academy_submissions")
      .update({ file_path: null })
      .in("id", ids);

    if (updateError) {
      console.error("Could not clear expired upload references.", updateError);
      return json({ error: "Expired upload references could not be cleared." }, 500);
    }

    removedFiles += filePaths.length;
  }

  return json({ removedFiles, retentionDays: RETENTION_DAYS });
});
