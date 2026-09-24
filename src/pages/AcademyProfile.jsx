import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAcademySchools, updateAcademyStudentProfile } from "../lib/academy";
import { friendlyError } from "../lib/utils";
import {
  clearOfflineDownloads,
  estimateOfflineStorage,
  getOfflineRecords,
  OFFLINE_STORES,
} from "../lib/offlineStore";

export default function AcademyProfile() {
  const { user, profile, isAdmin, isTeacher } = useAcademyAuth();
  const accessLabel = isAdmin ? "Admin" : isTeacher ? "Teacher" : "Student";
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({
    displayName: "",
    schoolId: "",
    state: "",
    city: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [storage, setStorage] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [storageMessage, setStorageMessage] = useState("");
  useEffect(() => {
    setForm({
      displayName: profile?.display_name || "",
      schoolId: profile?.school_id || "",
      state: profile?.state || "",
      city: profile?.city || "",
    });
    getAcademySchools().then(({ data }) => setSchools(data ?? []));
  }, [profile]);
  useEffect(() => {
    void estimateOfflineStorage().then(setStorage);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    void getOfflineRecords(OFFLINE_STORES.metadata, user.id).then((records) => {
      setDownloads(
        records
          .filter(
            (record) =>
              record.id.startsWith("download:") && record.data.status === "ready",
          )
          .map((record) => ({ id: record.id, ...record.data })),
      );
    });
  }, [user?.id]);

  async function clearDownloads() {
    if (!user?.id) return;
    await clearOfflineDownloads(user.id);
    setStorageMessage("Downloaded learning content removed from this device.");
    setStorage(await estimateOfflineStorage());
    setDownloads([]);
  }

  async function save(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    const { error: saveError } = await updateAcademyStudentProfile(user.id, {
      display_name: form.displayName.trim(),
      school_id: form.schoolId || null,
      state: form.state,
      city: form.city.trim(),
    });
    if (saveError)
      setError(friendlyError(saveError, "Profile could not be updated."));
    else setMessage("Profile updated.");
  }
  return (
    <div className="max-w-2xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Your account
        </p>
        <h1 className="mt-2 text-3xl font-bold">Profile</h1>
      </header>
      <section className="border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-cyan-500 text-2xl font-bold text-slate-950">
            {(profile?.display_name || user?.email || "S")
              .charAt(0)
              .toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">
              {profile?.display_name || "Student"}
            </h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <form className="mt-8 space-y-4" onSubmit={save}>
          <label className="label">
            Full name
            <input
              className="field"
              value={form.displayName}
              onChange={(event) =>
                setForm({ ...form, displayName: event.target.value })
              }
              required
            />
          </label>
          <label className="label">
            School
            <select
              className="field"
              value={form.schoolId}
              onChange={(event) =>
                setForm({ ...form, schoolId: event.target.value })
              }
            >
              <option value="">Other or not listed</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} · {school.city}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            State
            <select
              className="field"
              value={form.state}
              onChange={(event) =>
                setForm({ ...form, state: event.target.value })
              }
              required
            >
              <option value="">Select state</option>
              <option>Plateau</option>
              <option>Kwara</option>
              <option>Lagos</option>
              <option>Abuja</option>
              <option>Other</option>
            </select>
          </label>
          <label className="label">
            City or location
            <input
              className="field"
              value={form.city}
              onChange={(event) =>
                setForm({ ...form, city: event.target.value })
              }
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm text-green-600">
              {message}
            </p>
          )}
          <button className="button-primary" type="submit">
            Save profile
          </button>
        </form>
        <dl className="mt-8 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">Role</dt>
            <dd className="mt-1 font-semibold">{accessLabel}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Academy Registration No.</dt>
            <dd className="mt-1 font-semibold tracking-[0.12em]">
              {profile?.academy_registration_codes?.registration_number || "Not assigned"}
            </dd>
          </div>
        </dl>
      </section>
      <section className="border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold">Offline Storage</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Downloaded course content is stored only on this device. Removing it does not remove server grades, submissions, or account data.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Used space: {storage ? `${(storage.usage / (1024 * 1024)).toFixed(1)} MB` : "Calculating..."}
        </p>
        {downloads.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {downloads.map((download) => (
              <li key={download.id} className="flex justify-between gap-3">
                <span>{download.scope === "week" ? "Downloaded week" : "Downloaded course"}</span>
                <span>{(download.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
              </li>
            ))}
          </ul>
        )}
        {storageMessage && <p role="status" className="mt-3 text-sm text-cyan-700">{storageMessage}</p>}
        <button type="button" className="button-secondary mt-4" onClick={clearDownloads}>
          Manage Downloads
        </button>
      </section>
      <Link className="button-secondary inline-flex" to="/academy/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}
