import { useEffect, useState } from "react";
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
  items: itemsProp,
  setItems: setItemsProp,
  canAdd = false,
}) {
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
          title: "Error",
          message: "No pudimos cargar las mesas del evento.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [eventoId, addToast, itemsProp]);

  const handleCreate = () => {
    navigate(`/mesas/crear?evento=${eventoId}`);
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
    return <div className={styles.dim}>Cargando mesas…</div>;
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>Mesas del evento</h3>
          <p className={styles.subtitle}>
            {tables.length === 0
              ? "Todavía no hay mesas armadas para este evento."
              : `${tables.length} ${tables.length === 1 ? "mesa armada" : "mesas armadas"} para el día del evento.`}
          </p>
        </div>
        {canAdd && (
          <button
            type="button"
            className={styles.createBtn}
            onClick={handleCreate}
          >
            + Crear mesa
          </button>
        )}
      </header>

      {tables.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyDot}>◆</span>
          <p className={styles.emptyText}>
            {canAdd
              ? "Sé el primero en armar una mesa para este evento."
              : "Sólo los inscriptos confirmados pueden crear mesas acá."}
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
