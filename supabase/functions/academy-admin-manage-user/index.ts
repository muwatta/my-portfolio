import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  readTextBodyLimited,
  RequestBodyTooLargeError,
} from "../_shared/http.ts";

// Administrator account management.
//
// There was no way to edit or delete an Academy account. Postgres cannot call
// the GoTrue admin API, and the service role key must never reach the browser,
// so this has to be an Edge Function: it verifies the caller is an administrator
// using their own token, then performs the mutation with the service role.
//
// The same rule as academy_primary_admin_id applies here. The account owner is
// identified by a pinned user id rather than an address comparison, because an
// address comparison could not be trusted to match consistently on this
// database. Deleting or demoting the owner, or an administrator deleting
// themselves, would leave nobody able to administer the Academy.

const OWNER_ID = "45501f33-911d-495b-a994-ba654683e521";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });

type Action = "update" | "delete";
const MAX_REQUEST_BYTES = 16_384;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authorization || !supabaseUrl || !anonKey || !serviceKey)
    return json({ error: "Authentication or Supabase configuration is missing." }, 401);

  // Verify with the caller's own token so RLS applies, rather than trusting the
  // body about who is calling.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userResult } = await callerClient.auth.getUser();
  if (!userResult.user) return json({ error: "Authentication required." }, 401);

  const { data: isAdmin } = await callerClient.rpc("academy_is_admin");
  if (!isAdmin)
    return json({ error: "Only Academy administrators can manage accounts." }, 403);

  let input: {
    action?: Action;
    target_user_id?: string;
    display_name?: string;
    email?: string;
    role?: string;
    school_id?: string | null;
    state?: string | null;
    city?: string | null;
    student_level?: string | null;
    reason?: string;
  };
  try {
    input = JSON.parse(await readTextBodyLimited(request, MAX_REQUEST_BYTES));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ error: error.message }, 413);
    }
    return json({ error: "Malformed JSON" }, 400);
  }
  if (!input || typeof input !== "object" || Array.isArray(input))
    return json({ error: "A JSON object is required." }, 400);

  const action = input.action;
  const target = input.target_user_id;

  const service = createClient(supabaseUrl, serviceKey);

  // Lets an administrator see that an address is already taken before trying,
  // which is the duplicate case the signup form cannot report honestly without
  // disclosing who holds the account.
  if (action === "check_email") {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (
      email.length > 254 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ) return json({ error: "A valid email address is required." }, 400);

    const { data: adminRow } = await service
      .from("academy_profiles")
      .select("id, display_name, role")
      .eq("email", email)
      .maybeSingle();

    let authExists = false;
    let confirmed = false;
    if (adminRow) {
      const { data: authRow } = await service.auth.admin.getUserById(adminRow.id);
      authExists = Boolean(authRow?.user);
      confirmed = Boolean(authRow?.user?.email_confirmed_at);
    }

    return json({
      exists: Boolean(adminRow),
      has_account: authExists,
      email_confirmed: confirmed,
      display_name: adminRow?.display_name ?? null,
      role: adminRow?.role ?? null,
    });
  }

  if (action !== "update" && action !== "delete")
    return json({ error: "action must be update or delete" }, 400);
  if (typeof target !== "string" || !UUID_PATTERN.test(target))
    return json({ error: "A valid target_user_id is required." }, 400);

  // Lockout protection. An administrator who removes the owner, or themselves,
  // leaves nobody able to administer the Academy or undo the deletion.
  if (target === OWNER_ID)
    return json(
      { error: "The account owner cannot be edited or deleted from here." },
      403,
    );
  if (target === userResult.user.id)
    return json({ error: "You cannot delete or edit your own account." }, 403);

  // Capture who is about to disappear, and why, before they do.
  const { data: targetProfile } = await service
    .from("academy_profiles")
    .select("id, display_name, role, registration_code_id")
    .eq("id", target)
    .maybeSingle();
  const { data: targetAuth } = await service.auth.admin.getUserById(target);

  if (!targetProfile && !targetAuth?.user)
    return json({ error: "That account no longer exists." }, 404);

  if (action === "delete") {
    const reason = String(input.reason ?? "").trim();
    if (!reason)
      return json(
        { error: "A reason is required before deleting an account." },
        400,
      );

    // Never remove the last administrator, whoever is asking.
    const { data: admins } = await service
      .from("academy_admins")
      .select("user_id");
    const remaining = (admins ?? []).filter(
      (row) => row.user_id !== target && row.user_id !== OWNER_ID,
    );
    if (admins && remaining.length === 0 && targetAuth?.user)
      return json(
        { error: "That is the last removable administrator. Keep at least one." },
        403,
      );

    const { data: registrationCode } = targetProfile?.registration_code_id
      ? await service
          .from("academy_registration_codes")
          .select("registration_number")
          .eq("id", targetProfile.registration_code_id)
          .maybeSingle()
      : { data: null };
    const { error: auditError } = await service
      .from("academy_registration_audit")
      .insert({
        actor_id: userResult.user.id,
        student_id: target,
        registration_code_id: targetProfile?.registration_code_id ?? null,
        registration_number:
          registrationCode?.registration_number ?? "UNASSIGNED",
        action: "account_deleted",
        metadata: {
          reason,
          display_name: targetProfile?.display_name ?? null,
          role: targetProfile?.role ?? null,
          email: targetAuth?.user?.email ?? null,
        },
      });
    if (auditError)
      return json(
        { error: `The deletion could not be recorded: ${auditError.message}` },
        500,
      );

    const { error: deleteError } = await service.auth.admin.deleteUser(target);
    if (deleteError)
      return json({ error: `The account could not be deleted: ${deleteError.message}` }, 500);

    return json({ deleted: true, user_id: target });
  }

  // update
  const patch: Record<string, unknown> = {};
  if (typeof input.display_name === "string") {
    const name = input.display_name.trim();
    if (!name || name.length > 120)
      return json({ error: "A name between 1 and 120 characters is required." }, 400);
    patch.display_name = name;
  }
  if (input.role !== undefined) {
    if (input.role !== "student" && input.role !== "teacher")
      return json({ error: "A role must be student or teacher." }, 400);
    patch.role = input.role;
  }
  for (const key of ["school_id", "state", "city", "student_level"] as const) {
    if (input[key] !== undefined) {
      const value = input[key];
      patch[key] =
        value === null || value === "" ? null : String(value).trim();
    }
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (email) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return json({ error: "That email address is not valid." }, 400);
    if (targetAuth?.user?.email?.toLowerCase() === email)
      patch.email_confirm = true;
    else patch.email = email;
  }

  const { error: authError } = await service.auth.admin.updateUserById(target, patch);
  if (authError)
    return json({ error: `The account could not be updated: ${authError.message}` }, 500);

  // auth.users holds the login identity, but the Academy reads display_name and
  // the location fields from academy_profiles, and nothing syncs them: the only
  // auth.users triggers cover email and signup claiming. Writing to auth alone
  // left the edit looking successful and then reverting on the next read, so
  // persist the same values to the profile.
  //
  // `role` is deliberately not persisted here. It drives authorisation, and the
  // single-admin and role RPC migrations own how a role may change.
  const profilePatch: Record<string, unknown> = {};
  if (typeof patch.display_name === "string")
    profilePatch.display_name = patch.display_name;
  for (const key of ["school_id", "state", "city", "student_level"] as const) {
    if (key in patch) profilePatch[key] = patch[key];
  }

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileError } = await service
      .from("academy_profiles")
      .update({ ...profilePatch, updated_at: new Date().toISOString() })
      .eq("id", target);
    if (profileError)
      return json(
        { error: `The Academy profile could not be updated: ${profileError.message}` },
        500,
      );
  }

  await service.from("academy_registration_audit").insert({
    actor_id: userResult.user.id,
    student_id: target,
    registration_number: null,
    action: "account_updated",
    metadata: { changed: Object.keys(patch), reason: input.reason ?? null },
  });

  return json({ updated: true, user_id: target });
});
