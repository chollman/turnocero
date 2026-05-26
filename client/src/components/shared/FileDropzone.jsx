import { useRef, useState } from "react";

// Componente genérico para drag/drop + file picker + keyboard a11y. Los
// wrappers (ComprobanteDropzone, ImageDropzone) inyectan el visual a través
// de children y un className propio (CSS Module local).
//
// children puede ser:
//   - ReactNode plano
//   - función ({ dragOver, hasFile }) => ReactNode (render-prop) para
//     decidir qué mostrar según estado
export default function FileDropzone({
  accept,
  onFile,
  ariaLabel,
  className,
  activeClassName = "",
  dragOverClassName = "",
  hasFile = false,
  children,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  function handleChange(e) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }

  const classes = [
    className,
    hasFile ? activeClassName : "",
    dragOver ? dragOverClassName : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rendered =
    typeof children === "function" ? children({ dragOver, hasFile }) : children;

  return (
    <div
      className={classes}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      aria-label={ariaLabel}
    >
      {rendered}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={handleChange}
      />
    </div>
  );
}
