import { Link } from "react-router-dom";
import Avatar from "../../components/shared/Avatar";
import { getUserDisplay } from "../../utils/userDisplay";
import { dateParts, countdown } from "../../utils/eventoDate";
import { TIPO_META } from "./tipos";
import styles from "./Calendario.module.css";

// Fila de un item del calendario — usada en la Agenda y en el panel de día
// de la grilla. Linkea al detalle de la entidad (item.url).
export default function CalendarItemRow({ item, now = Date.now() }) {
  const meta = TIPO_META[item.tipo];
  const parts = dateParts(item.date);
  const cd = countdown(item.date, now);
  const host = item.host ? getUserDisplay(item.host) : null;

  return (
    <Link to={item.url} className={styles.row}>
      <span className={`${styles.rowDay} ${styles[meta.cls]}`}>
        <span className={styles.rowDayNum}>{parts?.day ?? "—"}</span>
        <span className={styles.rowDayMonth}>{parts?.month ?? ""}</span>
      </span>
      <span className={styles.rowBody}>
        <span className={styles.rowTopline}>
          <span className={`${styles.tipoTag} ${styles[meta.cls]}`}>
            {meta.label}
          </span>
          {parts?.time && <span className={styles.rowTime}>{parts.time}</span>}
        </span>
        <span className={styles.rowTitle}>{item.title}</span>
        {item.subtitle && (
          <span className={styles.rowSubtitle}>{item.subtitle}</span>
        )}
      </span>
      <span className={styles.rowRight}>
        {host && <Avatar user={item.host} size="sm" />}
        <span className={`${styles.rowCountdown} ${styles[`cd_${cd.tone}`]}`}>
          {cd.text}
        </span>
      </span>
    </Link>
  );
}
