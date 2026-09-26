import { useState, useCallback } from "react";

const EMPTY_FORM = {
  title: "", slug: "", excerpt: "", body: "", category: "Tech",
  date: new Date().toISOString().slice(0, 10), image: "",
  medium_link: "", tags: [], readTime: "5 min read", featured: false, status: "draft",
};

export const slugify = (value) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const validateForm = (form) => {
  const errors = {};
  if (!form.title?.trim()) errors.title = "Title is required";
  if (!form.body?.trim()) errors.body = "Body is required";
  if (!form.slug?.trim()) errors.slug = "Slug is required";
  return errors;
};

export function useArticleForm(post = null) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM, ...(post || {}),
    date: String(post?.date || "").slice(0, 10) || EMPTY_FORM.date,
  }));
  const [tagsText, setTagsText] = useState(post?.tags?.join(", ") || "");
  const [errors, setErrors] = useState({});

  const update = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => { const next = { ...current }; delete next[field]; return next; });
    }
  }, [errors]);

  const reset = useCallback((post = null) => {
    setForm({ ...EMPTY_FORM, ...(post || {}), date: String(post?.date || "").slice(0, 10) || EMPTY_FORM.date });
    setTagsText(post?.tags?.join(", ") || "");
    setErrors({});
  }, []);

  const validate = useCallback(() => {
    const formErrors = validateForm(form);
    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  }, [form]);

  const getPayload = useCallback(() => ({
    ...form,
    slug: form.slug || slugify(form.title),
    tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
  }), [form, tagsText]);

  return { form, tagsText, errors, update, setTagsText, reset, validate, getPayload };
}
