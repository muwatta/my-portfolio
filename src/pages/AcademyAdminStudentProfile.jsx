import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminDeleteAcademyUser,
  adminUpdateAcademyUser,
  getAcademyStudentProfile,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

export default function AcademyAdminStudentProfile() {
  const { studentId } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", email: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getAcademyStudentProfile(studentId).then(({ data: result, error }) => {
      setData(result);
      setState(error ? "error" : "ready");
    });
  }, [studentId]);
  const profile = data?.profile;
  const overview = data?.overview;
  return (
    <div className="max-w-3xl space-y-8">
      <Link
        className="text-sm font-semibold text-blue-600"
        to="/academy/admin/students"
      >
        ← All students
      </Link>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Student profile
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {profile?.display_name || "Student"}
        </h1>
      </header>
      {state === "loading" && <p>Loading profile...</p>}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Student profile could not be loaded.
        </p>
      )}
      {state === "ready" && (
        <>
          {message && (
            <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              {message}
            </p>
          )}
          {error && (
            <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </p>
          )}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-bold">Account</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Correct a name or change the email a student signs in with. Changing
              the address frees the old one. Deleting the account removes the
              student, their enrollments and their results, and frees the address
              so they can register again.
            </p>
            {editing ? (
              <form
                className="mt-4 space-y-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusy(true);
                  setError("");
                  const result = await adminUpdateAcademyUser(studentId, {
                    display_name: form.display_name,
                    ...(form.email ? { email: form.email } : {}),
                  });
                  setBusy(false);
                  if (result.error) {
                    setError(friendlyError(result.error, "The account could not be updated."));
                    return;
                  }
                  setEditing(false);
                  setMessage("Account updated.");
                  getAcademyStudentProfile(studentId).then(({ data: fresh }) =>
                    setData(fresh),
                  );
                }}
              >
                <label className="label">
                  Name
                  <input
                    className="field"
                    value={form.display_name}
                    onChange={(event) =>
                      setForm((c) => ({ ...c, display_name: event.target.value }))
                    }
                    required
                  />
                </label>
                <label className="label">
                  Email address
                  <input
                    className="field"
                    type="email"
                    value={form.email}
                    placeholder={profile?.email || "student@example.com"}
                    onChange={(event) =>
                      setForm((c) => ({ ...c, email: event.target.value }))
                    }
                  />
                  <span className="text-xs text-slate-500">
                    Leave empty to keep the current address.
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <button className="button-primary" type="submit" disabled={busy}>
                    {busy ? "Saving..." : "Save account"}
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setError("");
                    setEditing(true);
                    setForm({
                      display_name: profile?.display_name ?? "",
                      email: "",
                    });
                  }}
                >
                  Edit account
                </button>
                <button
                  className="button-secondary text-rose-600"
                  type="button"
                  onClick={() => {
                    setError("");
                    setDeleteOpen(true);
                  }}
                >
                  Delete account
                </button>
              </div>
            )}
          </section>

          {deleteOpen && (
            <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-6 dark:border-rose-800 dark:bg-rose-950/30">
              <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200">
                Delete this account?
              </h2>
              <p className="mt-2 text-sm text-rose-900 dark:text-rose-200">
                {profile?.display_name} loses access immediately. Their
                enrollments, submissions and results are removed, and the email
                address is freed so they can register again. This cannot be
                undone.
              </p>
              <label className="label mt-4">
                Reason
                <input
                  className="field"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="For example: duplicate registration"
                  required
                />
                <span className="text-xs text-rose-700 dark:text-rose-300">
                  Recorded against the deletion.
                </span>
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="button-primary"
                  type="button"
                  disabled={busy || !reason.trim()}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    const result = await adminDeleteAcademyUser(studentId, reason);
                    setBusy(false);
                    if (result.error) {
                      setError(
                        friendlyError(result.error, "The account could not be deleted."),
                      );
                      return;
                    }
                    setDeleteOpen(false);
                    setMessage("Account deleted. The address can be registered again.");
                    getAcademyStudentProfile(studentId).then(({ data: fresh }) => {
                      setData(fresh);
                      setState("error");
                    });
                  }}
                >
                  {busy ? "Deleting..." : "Yes, delete this account"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setReason("");
                  }}
                >
                  Keep the account
                </button>
              </div>
            </section>
          )}
          <section className="grid gap-4 sm:grid-cols-2">
             <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
               <p className="text-sm text-slate-500">Academy Registration No.</p>
               <p className="mt-2 text-xl font-bold tracking-[0.1em]">
                 {profile?.academy_registration_codes?.registration_number || "Not assigned"}
               </p>
             </div>
             <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
               <p className="text-sm text-slate-500">Current course</p>
              <p className="mt-2 text-xl font-bold">
                {profile?.academy_courses?.title ||
                  overview?.enrollment?.academy_courses?.title ||
                  "Unassigned"}
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Enrollment</p>
              <p className="mt-2 text-xl font-bold">
                {overview?.enrollment?.academy_courses?.title || "Not enrolled"}
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">School and location</p>
              <p className="mt-2 text-xl font-bold">
                {profile?.academy_schools?.name || "Other"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {profile?.city || "Location not set"},{" "}
                {profile?.state || "State not set"}
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Learning time</p>
              <p className="mt-2 text-xl font-bold">
                {Math.floor((overview?.learningSeconds || 0) / 60)} min
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Server-recorded Academy time
              </p>
            </div>
            <div className="border-l-4 border-cyan-400 bg-white p-5 dark:bg-slate-900">
              <p className="text-sm text-slate-500">Badges</p>
              <p className="mt-2 text-xl font-bold">
                {overview?.badges?.length || 0}
              </p>
            </div>
          </section>
          <section className="border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-bold">Recent scheduled activity</h2>
            {overview?.schedules?.length ? (
              <ul className="mt-4 space-y-2">
                {overview.schedules.map((item) => (
                  <li key={item.id} className="text-sm">
                    {item.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No upcoming activity.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
