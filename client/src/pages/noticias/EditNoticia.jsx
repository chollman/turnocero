import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useNoticiaQuery } from "../../queries/noticias";
import BackButton from "../../components/shared/BackButton";
import NoticiaForm from "./NoticiaForm";
import styles from "./NoticiaForm.module.css";

export default function EditNoticia() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: noticia, isPending: loading, error } = useNoticiaQuery(id);
  const notFound = !!error;

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.loadingNote}>{t("noticias:edit.loading")}</div>
        </div>
      </div>
    );

  if (notFound || !noticia)
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loadingNote}>{t("noticias:edit.notFound")}</p>
          <BackButton to="/noticias" flush>
            {t("noticias:edit.back")}
          </BackButton>
        </div>
      </div>
    );

  return <NoticiaForm mode="edit" initial={noticia} id={id} />;
}
