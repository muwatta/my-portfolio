function CodeBlock({ code }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
      <code>{code}</code>
    </pre>
  );
}

export default function LessonContent({ content = {} }) {
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
    </div>
  );
}
