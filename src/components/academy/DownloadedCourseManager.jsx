import { useState } from "react";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import {
  getAcademyAssignment,
  getAcademyAssignments,
  getAcademyCourseMaterials,
  getAcademyExercises,
  getAcademyLessons,
  getAcademyStudentOverview,
} from "../../lib/academy";
import { cacheAcademySnapshot } from "../../lib/academyOffline";
import { OFFLINE_STORES } from "../../lib/offlineStore";

const formatBytes = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const bytesFor = (value) => {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return JSON.stringify(value).length;
  }
};

export default function DownloadedCourseManager({ course, week }) {
  const { user } = useAcademyAuth();
  const [status, setStatus] = useState("idle");
  const [notice, setNotice] = useState("");
  const [size, setSize] = useState("");
  const label = week ? `Download Week ${week.week_number}` : "Download for Offline Use";
  const approximateSize = week
    ? `${Math.max(1, Math.ceil((week.lessons?.length || 1) * 0.02))} MB estimated before download.`
    : "Approximate size is calculated after content is prepared.";

  async function download() {
    if (!course?.id || !user?.id) return;
    setStatus("downloading");
    setNotice("Preparing offline content...");
    try {
      const [lessonsOutcome, exercisesOutcome, assignmentsOutcome, overviewOutcome, materialsOutcome] =
        await Promise.allSettled([
          getAcademyLessons(user.id),
          getAcademyExercises(user.id),
          getAcademyAssignments(user.id),
          getAcademyStudentOverview(user.id),
          getAcademyCourseMaterials(course.id),
        ]);
      if (lessonsOutcome.status === "rejected" || lessonsOutcome.value?.error) {
        throw (
          lessonsOutcome.value?.error ??
          new Error("Lessons could not be loaded. Check your connection and try again.")
        );
      }
      const lessonsResult = lessonsOutcome.value;
      const exercisesResult =
        exercisesOutcome.status === "fulfilled" ? exercisesOutcome.value : { data: [] };
      const assignmentsResult =
        assignmentsOutcome.status === "fulfilled" ? assignmentsOutcome.value : { data: [] };
      const overviewResult =
        overviewOutcome.status === "fulfilled" ? overviewOutcome.value : { data: null };
      const materialsResult =
        materialsOutcome.status === "fulfilled" ? materialsOutcome.value : { data: [] };
      const lessons = week
        ? (lessonsResult.data ?? []).filter(
            (lesson) => lesson.academy_weeks?.week_number === week.week_number,
          )
        : lessonsResult.data ?? [];
      const assignmentDetails = await Promise.allSettled(
        (assignmentsResult.data ?? []).map((assignment) =>
          getAcademyAssignment(assignment.id),
        ),
      );
      const assignments = assignmentDetails
        .map((outcome, index) =>
          outcome.status === "fulfilled" && outcome.value?.data
            ? outcome.value.data
            : assignmentsResult.data[index],
        )
        .filter(Boolean);
      const payload = {
        course,
        week: week ?? null,
        lessons,
        exercises: exercisesResult.data ?? [],
        assignments,
        materials: materialsResult.data ?? [],
        downloadedAt: new Date().toISOString(),
      };
       const id = week ? `week:${course.id}:${week.week_number}` : `course:${course.id}`;
       const sizeBytes = bytesFor(payload);
       setSize(`${formatBytes(sizeBytes)} of learning content`);
       await cacheAcademySnapshot(
         userIdForDownload,
         OFFLINE_STORES.metadata,
         `download:${id}`,
         { status: "preparing", sizeBytes, scope: week ? "week" : "course" },
       );
       await Promise.all([
         cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.courses, id, payload),
         cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.courses, "list:courses", [course]),
        cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.progress, "overview", overviewResult.data ?? null),
        cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.lessons, "list:lessons", lessonsResult.data ?? []),
        cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.exercises, "list:exercises", exercisesResult.data ?? []),
        cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.assignments, "list:assignments", assignments),
        cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.materials, "list:materials", materialsResult.data ?? []),
        ...payload.lessons.map((lesson) =>
          cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.lessons, lesson.id, lesson),
        ),
        ...payload.exercises.map((exercise) =>
          cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.exercises, exercise.id, exercise),
        ),
        ...payload.assignments.map((assignment) =>
          cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.assignments, assignment.id, assignment),
        ),
        cacheAcademySnapshot(userIdForDownload, OFFLINE_STORES.metadata, `download:${id}`, {
           sizeBytes: bytesFor(payload),
           downloadedAt: payload.downloadedAt,
           scope: week ? "week" : "course",
           status: "ready",
        }),
      ]);
      setStatus("ready");
      setNotice("Available offline on this device.");
    } catch (error) {
      setStatus("error");
      setNotice(
        error?.message ||
          "This course could not be downloaded. Check your connection and try again.",
      );
    }
  }

  const userIdForDownload = user?.id;
  if (!userIdForDownload) return null;

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        className="button-secondary w-full justify-center"
        onClick={download}
        disabled={status === "downloading"}
      >
        {status === "downloading" ? "Preparing download..." : label}
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {status === "downloading" ? "Downloading lessons, practice, and assignments." : size || approximateSize}
      </p>
      {notice && (
        <p role="status" className="text-xs text-slate-600 dark:text-slate-300">
          {notice}
        </p>
      )}
    </div>
  );
}
