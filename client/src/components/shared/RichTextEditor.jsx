import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import styles from "./RichTextEditor.module.css";

// Botón de la toolbar. A nivel de módulo (no dentro del render) para no crear
// un componente nuevo en cada render.
function ToolbarButton({ onClick, active, label, disabled, children }) {
  return (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.active : ""}`.trim()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={!!active}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/**
 * Editor WYSIWYG (Tiptap) para el cuerpo de las reseñas. Produce HTML que el
 * servidor sanitiza al guardar y `RichTextContent` re-sanitiza al renderizar.
 * El allow-list de marcas/nodos acá coincide con `utils/sanitizeConfig.js`.
 *
 * Props:
 *   value: string — HTML inicial.
 *   onChange(html): void — se llama en cada cambio.
 *   placeholder?: string
 *   disabled?: boolean
 *   maxLength?: number — tope de caracteres de texto plano (default 20000).
 */
export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Escribí tu reseña…",
  disabled = false,
  maxLength = 20000,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Nodos fuera del allow-list de sanitización: deshabilitados para que
        // el HTML guardado no contenga nada que el server vaya a strippear.
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value || "",
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: styles.prose,
        "data-placeholder": placeholder,
      },
      // Bloquear escritura más allá del tope (texto plano).
      handleKeyDown: (_view, event) => {
        if (!maxLength) return false;
        const len = editor?.getText().length ?? 0;
        const allowed = [
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Tab",
        ];
        if (
          len >= maxLength &&
          !allowed.includes(event.key) &&
          !event.metaKey
        ) {
          return true; // swallow
        }
        return false;
      },
    },
  });

  // Sincronizar si el value externo cambia (p. ej. al entrar en modo edición).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  const charCount = editor.getText().length;

  const setLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("URL del link:", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  // Subir una imagen al servidor (Cloudinary) e insertarla inline. Se sube
  // antes de que la compartida exista, así que usa un endpoint genérico.
  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const { data } = await axios.post(API.compartidas.INLINE_IMAGE, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      editor.chain().focus().setImage({ src: data.url }).run();
    } catch {
      window.alert("No se pudo subir la imagen.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Formato de texto"
      >
        <ToolbarButton
          label="Título"
          disabled={disabled}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Subtítulo"
          disabled={disabled}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </ToolbarButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolbarButton
          label="Negrita"
          disabled={disabled}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          label="Itálica"
          disabled={disabled}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <span className={styles.sep} aria-hidden="true" />
        <ToolbarButton
          label="Lista con viñetas"
          disabled={disabled}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          {"•≡"}
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          disabled={disabled}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          {"1."}
        </ToolbarButton>
        <ToolbarButton
          label="Cita"
          disabled={disabled}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          {"❝"}
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          disabled={disabled}
          active={editor.isActive("link")}
          onClick={setLink}
        >
          {"🔗"}
        </ToolbarButton>
        <ToolbarButton
          label="Imagen"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "…" : "🖼️"}
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          hidden
          aria-hidden="true"
          onChange={handleImageFile}
        />
      </div>
      <EditorContent editor={editor} className={styles.editorBox} />
      {maxLength ? (
        <div className={styles.counter}>
          {charCount} / {maxLength}
        </div>
      ) : null}
    </div>
  );
}
