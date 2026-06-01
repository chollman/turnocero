import Meeple from "../../components/shared/Meeple";
import { useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import { getErrorMessage } from "../../utils/getErrorMessage";
import styles from "./Colaborar.module.css";

const CoffeeIcon = ({ size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 9h13v6a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />
    <path d="M16 11h2a3 3 0 0 1 0 6h-2" />
    <path d="M7 3v3M10.5 3v3M14 3v3" />
  </svg>
);

const LightbulbIcon = ({ size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 1 4 12.74V17H8v-2.26A7 7 0 0 1 12 2z" />
  </svg>
);

const SendIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

// TODO: confirmar username de Cafecito antes del deploy.
const CAFECITO_URL = "https://cafecito.app/turnocero";

const MIN = 10;
const MAX = 2000;

export default function Colaborar() {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const len = content.trim().length;
  const counterClass =
    len > MAX || (len > 0 && len < MIN) ? styles.counterWarn : "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length < MIN) {
      addToast({
        type: "error",
        title: "Idea muy corta",
        message: `Contanos un poco más — mínimo ${MIN} caracteres.`,
      });
      return;
    }
    if (trimmed.length > MAX) {
      addToast({
        type: "error",
        title: "Idea muy larga",
        message: `Máximo ${MAX} caracteres.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const body = { content: trimmed };
      if (!user && email.trim()) body.email = email.trim();
      await axios.post(API.ideas.LIST, body);
      addToast({
        type: "success",
        title: "¡Gracias!",
        message: "Te leemos. Si nos diste un email, capaz te respondemos.",
      });
      setContent("");
      setEmail("");
    } catch (err) {
      addToast({
        type: "error",
        title: "Error",
        message: getErrorMessage(err, "No pudimos enviar la idea."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <Helmet>
        <title>Bancanos · TurnoCero</title>
      </Helmet>

      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <p className={styles.heroEyebrow}><Meeple />COLABORÁ CON TURNOCERO</p>
          <h1 className={styles.heroTitle}>
            Bancá a <em>TurnoCero</em>.
          </h1>
          <p className={styles.heroSub}>
            Esta herramienta la armamos <strong>a pulmón</strong> porque amamos
            los juegos de mesa y queremos que sea más fácil encontrar gente con
            quién jugar. Mantener el dominio, el hosting y los servicios cuesta,
            y mejorarla lleva tiempo. Si te sirve, te dejamos dos formas de
            bancarla.
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardIcon}>
            <LightbulbIcon size={22} />
          </div>
          <h2 className={styles.cardTitle}>Tirá una idea</h2>
          <p className={styles.cardDesc}>
            ¿Te falta alguna funcionalidad? ¿Encontraste un bug? ¿Tenés una idea
            loca? Escribínos y lo leemos.
          </p>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="idea-content">
                Tu idea
              </label>
              <textarea
                id="idea-content"
                className={styles.textarea}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Estaría buenísimo que la app pudiera…"
                maxLength={MAX + 50}
                disabled={submitting}
              />
              <span className={`${styles.counter} ${counterClass}`}>
                {len}/{MAX}
              </span>
            </div>

            {!user && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="idea-email">
                  Email (opcional)
                </label>
                <input
                  id="idea-email"
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com (por si queremos responder)"
                  disabled={submitting}
                />
              </div>
            )}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting || len < MIN}
            >
              <SendIcon size={16} />
              {submitting ? "Enviando…" : "Mandar idea"}
            </button>
          </form>
        </article>

        <article className={styles.card}>
          <div className={styles.cardIcon}>
            <CoffeeIcon size={22} />
          </div>
          <h2 className={styles.cardTitle}>Aportá unos mangos</h2>
          <p className={styles.cardDesc}>
            Si querés bancarnos económicamente, podés invitarnos un café (o
            varios) por Cafecito. Va directo a cubrir los costos operativos del
            proyecto.
          </p>
          <a
            href={CAFECITO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cafecitoBtn}
          >
            <CoffeeIcon size={16} />
            Invitanos un cafecito
          </a>
          <p className={styles.cardFootnote}>
            Si lo tuyo no es Cafecito, también aceptamos transferencias, pago
            en especias (canela y comino cuentan) y hasta algún bitcoin
            olvidado en la wallet.
          </p>
        </article>
      </div>

      <p className={styles.footer}>Gracias por usar TurnoCero.</p>
    </div>
  );
}
