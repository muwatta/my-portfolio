import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAcademyAuth } from "../hooks/useAcademyAuth";
import {
  getAcademyCourseMaterials,
  getActiveCourseForStudent,
} from "../lib/academy";
import { cacheOfflineAsset, removeOfflineAsset, OFFLINE_STORES } from "../lib/offlineStore";
import { fetchWithOfflineFallback } from "../lib/academyOffline";

function assetUrl(storagePath) {
  const path = String(storagePath  ??  "");
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `/${path.replace(/^\//, "")}`;
}

function formatBytes(bytes) {
  const value = Number(bytes  ??  0);
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

const fileName = (storagePath) => (storagePath ?? "").split("/").pop();

export default function AcademyMaterials() {
  const { user } = useAcademyAuth();
  const [materials, setMaterials] = useState([]);
  const [state, setState] = useState("loading");
  const [downloaded, setDownloaded] = useState({});
  const [downloading, setDownloading] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const course = navigator.onLine ? await getActiveCourseForStudent(user.id) : { data: null };
      const result = await fetchWithOfflineFallback({
        userId: user.id,
        store: OFFLINE_STORES.materials,
        id: "list:materials",
        fetcher: () => getAcademyCourseMaterials(course?.data?.id),
      });
      if (cancelled) return;
      setMaterials(result.data ?? []);
      setState(result.error ? "error" : "ready");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    if (!materials.length || !("caches" in window)) return;
    void Promise.all(
      materials.map(async (material) => {
        const url = assetUrl(material.storage_path);
        return [material.id, url ? Boolean(await caches.match(url)) : false];
      }),
    ).then((entries) => setDownloaded(Object.fromEntries(entries)));
  }, [materials]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Course resources
        </p>
        <h1 className="mt-2 text-3xl font-bold">Materials</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
          Downloadable course books and manuals. Files open right in your
          browser and can be saved to your device.
        </p>
      </header>
      {!navigator.onLine && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Offline learning mode. Downloaded materials remain available from this device.
        </p>
      )}
      {state === "loading" && <p>Loading materials...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Materials could not be loaded.
        </p>
      )}
      {state === "ready" && materials.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-sm dark:border-slate-700">
          No materials have been published for your learning path yet.
        </p>
      )}
      {materials.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {materials.map((material) => {
            const url = assetUrl(material.storage_path);
  async function downloadMaterial(material) {
    const url = assetUrl(material.storage_path);
    if (!url) return;
    setDownloading(material.id);
    try {
      await cacheOfflineAsset(url);
      setDownloaded((current) => ({ ...current, [material.id]: true }));
    } finally {
      setDownloading("");
    }
  }

  async function removeMaterial(material) {
    const url = assetUrl(material.storage_path);
    if (!url) return;
    await removeOfflineAsset(url);
    setDownloaded((current) => ({ ...current, [material.id]: false }));
  }

  return (
              <li
                key={material.id}
                className="flex flex-col justify-between gap-4 border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <p className="font-bold">{material.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {material.academy_courses?.title
                      ? material.academy_courses.title
                      : material.lesson_id
                        ? "Lesson resource"
                        : "Course book"}{" "}
                    · {formatBytes(material.file_size_bytes)}
                  </p>
                </div>
                {url && (
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="button-primary w-fit"
                      href={url}
                      download={fileName(material.storage_path)}
                      rel="noreferrer"
                    >
                      Open
                    </a>
                    {downloaded[material.id] ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => removeMaterial(material)}
                      >
                        Remove download
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => downloadMaterial(material)}
                        disabled={downloading === material.id}
                      >
                        {downloading === material.id
                          ? "Downloading..."
                          : "Download for Offline"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Prefer to start where you left off?{" "}
        <Link className="text-cyan-600 dark:text-cyan-300" to="/academy/dashboard">
          Go to your dashboard
        </Link>
      </p>
    </div>
  );
}