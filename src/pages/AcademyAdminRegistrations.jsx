import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  assignAcademyRegistrationCode,
  generateAcademyRegistrationCodes,
  getAcademyRegistrationCodes,
  getAcademyTeacherStudents,
  reassignAcademyRegistrationCode,
  suspendAcademyRegistrationCode,
} from "../lib/academy";
import { friendlyError } from "../lib/utils";

const emptyForm = {
  year: String(new Date().getFullYear()),
  count: "20",
  studentId: "",
  registrationNumber: "",
  replacementNumber: "",
  reason: "",
};

export default function AcademyAdminRegistrations() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [generated, setGenerated] = useState([]);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [registrationResult, studentResult] = await Promise.all([
      getAcademyRegistrationCodes(search, status),
      getAcademyTeacherStudents(),
    ]);
    setRows(registrationResult.data ?? []);
    setStudents(studentResult.data?.students ?? []);
    setError(
      [registrationResult.error, studentResult.error].filter(Boolean)[0] ?? "",
    );
    setLoading(false);
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const requestedStudent = searchParams.get("student");
    if (requestedStudent) {
      setForm((current) => ({ ...current, studentId: requestedStudent }));
    }
  }, [searchParams]);

  const selectedStudent = students.find(
    (student) => student.id === form.studentId,
  );
  const selectedRegistration = selectedStudent
    ? rows.find(
        (row) => row.student_id === selectedStudent.id,
      )?.registration_number ?? selectedStudent.academy_registration_codes?.registration_number
    : "";
  const filteredStudents = useMemo(() => {
    const query = form.studentId ? "" : form.registrationNumber.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) =>
      `${student.display_name || ""} ${student.id}`.toLowerCase().includes(query),
    );
  }, [form.registrationNumber, form.studentId, students]);
  const counts = useMemo(
    () => ({
      all: rows.length,
      available: rows.filter((row) => row.status === "available").length,
      claimed: rows.filter((row) => row.status === "claimed").length,
      suspended: rows.filter((row) => row.status === "suspended").length,
    }),
    [rows],
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const result = await generateAcademyRegistrationCodes(form.year, form.count);
    if (result.error) {
      setError(friendlyError(result.error, "Registration numbers could not be generated."));
      setGenerated([]);
    } else {
      setGenerated(result.data ?? []);
      setMessage(`${result.data?.length ?? 0} registration numbers generated.`);
      await load();
    }
    setSaving(false);
  }

  async function handleAssign(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const result = await assignAcademyRegistrationCode(
      form.studentId,
      form.registrationNumber,
    );
    if (result.error) {
      setError(friendlyError(result.error, "Registration number could not be assigned."));
    } else {
      setMessage("Registration number assigned successfully.");
      setForm((current) => ({ ...current, registrationNumber: "" }));
      await load();
    }
    setSaving(false);
  }

  async function handleReassign(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const result = await reassignAcademyRegistrationCode({
      studentId: form.studentId,
      oldRegistrationNumber: selectedRegistration,
      newRegistrationNumber: form.replacementNumber,
      reason: form.reason,
    });
    if (result.error) {
      setError(friendlyError(result.error, "Registration number could not be reassigned."));
    } else {
      setMessage("Registration number reassigned and audited.");
      setForm((current) => ({ ...current, replacementNumber: "", reason: "" }));
      await load();
    }
    setSaving(false);
  }

  async function handleSuspend(event) {
    event.preventDefault();
    if (!suspendTarget) return;
    setSaving(true);
    setMessage("");
    setError("");
    const result = await suspendAcademyRegistrationCode(
      suspendTarget.registration_number,
      form.reason,
    );
    if (result.error) {
      setError(friendlyError(result.error, "Registration number could not be suspended."));
    } else {
      setMessage(`${suspendTarget.registration_number} suspended.`);
      setSuspendTarget(null);
      setForm((current) => ({ ...current, reason: "" }));
      await load();
    }
    setSaving(false);
  }

  async function copyGenerated() {
    const text = generated.map((item) => item.registration_number).join("\n");
    if (navigator.clipboard) await navigator.clipboard.writeText(text);
    setMessage("Generated registration numbers copied to the clipboard.");
  }

  function downloadGenerated() {
    const text = generated.map((item) => item.registration_number).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `academy-registration-${form.year}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            Admin control center
          </p>
          <h1 className="mt-2 text-3xl font-bold">Registration numbers</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Generate, assign, and audit permanent Academy student identities.
          </p>
        </div>
        <Link className="button-secondary inline-flex" to="/academy/admin/students">
          Back to students
        </Link>
      </header>

      {(message || error) && (
        <p
          role={error ? "alert" : "status"}
          className={`rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
        >
          {error || message}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          ["Total", counts.all],
          ["Available", counts.available],
          ["Claimed", counts.claimed],
          ["Suspended", counts.suspended],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleGenerate} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold">Generate numbers</h2>
            <p className="mt-1 text-sm text-slate-500">New numbers continue after the highest serial already issued for the year.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="label">
              Registration Year
              <input className="field" type="number" min="2000" max="2099" value={form.year} onChange={(event) => updateForm("year", event.target.value)} required />
            </label>
            <label className="label">
              Number to Generate
              <input className="field" type="number" min="1" max="999" value={form.count} onChange={(event) => updateForm("count", event.target.value)} required />
            </label>
          </div>
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? "Generating..." : "Generate Registration Numbers"}
          </button>
          {generated.length > 0 && (
            <div className="rounded-xl bg-slate-950 p-4 text-sm text-slate-100">
              <p className="font-semibold text-cyan-300">Generated numbers</p>
              <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap">{generated.map((item) => item.registration_number).join("\n")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="button-secondary" type="button" onClick={copyGenerated}>Copy list</button>
                <button className="button-secondary" type="button" onClick={downloadGenerated}>Export list</button>
              </div>
            </div>
          )}
        </form>

        <form onSubmit={handleAssign} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold">Assign to an existing student</h2>
            <p className="mt-1 text-sm text-slate-500">Assignment changes only the identity link; the student's course, level, and learning records stay intact.</p>
          </div>
          <label className="label">
            Student
            <select className="field" value={form.studentId} onChange={(event) => updateForm("studentId", event.target.value)} required>
              <option value="">Select a student</option>
              {filteredStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.display_name || "Unnamed student"} · {student.academy_registration_codes?.registration_number || "Unassigned"}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Registration Number
            <input className="field uppercase" placeholder="ATE-26-001" value={form.registrationNumber} onChange={(event) => updateForm("registrationNumber", event.target.value.toUpperCase())} required />
          </label>
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? "Assigning..." : "Assign Registration Number"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Registration directory</h2>
            <p className="mt-1 text-sm text-slate-500">Search by registration number, student name, or email.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input className="field min-w-64" aria-label="Search registration numbers" placeholder="Search registration numbers..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="field" aria-label="Filter registration status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="available">Available</option>
              <option value="claimed">Claimed</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
        {loading ? <p className="mt-5 text-sm text-slate-500">Loading registration numbers...</p> : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Registration No.</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.registration_number}>
                    <td className="px-4 py-3 font-semibold tracking-[0.1em]">{row.registration_number}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "available" ? "bg-emerald-100 text-emerald-800" : row.status === "claimed" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{row.status}</span></td>
                    <td className="px-4 py-3">{row.student_name || "Not assigned"}</td>
                    <td className="px-4 py-3">{row.student_email || "Not available"}</td>
                    <td className="px-4 py-3">{row.course_title || "Not assigned"}</td>
                    <td className="px-4 py-3">{new Date(row.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{row.status !== "suspended" ? <button className="font-semibold text-red-600" type="button" onClick={() => setSuspendTarget(row)}>Suspend</button> : "Suspended"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="mt-5 text-sm text-slate-500">No registration numbers match these filters.</p>}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
        <h2 className="text-xl font-bold">Controlled changes</h2>
        {selectedStudent && selectedRegistration ? (
          <form onSubmit={handleReassign} className="mt-4 grid gap-4 lg:grid-cols-4">
            <p className="text-sm lg:col-span-4">Selected student: <strong>{selectedStudent.display_name || "Unnamed student"}</strong> · Current number: <strong>{selectedRegistration}</strong></p>
            <label className="label">New Registration Number<input className="field uppercase" value={form.replacementNumber} onChange={(event) => updateForm("replacementNumber", event.target.value.toUpperCase())} required /></label>
            <label className="label">Reason<input className="field" value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} required /></label>
            <div className="flex items-end"><button className="button-secondary" type="submit" disabled={saving}>Reassign with audit</button></div>
          </form>
        ) : (
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">Select a claimed student above to review the explicit reassignment workflow.</p>
        )}
      </section>

      {suspendTarget && (
        <form onSubmit={handleSuspend} className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <h2 className="text-xl font-bold text-red-900 dark:text-red-100">Suspend {suspendTarget.registration_number}</h2>
          <label className="label mt-4 text-red-900 dark:text-red-100">Reason<input className="field" value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} required /></label>
          <div className="mt-4 flex gap-3">
            <button className="button-secondary" type="submit" disabled={saving}>Confirm suspension</button>
            <button className="button-secondary" type="button" onClick={() => setSuspendTarget(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
