import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API } from "../../api/endpoints";
import styles from "./RichTextEditor.module.css";
import {
  YoutubeEmbed,
  TextAlign,
  extractYoutubeId,
} from "./noticiaEditorExtensions";

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
 * Editor WYSIWYG (Tiptap) para cuerpos enriquecidos. Produce HTML que el
 * servidor sanitiza al guardar y `RichTextContent` re-sanitiza al renderizar.
 * El allow-list de marcas/nodos acá coincide con `utils/sanitizeConfig.js`.
 *
 * Props:
 *   value: string — HTML inicial.
 *   onChange(html): void — se llama en cada cambio.
 *   placeholder?: string
 *   disabled?: boolean
 *   maxLength?: number — tope de caracteres de texto plano (default 20000).
 *   uploadUrl?: string — endpoint multipart para imágenes inline
 *                        (default: reseñas de Compartidas).
 *   extended?: boolean — habilita H4, separador, código, alineación, YouTube y
 *                        drag-drop/paste de imágenes (modo Noticias).
 */
export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Escribí tu reseña…",
  disabled = false,
  maxLength = 20000,
  uploadUrl = API.compartidas.INLINE_IMAGE,
  extended = false,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);

  // Sube un archivo de imagen a Cloudinary y devuelve la URL (o null).
  const uploadImage = async (file) => {
    if (!file || uploadingRef.current) return null;
    uploadingRef.current = true;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const { data } = await axios.post(uploadUrl, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.url;
    } catch {
      window.alert("No se pudo subir la imagen.");
      return null;
    } finally {
      uploadingRef.current = false;
      setUploading(false);
    }
  };

  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: extended ? [2, 3, 4] : [2, 3] },
        // En modo reseña, nodos fuera del allow-list quedan deshabilitados. En
        // modo extendido (Noticias) habilitamos código, bloque de código y regla.
        codeBlock: extended ? undefined : false,
        code: extended ? undefined : false,
        horizontalRule: extended ? undefined : false,
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
      ...(extended
        ? [
            TextAlign.configure({ types: ["paragraph", "heading"] }),
            YoutubeEmbed,
          ]
        : []),
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
      // Drag-drop de imágenes (solo modo extendido).
      handleDrop: extended
        ? (view, event) => {
            const file = event.dataTransfer?.files?.[0];
            if (!file || !file.type.startsWith("image/")) return false;
            event.preventDefault();
            const coords = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            uploadImage(file).then((url) => {
              if (!url || !editor) return;
              const pos = coords?.pos ?? editor.state.selection.from;
              editor
                .chain()
                .focus()
                .insertContentAt(pos, {
                  type: "image",
                  attrs: { src: url },
                })
                .run();
            });
            return true;
          }
        : undefined,
      // Paste de imágenes desde el portapapeles (solo modo extendido).
      handlePaste: extended
        ? (_view, event) => {
            const file = [...(event.clipboardData?.files || [])].find((f) =>
              f.type.startsWith("image/"),
            );
            if (!file) return false;
            event.preventDefault();
            uploadImage(file).then((url) => {
              if (url && editor)
                editor.chain().focus().setImage({ src: url }).run();
            });
            return true;
          }
        : undefined,
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

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const url = await uploadImage(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  const addYoutube = () => {
    const url = window.prompt("Pegá el link del video de YouTube:");
    if (!url) return;
    const id = extractYoutubeId(url);
    if (!id) {
      window.alert("No reconocí ese link de YouTube.");
      return;
    }
    editor.chain().focus().setYoutubeVideo(id).run();
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
        {extended && (
          <ToolbarButton
            label="Subtítulo menor"
            disabled={disabled}
            active={editor.isActive("heading", { level: 4 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 4 }).run()
            }
          >
            H4
          </ToolbarButton>
        )}
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
        {extended && (
          <ToolbarButton
            label="Código"
            disabled={disabled}
            active={editor.isActive("code")}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            {"</>"}
          </ToolbarButton>
        )}
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
        {extended && (
          <>
            <ToolbarButton
              label="Separador"
              disabled={disabled}
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
              {"―"}
            </ToolbarButton>
            <span className={styles.sep} aria-hidden="true" />
            <ToolbarButton
              label="Alinear a la izquierda"
              disabled={disabled}
              active={editor.isActive({ textAlign: "left" })}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
            >
              {"⬅"}
            </ToolbarButton>
            <ToolbarButton
              label="Centrar"
              disabled={disabled}
              active={editor.isActive({ textAlign: "center" })}
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
            >
              {"↔"}
            </ToolbarButton>
            <ToolbarButton
              label="Alinear a la derecha"
              disabled={disabled}
              active={editor.isActive({ textAlign: "right" })}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
            >
              {"➡"}
            </ToolbarButton>
          </>
        )}
        <span className={styles.sep} aria-hidden="true" />
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
        {extended && (
          <ToolbarButton
            label="Video de YouTube"
            disabled={disabled}
            onClick={addYoutube}
          >
            {"▶"}
          </ToolbarButton>
        )}
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
