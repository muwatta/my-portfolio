import { useState } from "react";

function CodeBlock({ code }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
      <code>{code}</code>
    </pre>
  );
}

export default function LessonContent({ content = {} }) {
  const [visibleHintCount, setVisibleHintCount] = useState(0);
  const hints = Array.isArray(content.hints) ? content.hints : [];

  return (
    <div className="space-y-6 text-[15px] leading-7 text-slate-700 dark:text-slate-200">
      {content.explanation && <p>{content.explanation}</p>}
      {Array.isArray(content.paragraphs) &&
        content.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      {Array.isArray(content.examples) &&
        content.examples.map((example) => (
          <CodeBlock key={example} code={example} />
        ))}
      {Array.isArray(content.activities) && (
        <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-900 dark:bg-cyan-950/30">
          <h2 className="font-bold text-slate-900 dark:text-white">Try this</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {content.activities.map((activity) => (
              <li key={activity}>{activity}</li>
            ))}
          </ul>
        </section>
      )}
      {content.connection && (
        <section>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Why this matters for AI/ML
          </h2>
          <p className="mt-2">{content.connection}</p>
        </section>
      )}
      {content.skills?.length > 0 && (
        <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Skills to practise
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {content.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}
      {content.project && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Build challenge
          </h2>
          <p className="mt-2">{content.project}</p>
        </section>
      )}
      {hints.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-bold text-slate-900 dark:text-white">
            Need a hint?
          </h2>
          {visibleHintCount > 0 && (
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              {hints.slice(0, visibleHintCount).map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ol>
          )}
          <button
            type="button"
            className="button-secondary mt-4"
            onClick={() =>
              setVisibleHintCount((count) => Math.min(count + 1, hints.length))
            }
            disabled={visibleHintCount >= hints.length}
          >
            {visibleHintCount >= hints.length
              ? "All hints shown"
              : visibleHintCount === 0
                ? "Show first hint"
                : "Show next hint"}
          </button>
        </section>
      )}
      {content.challenge && (
        <section className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900 dark:bg-violet-950/30">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Challenge
          </h2>
          <p className="mt-2">{content.challenge}</p>
        </section>
      )}
      {content.reflection && (
        <section className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Reflect
          </h2>
          <p className="mt-2">{content.reflection}</p>
        </section>
      )}
    </div>
  );
}
