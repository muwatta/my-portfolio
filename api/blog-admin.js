import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth, getFirestore } from "firebase-admin";
import { createClient } from "@supabase/supabase-js";

function getFirebaseAdmin() {
  if (getApps().length) return getApps()[0];

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    throw new Error("Firebase server credentials are not configured.");
  }

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID || "muwatta-portfolio",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizePost(post = {}, id = post.id) {
  const status =
    post.status || (post.published === false ? "draft" : "published");
  return {
    id: String(id || crypto.randomUUID()),
    slug: String(post.slug || id || crypto.randomUUID()),
    title: String(post.title || "").trim(),
    excerpt: String(post.excerpt || ""),
    body: String(post.body || ""),
    category: String(post.category || "Tech"),
    date: post.date || null,
    image: post.image || null,
    medium_link: post.medium_link || post.mediumLink || null,
    tags: Array.isArray(post.tags) ? post.tags : [],
    read_time: post.read_time || post.readTime || "5 min read",
    featured: Boolean(post.featured),
    status,
    published: status === "published",
    ...(status === "published"
      ? { published_at: post.published_at || new Date().toISOString() }
      : {}),
  };
}

async function requireAdmin(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Missing Firebase ID token.");

  const firebaseApp = getFirebaseAdmin();
  const decoded = await getAuth(firebaseApp).verifyIdToken(token);
  const adminSnapshot = await getFirestore(firebaseApp)
    .doc(`admin_users/${decoded.uid}`)
    .get();
  if (
    !adminSnapshot.exists ||
    adminSnapshot.data()?.role !== "admin" ||
    adminSnapshot.data()?.active !== true
  ) {
    throw new Error("Admin access is required.");
  }
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    await requireAdmin(request);
    const supabase = getSupabaseAdmin();

    if (request.method === "GET") {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return response.status(200).json(data || []);
    }

    const payload =
      typeof request.body === "string"
        ? JSON.parse(request.body)
        : request.body || {};
    if (!["create", "update", "delete"].includes(payload.action)) {
      return response.status(400).json({ error: "Unsupported blog action." });
    }

    if (payload.action === "delete") {
      const { error } = await supabase
        .from("blog_posts")
        .delete()
        .eq("id", String(payload.id));
      if (error) throw error;
      return response.status(200).json({ id: String(payload.id) });
    }

    const row = normalizePost(payload.post, payload.id);
    const query =
      payload.action === "create"
        ? supabase.from("blog_posts").insert(row).select().single()
        : supabase
            .from("blog_posts")
            .update({
              ...row,
              id: undefined,
              updated_at: new Date().toISOString(),
            })
            .eq("id", String(payload.id))
            .select()
            .single();
    const { data, error } = await query;
    if (error) throw error;
    return response.status(200).json(data);
  } catch (error) {
    return response
      .status(401)
      .json({ error: error.message || "Unauthorized." });
  }
}
