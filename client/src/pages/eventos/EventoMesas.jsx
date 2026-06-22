import Meeple from "../../components/shared/Meeple";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
import TableCard from "../../pages/dashboard/TableCard";
import styles from "./EventoMesas.module.css";

/*
 * Pestaña "Mesas del Evento" dentro del detalle del evento.
 *
 * Lista las mesas asociadas a este evento (no visibles en /mesas global).
 * Reusa <TableCard> tal cual — el componente ya muestra los campos
 * relevantes (juego, host, fecha, lugares, distance, status).
 *
 * Permisos para "Crear mesa en el evento":
 *   - Confirmed registrants + author + admin (validado server-side en POST
 *     /api/tables). El botón se muestra según `canAdd` que viene del padre.
 *
 * Click "Crear mesa" → navega a /mesas/crear?evento=<id> — CreateTable lee
 * el query param y lo manda en el POST. Al éxito redirige a /mesas/:id.
 */
export default function EventoMesas({
  eventoId,
  eventDate,
  items: itemsProp,
  setItems: setItemsProp,
  canAdd = false,
}) {
  const { t } = useTranslation("eventos");
  const navigate = useNavigate();
  const { addToast } = useNotifications();

  // Si el parent maneja el state (EventoDetail lo levanta para alimentar el
  // badge "Mesas (N)" en la tab), usamos ese. Si no (uso standalone / tests),
  // mantenemos un state local con fetch propio.
  const [localTables, setLocalTables] = useState(itemsProp ?? null);
  useEffect(() => {
    if (itemsProp !== undefined) setLocalTables(itemsProp);
  }, [itemsProp]);

  const tables = localTables;
  const setTables = (updater) => {
    setLocalTables((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setItemsProp?.(next);
      return next;
    });
  };

  useEffect(() => {
    if (itemsProp !== undefined) return; // managed by parent
    let cancelled = false;
    setLocalTables(null);
    axios
      .get(API.eventos.MESAS(eventoId))
      .then(({ data }) => {
        if (cancelled) return;
        setLocalTables(data.tables || []);
      })
      .catch(() => {
        if (cancelled) return;
        setLocalTables([]);
        addToast({
          type: "error",
          title: t("mesas.loadErrorTitle"),
          message: t("mesas.loadErrorMessage"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [eventoId, addToast, itemsProp, t]);

  const handleCreate = () => {
    // Pasamos `eventDate` por navigation state para que CreateTable lockee el
    // día de la mesa sin tener que fetchear el evento de nuevo. Si el user
    // refresca el form (state se pierde), CreateTable hace fallback a fetch.
    navigate(`/mesas/crear?evento=${eventoId}`, {
      state: eventDate ? { eventDate } : undefined,
    });
  };

  // onUpdate/onCancel callbacks para que TableCard pueda mutar el state local
  // sin re-fetch completo (mismo patrón que Dashboard.jsx).
  const handleUpdate = (updated) => {
    setTables((prev) =>
      (prev || []).map((t) => (t._id === updated._id ? updated : t)),
    );
  };
  const handleCancel = (cancelledId) => {
    setTables((prev) => (prev || []).filter((t) => t._id !== cancelledId));
  };

  if (tables == null) {
    return <div className={styles.dim}>{t("mesas.loading")}</div>;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>{t("mesas.title")}</h3>
          <p className={styles.subtitle}>
            {tables.length === 0
              ? t("mesas.subtitleEmpty")
              : t("mesas.subtitle", { count: tables.length })}
          </p>
        </div>
        {canAdd && (
          <button
            type="button"
            className={styles.createBtn}
            onClick={handleCreate}
          >
            {t("mesas.createBtn")}
          </button>
        )}
      </header>

      {tables.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyDot}>
            <Meeple />
          </span>
          <p className={styles.emptyText}>
            {canAdd ? t("mesas.emptyCanAdd") : t("mesas.emptyCannotAdd")}
          </p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {tables.map((table) => (
            <li key={table._id}>
              <TableCard
                table={table}
                onUpdate={handleUpdate}
                onCancel={handleCancel}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
