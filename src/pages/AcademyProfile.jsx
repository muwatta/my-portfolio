import { useAcademyAuth } from "../hooks/useAcademyAuth";
import { useEffect, useState } from "react";
import {
  FiCheck,
  FiCloud,
  FiHash,
  FiMapPin,
  FiShield,
  FiUser,
} from "react-icons/fi";
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
  const [initialForm, setInitialForm] = useState({
    displayName: "",
    schoolId: "",
    state: "",
    city: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [schoolError, setSchoolError] = useState("");
  const [saving, setSaving] = useState(false);
  const [storage, setStorage] = useState(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [downloads, setDownloads] = useState([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const savedForm = {
      displayName: profile?.display_name || "",
      schoolId: profile?.school_id || "",
      state: profile?.state || "",
      city: profile?.city || "",
    };
    setForm(savedForm);
    setInitialForm(savedForm);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    getAcademySchools()
      .then(({ data, error: schoolsError }) => {
        if (cancelled) return;
        setSchools(data ?? []);
        if (schoolsError) {
          setSchoolError(
            friendlyError(schoolsError, "School choices could not be loaded."),
          );
        }
      })
      .catch((schoolsError) => {
        if (!cancelled) {
          setSchoolError(
            friendlyError(schoolsError, "School choices could not be loaded."),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    estimateOfflineStorage()
      .then((estimate) => {
        if (!cancelled) {
          setStorage(estimate);
          setStorageLoading(false);
        }
      })
      .catch((storageEstimateError) => {
        if (!cancelled) {
          setStorageLoading(false);
          setStorageError(
            friendlyError(
              storageEstimateError,
              "Device storage details are unavailable.",
            ),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    getOfflineRecords(OFFLINE_STORES.metadata, user.id)
      .then((records) => {
        if (cancelled) return;
        setDownloads(
          records
            .filter(
              (record) =>
                record.id.startsWith("download:") &&
                record.data.status === "ready",
            )
            .map((record) => ({ id: record.id, ...record.data })),
        );
      })
      .catch((recordsError) => {
        if (!cancelled) {
          setStorageError(
            friendlyError(
              recordsError,
              "Downloaded course details could not be loaded.",
            ),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const isDirty = Object.keys(form).some(
    (key) => form[key] !== initialForm[key],
  );
  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  };
  const selectSchool = (schoolId) => {
    const selectedSchool = schools.find((school) => school.id === schoolId);
    setForm((current) => ({
      ...current,
      schoolId,
      ...(selectedSchool
        ? { state: selectedSchool.state, city: selectedSchool.city }
        : {}),
    }));
    setMessage("");
    setError("");
  };

  async function clearDownloads() {
    if (!user?.id || downloads.length === 0) return;
    const confirmed = window.confirm(
      "Remove all downloaded course content from this device? You can download it again anytime.",
    );
    if (!confirmed) return;
    setClearing(true);
    setStorageMessage("");
    setStorageError("");
    try {
      await clearOfflineDownloads(user.id);
      setDownloads([]);
      setStorageMessage(
        "Downloaded learning content removed from this device.",
      );
      try {
        setStorage(await estimateOfflineStorage());
      } catch (storageEstimateError) {
        setStorageError(
          friendlyError(
            storageEstimateError,
            "Storage details could not be refreshed.",
          ),
        );
      }
    } catch (clearError) {
      setStorageError(
        friendlyError(clearError, "Downloaded content could not be removed."),
      );
    } finally {
      setClearing(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);
    const savedForm = {
      displayName: form.displayName.trim(),
      schoolId: form.schoolId,
      state: form.state,
      city: form.city.trim(),
    };
    try {
      const { error: saveError } = await updateAcademyStudentProfile(user.id, {
        display_name: savedForm.displayName,
        school_id: savedForm.schoolId || null,
        state: savedForm.state,
        city: savedForm.city,
      });
      if (saveError) {
        setError(friendlyError(saveError, "Profile could not be updated."));
      } else {
        setForm(savedForm);
        setInitialForm(savedForm);
        setMessage("Profile updated.");
      }
    } catch (saveError) {
      setError(friendlyError(saveError, "Profile could not be updated."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 text-white shadow-lg sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full border-[22px] border-amber-300/10" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-2xl font-extrabold text-slate-950 shadow-lg sm:h-16 sm:w-16">
            {(form.displayName || user?.email || "S")
              .charAt(0)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-amber-200">
              <FiUser aria-hidden="true" />
              Your player card
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
              {form.displayName || "Student"}
            </h1>
            <p className="mt-1 break-all text-sm text-slate-300">
              {user?.email}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-xs font-semibold text-white">
                <FiShield aria-hidden="true" />
                {accessLabel}
              </span>
              {profile?.academy_registration_codes?.registration_number && (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100">
                  <FiHash aria-hidden="true" />
                  {profile.academy_registration_codes.registration_number}
                </span>
              )}
              {!profile?.academy_registration_codes?.registration_number && (
                <span className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/10 px-3 text-xs font-semibold text-slate-200">
                  Registration not assigned
                </span>
              )}
              {(profile?.city || profile?.state) && (
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 text-xs font-semibold text-white">
                  <FiMapPin aria-hidden="true" />
                  {[profile.city, profile.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
            {profile?.academy_registration_codes?.registration_number &&
              profile.academy_registration_codes.status !== "claimed" && (
                <p className="mt-2 text-xs text-amber-200">
                  Registration is provisional and pending administrator
                  acceptance.
                </p>
              )}
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
              Your details
            </p>
            <h2 className="mt-1 text-xl font-bold">Keep your profile current</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Make sure your school and location are up to date.
            </p>
          </div>
          {isDirty && (
            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Unsaved
            </span>
          )}
        </div>

        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={save}>
          <label className="label sm:col-span-2">
            Full name
            <input
              className="field"
              value={form.displayName}
              onChange={(event) =>
                updateField("displayName", event.target.value)
              }
              autoComplete="name"
              required
            />
          </label>
          <label className="label">
            School
            <select
              className="field"
              value={form.schoolId}
              onChange={(event) => selectSchool(event.target.value)}
            >
              <option value="">Other or not listed</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                  {school.city ? ` · ${school.city}` : ""}
                </option>
              ))}
            </select>
          </label>
          {schoolError && (
            <p
              role="status"
              className="text-sm text-amber-800 sm:col-span-2 dark:text-amber-300"
            >
              {schoolError} You can still save the rest of your profile.
            </p>
          )}
          <label className="label">
            State
            <select
              className="field"
              value={form.state}
              onChange={(event) => updateField("state", event.target.value)}
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
              onChange={(event) => updateField("city", event.target.value)}
              autoComplete="address-level2"
              required
            />
          </label>
          {error && (
            <p
              role="alert"
              className="text-sm text-red-600 sm:col-span-2 dark:text-red-400"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="text-sm text-emerald-600 sm:col-span-2 dark:text-emerald-400"
            >
              {message}
            </p>
          )}
          <button
            className="button-primary inline-flex w-full items-center justify-center gap-2 sm:w-auto"
            type="submit"
            disabled={saving || !isDirty}
          >
            {saving ? "Saving..." : message ? <FiCheck aria-hidden="true" /> : null}
            {saving ? "Saving profile" : message ? "Saved" : "Save profile"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3 border-b border-slate-200 p-4 sm:p-6 dark:border-slate-800">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
            <FiCloud aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
              Your device
            </p>
            <h2 className="mt-1 text-xl font-bold">Offline learning</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Saved course content stays on this device. Clearing downloads
              does not affect grades, submissions, or account data.
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Storage used
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums">
                {storage
                  ? `${(storage.usage / (1024 * 1024)).toFixed(1)} MB`
                  : storageLoading
                    ? "Checking..."
                    : "Unavailable"}
              </p>
              {storage?.quota > 0 && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  of {(storage.quota / (1024 * 1024)).toFixed(0)} MB available
                </p>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Downloaded items
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums">
                {downloads.length}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Courses and weeks ready offline
              </p>
            </div>
          </div>

          {downloads.length > 0 ? (
            <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 px-4 text-sm text-slate-600 dark:divide-slate-800 dark:border-slate-800 dark:text-slate-300">
              {downloads.map((download) => (
                <li
                  key={download.id}
                  className="flex min-h-11 items-center justify-between gap-3 py-2"
                >
                  <span>
                    {download.scope === "week"
                      ? "Downloaded week"
                      : "Downloaded course"}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {(download.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
              No course content downloaded yet. Save a course or week from the
              Learn page to study without a connection.
            </p>
          )}

          {storageError && (
            <p
              role="alert"
              className="mt-4 text-sm text-red-700 dark:text-red-300"
            >
              {storageError}
            </p>
          )}
          {storageMessage && (
            <p
              role="status"
              className="mt-4 text-sm text-emerald-700 dark:text-emerald-300"
            >
              {storageMessage}
            </p>
          )}

          <button
            type="button"
            className="button-secondary mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            onClick={clearDownloads}
            disabled={downloads.length === 0 || clearing}
          >
            {clearing ? "Removing downloads..." : "Clear downloaded content"}
          </button>
        </div>
      </section>
    </div>
  );
}
