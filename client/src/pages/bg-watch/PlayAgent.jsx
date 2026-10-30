import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/shared/Modal";
import { useNotifications } from "../../context/NotificationContext";
import { useLanguage } from "../../hooks/useLanguage";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import { sendPlayAgentMessage } from "../../queries/bgWatch";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { STORAGE_KEYS } from "../../utils/storageKeys";
import { draftToFormValues } from "./draftToFormValues";
import styles from "./PlayAgent.module.css";

// Agente de carga de partidas (BG Watch): burbuja flotante en la pantalla de
// cargar partida + panel de conversación por texto o voz. El agente arma un
// borrador y `onDraft` lo vuelca en PlayForm; el usuario revisa y guarda como
// siempre (el agente nunca guarda).
//
// Props:
//   getFormContext()  lo que ya tiene el form (juego/fecha/jugadores), se manda
//                     solo con el primer mensaje
//   formDirty         el usuario ya empezó a completar el form a mano → la
//                     burbuja no ofrece la sugerencia (queda solo el ícono)
//   onDraft(values)   initialValues para PlayForm (de draftToFormValues)

const MAX_DISMISSALS = 3;

function readDismissals() {
  try {
    return (
      Number(localStorage.getItem(STORAGE_KEYS.PLAY_AGENT_DISMISSALS)) || 0
    );
  } catch {
    return 0;
  }
}
function writeDismissals(n) {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAY_AGENT_DISMISSALS, String(n));
  } catch {
    /* storage no disponible: la sugerencia vuelve a aparecer, no es grave */
  }
}

function joinText(a, b) {
  return [a.trim(), b.trim()].filter(Boolean).join(" ");
}

function SparkIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.4l-1.8-4.9L5 9.7l5.2-1.8L12 3z"
        fill="currentColor"
      />
      <path
        d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 11a7 7 0 0014 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12l16-8-6 16-2.5-6.5L4 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PlayAgent({
  getFormContext,
  formDirty = false,
  onDraft,
}) {
  const { t } = useTranslation("bgwatch");
  const { lang } = useLanguage();
  const { addToast } = useNotifications();

  const [open, setOpen] = useState(false);
  const [calloutClosed, setCalloutClosed] = useState(
    () => readDismissals() >= MAX_DISMISSALS,
  );
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [turnsLeft, setTurnsLeft] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [draftApplied, setDraftApplied] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  // Pregunta con opciones que espera respuesta ({ text, kind, options }) y, si
  // el usuario tocó "Otro", de qué tipo era (para el placeholder del input).
  const [question, setQuestion] = useState(null);
  const [otherKind, setOtherKind] = useState(null);
  // Texto que había en el input al empezar a dictar: el dictado se suma a eso.
  const [speechBase, setSpeechBase] = useState("");

  const handleSpeechEnd = useCallback(
    (text) => {
      if (text) setInput(joinText(speechBase, text));
    },
    [speechBase],
  );
  const speech = useSpeechInput({ lang, onEnd: handleSpeechEnd });
  const shownInput = speech.listening
    ? joinText(speechBase, speech.transcript)
    : input;

  // Bajar al último mensaje.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const closeCallout = () => {
    setCalloutClosed(true);
    writeDismissals(readDismissals() + 1);
  };

  // Estable a propósito: Modal re-ejecuta su efecto de foco si onClose cambia,
  // y eso le sacaría el foco al textarea en cada render.
  const stopSpeech = speech.stop;
  const close = useCallback(() => {
    stopSpeech();
    setOpen(false);
  }, [stopSpeech]);

  const reset = () => {
    speech.reset();
    setMessages([]);
    setInput("");
    setConversationId(null);
    setTurnsLeft(null);
    setBlocked(false);
    setDraftApplied(false);
    setQuestion(null);
    setOtherKind(null);
  };

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    setSpeechBase(input);
    speech.start();
  };

  // Manda un mensaje: lo escrito/dictado, o la opción tocada (`choice` = su value).
  const sendMessage = async (rawText, choice) => {
    const text = rawText.trim();
    if (!text || sending || blocked) return;
    if (speech.listening) speech.stop();

    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSpeechBase("");
    speech.reset();
    setQuestion(null);
    setOtherKind(null);
    setSending(true);
    try {
      const res = await sendPlayAgentMessage({
        message: text,
        conversationId,
        choice,
        formContext: conversationId
          ? undefined
          : getFormContext?.() || undefined,
      });
      setConversationId(res.conversationId);
      setTurnsLeft(res.turnsLeft);
      if (res.turnsLeft === 0) setBlocked(true);
      if (res.reply)
        setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      if (res.question?.options?.length) setQuestion(res.question);
      const values = res.draft ? draftToFormValues(res.draft) : null;
      if (values) {
        onDraft?.(values);
        setDraftApplied(true);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 429 || status === 409 || status === 404) setBlocked(true);
      addToast({
        type: "error",
        message: getErrorMessage(err, t("playAgent.sendError")),
      });
    } finally {
      setSending(false);
    }
  };

  const send = (e) => {
    e?.preventDefault();
    sendMessage(shownInput);
  };

  const pickOption = (option) => sendMessage(option.label, option.value);

  // "Otro": el usuario escribe (o dicta) el juego o la persona que no está.
  const pickOther = () => {
    setOtherKind(question?.kind || "other");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) send(e);
  };

  const showCallout = !open && !calloutClosed && !formDirty;
  const micError = speech.error ? t(`playAgent.mic.${speech.error}`) : "";

  return (
    <>
      {!open && (
        <div className={styles.dock}>
          {showCallout && (
            <div className={styles.callout} role="note">
              <span>{t("playAgent.callout")}</span>
              <button
                type="button"
                className={styles.calloutClose}
                onClick={closeCallout}
                aria-label={t("playAgent.calloutClose")}
              >
                ✕
              </button>
            </div>
          )}
          <button
            type="button"
            className={styles.bubble}
            onClick={() => setOpen(true)}
            aria-label={t("playAgent.open")}
            title={t("playAgent.open")}
          >
            <SparkIcon />
          </button>
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={close}
        ariaLabelledBy="play-agent-title"
        className={styles.panel}
        backdropClassName={styles.backdrop}
      >
        <header className={styles.header}>
          <span className={styles.headerIcon}>
            <SparkIcon />
          </span>
          <h2 id="play-agent-title" className={styles.title}>
            {t("playAgent.title")}
          </h2>
          {messages.length > 0 && (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={reset}
              disabled={sending}
            >
              {t("playAgent.restart")}
            </button>
          )}
          <button
            type="button"
            className={styles.closeBtn}
            onClick={close}
            aria-label={t("playAgent.close")}
          >
            ✕
          </button>
        </header>

        <div className={styles.messages} ref={listRef} aria-live="polite">
          <p className={`${styles.msg} ${styles.msgAssistant}`}>
            {t("playAgent.intro")}
          </p>
          {messages.map((m, i) => (
            <p
              key={i}
              className={`${styles.msg} ${m.role === "user" ? styles.msgUser : styles.msgAssistant}`}
            >
              {m.text}
            </p>
          ))}
          {question && !sending && (
            <div
              className={styles.choices}
              role="group"
              aria-label={question.text || t("playAgent.choicesLabel")}
            >
              {question.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={styles.choiceBtn}
                  onClick={() => pickOption(o)}
                  disabled={blocked}
                >
                  <span className={styles.choiceLabel}>{o.label}</span>
                  {o.detail && (
                    <span className={styles.choiceDetail}>{o.detail}</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.choiceBtn} ${styles.choiceOther} ${otherKind ? styles.choiceOtherActive : ""}`}
                onClick={pickOther}
                aria-pressed={!!otherKind}
                disabled={blocked}
              >
                <span className={styles.choiceLabel}>
                  {t("playAgent.other")}
                </span>
              </button>
            </div>
          )}
          {sending && (
            <p
              className={`${styles.msg} ${styles.msgAssistant} ${styles.thinking}`}
            >
              {t("playAgent.thinking")}
            </p>
          )}
          {draftApplied && !sending && (
            <div className={styles.applied}>
              <span>{t("playAgent.draftApplied")}</span>
              <button
                type="button"
                className={styles.reviewBtn}
                onClick={close}
              >
                {t("playAgent.reviewForm")}
              </button>
            </div>
          )}
        </div>

        <form className={styles.composer} onSubmit={send}>
          {speech.listening && (
            <div className={styles.listening}>{t("playAgent.listening")}</div>
          )}
          {micError && <div className={styles.hintError}>{micError}</div>}
          {!speech.supported && (
            <div className={styles.hint}>{t("playAgent.noVoiceHint")}</div>
          )}
          {blocked && (
            <div className={styles.hint}>
              {t("playAgent.blocked")}{" "}
              <button type="button" className={styles.linkBtn} onClick={close}>
                {t("playAgent.fillManually")}
              </button>
            </div>
          )}
          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={shownInput}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                otherKind
                  ? t(`playAgent.otherPlaceholder.${otherKind}`)
                  : t("playAgent.placeholder")
              }
              aria-label={t("playAgent.placeholder")}
              rows={2}
              maxLength={1000}
              readOnly={speech.listening}
              disabled={blocked}
            />
            {speech.supported && (
              <button
                type="button"
                className={`${styles.iconBtn} ${speech.listening ? styles.iconBtnActive : ""}`}
                onClick={toggleMic}
                aria-label={
                  speech.listening
                    ? t("playAgent.micStop")
                    : t("playAgent.micStart")
                }
                aria-pressed={speech.listening}
                disabled={sending || blocked}
              >
                <MicIcon />
              </button>
            )}
            <button
              type="submit"
              className={styles.sendBtn}
              aria-label={t("playAgent.send")}
              disabled={sending || blocked || !shownInput.trim()}
            >
              <SendIcon />
            </button>
          </div>
          {turnsLeft !== null && turnsLeft > 0 && (
            <div className={styles.turns}>
              {t("playAgent.turnsLeft", { count: turnsLeft })}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
