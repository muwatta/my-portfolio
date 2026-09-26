import { useState, useCallback } from "react";
import { createPost, deletePost, fetchPosts, updatePost } from "../lib/blog";

export function useArticles() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await fetchPosts({ includeDrafts: true });
      setPosts(data);
    } catch (err) {
      setError(err.message || "Could not load articles. Check Firestore deployment and indexes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (form, selected) => {
    try {
      setError("");
      const payload = { ...form, slug: form.slug, tags: form.tags };
      const result = selected
        ? await updatePost(selected.id, payload)
        : await createPost(payload);
      setPosts((current) =>
        selected ? current.map((p) => (p.id === result.id ? result : p)) : [result, ...current]
      );
      return result;
    } catch (err) {
      setError(err.message || "Failed to save article");
      throw err;
    }
  }, []);

  const remove = useCallback(async (postId) => {
    try {
      setError("");
      await deletePost(postId);
      setPosts((current) => current.filter((p) => p.id !== postId));
    } catch (err) {
      setError(err.message || "Failed to delete article");
      throw err;
    }
  }, []);

  return { posts, loading, error, setError, load, save, remove };
}
