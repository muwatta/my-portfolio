import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useArticles } from "../hooks/useArticles";
import { useArticleForm, slugify } from "../hooks/useArticleForm";
import { FiX, FiCheck, FiAlertCircle, FiLoader } from "react-icons/fi";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">Admin Login</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

function StatusPill({ status }) {
  const styles = {
    published: "bg-green-100 text-green-800",
    draft: "bg-yellow-100 text-yellow-800",
    archived: "bg-gray-100 text-gray-800",
  };
  return <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>{status}</span>;
}

function ArticlePreview({ article, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (window.confirm(`Delete "${article.title}"?`)) {
      setDeleting(true);
      try {
        await onDelete(article.id);
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-start gap-4">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{article.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-2">{article.excerpt}</p>
        <div className="flex gap-2 mt-2">
          <StatusPill status={article.status} />
          <span className="text-xs text-gray-500">{new Date(article.date).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onEdit(article)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? <FiLoader className="inline animate-spin" /> : "Delete"}
        </button>
      </div>
    </div>
  );
}

function ArticlesList({ articles, loading, onEdit, onDelete, onSelectStatus }) {
  if (loading) return <div className="text-center py-8 text-gray-500">Loading articles...</div>;
  if (articles.length === 0) return <div className="text-center py-8 text-gray-500">No articles yet.</div>;

  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <ArticlePreview key={article.id} article={article} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen bg-gray-50 p-6">{children}</div>;
}

export default function Admin() {
  const { user, logout } = useAuth();
  const { posts, loading: articlesLoading, error: articlesError, setError, load, save, remove } = useArticles();
  const { form, tagsText, errors, update, setTagsText, reset, validate, getPayload } = useArticleForm();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    return {
      published: posts.filter((p) => p.status === "published").length,
      drafts: posts.filter((p) => p.status === "draft").length,
      archived: posts.filter((p) => p.status === "archived").length,
    };
  }, [posts]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return posts;
    return posts.filter((p) => p.status === statusFilter);
  }, [posts, statusFilter]);

  const handleSelectArticle = (article) => {
    setSelected(article);
    reset(article);
    setSuccessMsg("");
  };

  const handleNewArticle = () => {
    setSelected(null);
    reset();
    setSuccessMsg("");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = getPayload();
      await save(payload, selected);
      setSuccessMsg(`Article "${payload.title}" ${selected ? "updated" : "created"} successfully!`);
      handleNewArticle();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <Login onLogin={(email, password) => Promise.reject(new Error("Demo mode"))} />;

  return (
    <Shell>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Blog Admin</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <Panel title="Published" className="text-center">
            <div className="text-3xl font-bold text-green-600">{stats.published}</div>
          </Panel>
          <Panel title="Drafts" className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{stats.drafts}</div>
          </Panel>
          <Panel title="Archived" className="text-center">
            <div className="text-3xl font-bold text-gray-600">{stats.archived}</div>
          </Panel>
        </div>

        {successMsg && (
          <div role="alert" className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
            <FiCheck className="flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {articlesError && (
          <div role="alert" className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2">
            <FiAlertCircle className="flex-shrink-0" />
            {articlesError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Panel title="Articles">
              <div className="mb-4 flex gap-2">
                {["all", "published", "draft", "archived"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1 rounded text-sm font-medium transition ${
                      statusFilter === status
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
              <ArticlesList
                articles={filtered}
                loading={articlesLoading}
                onEdit={handleSelectArticle}
                onDelete={remove}
              />
            </Panel>
          </div>

          <div>
            <Panel title={selected ? "Edit Article" : "New Article"}>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => {
                      const value = e.target.value;
                      update("title", value);
                      if (!form.slug) update("slug", slugify(value));
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.title ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="Article title"
                  />
                  {errors.title && <p className="text-red-600 text-xs mt-1">{errors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => update("slug", slugify(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.slug ? "border-red-500" : "border-gray-300"
                    }`}
                    placeholder="url-slug"
                  />
                  {errors.slug && <p className="text-red-600 text-xs mt-1">{errors.slug}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                  <textarea
                    value={form.excerpt}
                    onChange={(e) => update("excerpt", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    placeholder="Brief summary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Body *</label>
                  <textarea
                    value={form.body}
                    onChange={(e) => update("body", e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.body ? "border-red-500" : "border-gray-300"
                    }`}
                    rows="6"
                    placeholder="Article body (Markdown)"
                  />
                  {errors.body && <p className="text-red-600 text-xs mt-1">{errors.body}</p>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => update("category", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option>Tech</option>
                      <option>Education</option>
                      <option>Career</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => update("date", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <input
                    type="text"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={form.featured}
                    onChange={(e) => update("featured", e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="featured" className="text-sm text-gray-700">
                    Featured
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => update("status", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving && <FiLoader className="animate-spin" />}
                    {selected ? "Update" : "Create"}
                  </button>
                  {selected && (
                    <button
                      type="button"
                      onClick={handleNewArticle}
                      className="flex-1 bg-gray-600 text-white py-2 rounded-lg font-medium hover:bg-gray-700"
                    >
                      New
                    </button>
                  )}
                </div>
              </form>
            </Panel>
          </div>
        </div>
      </div>
    </Shell>
  );
}
