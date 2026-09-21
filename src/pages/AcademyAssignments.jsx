import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAcademyAssignments } from "../lib/academy";

export default function AcademyAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [state, setState] = useState("loading");

  useEffect(() => {
    getAcademyAssignments().then(({ data, error, configured }) => {
      setAssignments(data ?? []);
      setState(error ? "error" : configured ? "ready" : "unconfigured");
    });
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          Your work
        </p>
        <h1 className="mt-2 text-3xl font-bold">Assignments</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Only assignments targeted to you or one of your classes appear here.
        </p>
      </header>
      {state === "loading" && <p>Loading assignments...</p>}
      {state === "unconfigured" && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Connect Supabase to load assignments.
        </p>
      )}
      {state === "error" && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700"
        >
          Assignments could not be loaded.
        </p>
      )}
      {state === "ready" && assignments.length === 0 && (
        <p className="rounded-xl border border-slate-200 p-5 text-sm dark:border-slate-800">
          No assignments yet.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {assignments.map((assignment) => (
          <Link
            key={assignment.id}
            to={`/academy/assignments/${assignment.id}`}
            className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              {assignment.points} points
            </p>
            <h2 className="mt-2 text-lg font-bold">{assignment.title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {assignment.due_at
                ? `Due ${new Date(assignment.due_at).toLocaleDateString()}`
                : "No due date"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
