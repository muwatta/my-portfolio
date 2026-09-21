import { auth } from "./firebase";
import { isSupabaseConfigured, supabase } from "./supabase";

export const asPublicPost = (row = {}) => ({
  id: row.id,
  slug: row.slug || String(row.id || ""),
  title: row.title,
  excerpt: row.excerpt,
  body: row.body,
  category: row.category,
  date: row.date?.toDate ? row.date.toDate().toISOString() : row.date,
  image: row.image || row.coverImage,
  medium_link: row.medium_link || row.mediumLink,
  tags: row.tags || [],
  readTime: row.read_time || row.readTime,
  featured: Boolean(row.featured),
  status: row.status || (row.published === false ? "draft" : "published"),
  published: row.published !== false,
});

export const filterPublicPosts = (posts = []) =>
  posts.filter((post) => post.published !== false);

const fetchLegacyPosts = async (includeDrafts) => {
  const res = await fetch("/blog.json");
  if (!res.ok) throw new Error("Couldn't load posts.");
  const posts = await res.json();
  return includeDrafts ? posts : filterPublicPosts(posts);
};

export async function fetchPosts({ includeDrafts = false } = {}) {
  if (includeDrafts) {
    return requestAdmin("GET");
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("blog_posts")
      .select(
        "id, slug, title, excerpt, body, category, date, image, medium_link, tags, read_time, featured, status, published, created_at, updated_at, published_at",
      )
      .eq("published", true)
      .order("date", { ascending: false });

    if (!error) return (data || []).map(asPublicPost);
  }

  return fetchLegacyPosts(includeDrafts);
}

export async function fetchPost(id) {
  const posts = await fetchPosts();
  return posts.find((post) => String(post.id) === String(id)) || null;
}

export async function createPost(post) {
  return requestAdmin("POST", { action: "create", post });
}

export async function updatePost(id, post) {
  return requestAdmin("POST", { action: "update", id, post });
}

export async function deletePost(id) {
  return requestAdmin("POST", { action: "delete", id });
}

async function requestAdmin(method, payload) {
  if (!auth?.currentUser)
    throw new Error("Firebase admin authentication is required.");

  const token = await auth.currentUser.getIdToken();
  const response = await fetch("/api/blog-admin", {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Blog operation failed.");

  return Array.isArray(result)
    ? result.map(asPublicPost)
    : asPublicPost(result);
}
