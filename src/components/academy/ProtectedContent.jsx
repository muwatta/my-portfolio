export default function ProtectedContent({ children, className = "" }) {
  const preventCopy = (event) => event.preventDefault();
  const preventCopyShortcut = (event) => {
    if ((event.ctrlKey || event.metaKey) && ["c", "x"].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
  };

  return (
    <div
      className={`select-none ${className}`.trim()}
      contentEditable={false}
      onCopy={preventCopy}
      onCut={preventCopy}
      onContextMenu={preventCopy}
      onDragStart={preventCopy}
      onKeyDown={preventCopyShortcut}
    >
      {children}
    </div>
  );
}
