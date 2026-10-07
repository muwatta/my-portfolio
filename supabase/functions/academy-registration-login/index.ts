import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readTextBodyLimited, RequestBodyTooLargeError } from "../_shared/http.ts";

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

const invalidCredentials = () =>
  json({ error: "Invalid login credentials." }, 400);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Registration-number sign-in is unavailable." }, 500);
  }

  let input: {
    registration_number?: unknown;
    password?: unknown;
    captcha_token?: unknown;
  };
  try {
    input = JSON.parse(await readTextBodyLimited(request, 8_192));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return json({ error: "Request is too large." }, 413);
    }
    return json({ error: "Invalid sign-in request." }, 400);
  }

  const registrationNumber = String(input?.registration_number ?? "")
    .trim()
    .toUpperCase();
  const password = input?.password;
  const captchaToken = input?.captcha_token;
  if (
    !/^ATE-\d{2}-\d{3}$/.test(registrationNumber) ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 1_024 ||
    (captchaToken !== undefined && typeof captchaToken !== "string")
  ) {
    return invalidCredentials();
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: registration, error: registrationError } = await service
    .from("academy_registration_codes")
    .select("claimed_by")
    .eq("registration_number", registrationNumber)
    .in("status", ["claimed", "provisional"])
    .maybeSingle();
  if (registrationError || !registration?.claimed_by) return invalidCredentials();

  const { data: userResult, error: userError } =
    await service.auth.admin.getUserById(registration.claimed_by);
  const email = userResult.user?.email;
  if (
    userError ||
    !email ||
    !userResult.user?.email_confirmed_at
  ) {
    return invalidCredentials();
  }

  const auth = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await auth.auth.signInWithPassword({
    email,
    password,
    ...(typeof captchaToken === "string" && captchaToken
      ? { options: { captchaToken } }
      : {}),
  });
  if (error || !data.session) return invalidCredentials();

  return json({ session: data.session, user: data.user });
});
