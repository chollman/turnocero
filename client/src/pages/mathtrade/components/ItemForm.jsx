import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API } from "../../../api/endpoints";
import { useNotifications } from "../../../context/NotificationContext";
import { getErrorMessage } from "../../../utils/getErrorMessage";
import BggGameSearch from "../../../components/shared/BggGameSearch";
import WantListBuilder from "./WantListBuilder";
import styles from "../MathTradeDetail.module.css";

// Form para ofrecer un juego + armar su want list. Sirve para crear y editar
// (si viene `item`). Al guardar, llama onSaved con el ítem persistido.
export default function ItemForm({
  mathtradeId,
  item = null,
  onSaved,
  onCancel,
}) {
  const { t } = useTranslation();
  const { addToast } = useNotifications();
  const [offered, setOffered] = useState(
    item
      ? {
          id: item.bggGameId,
          name: item.gameName,
          thumbnail: item.thumbnail,
        }
      : null,
  );
  const [wants, setWants] = useState(
    item ? item.wants.map((w) => ({ ...w })) : [],
  );
  const [notes, setNotes] = useState(item?.notes || "");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!offered) {
      addToast({ type: "error", title: t("mathtrade:itemForm.missingOffered") });
      return;
    }
    if (wants.length === 0) {
      addToast({
        type: "error",
        title: t("mathtrade:itemForm.missingWants"),
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bggGameId: offered.id,
        wants: wants.map((w) => ({ bggGameId: w.bggGameId })),
        notes,
      };
      const res = item
        ? await axios.put(API.mathtrade.ITEM(mathtradeId, item._id), payload)
        : await axios.post(API.mathtrade.ITEMS(mathtradeId), payload);
      onSaved?.(res.data);
    } catch (err) {
      addToast({
        type: "error",
        title: t("mathtrade:itemForm.saveError"),
        message: getErrorMessage(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <div>
        <span className={styles.formLabel}>
          {t("mathtrade:itemForm.offeredLabel")}
        </span>
        {offered ? (
          <div className={styles.pickedGame}>
            {offered.thumbnail ? (
              <img
                src={offered.thumbnail}
                alt={offered.name}
                className={styles.thumb}
              />
            ) : (
              <div className={styles.thumbFallback}>🎲</div>
            )}
            <span className={styles.itemGame}>{offered.name}</span>
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => setOffered(null)}
              style={{ marginLeft: "auto" }}
            >
              {t("mathtrade:itemForm.change")}
            </button>
          </div>
        ) : (
          <BggGameSearch
            onPick={(g) => setOffered(g)}
            autoFocus={false}
            placeholder={t("mathtrade:itemForm.searchOfferedPlaceholder")}
          />
        )}
      </div>

      <WantListBuilder wants={wants} onChange={setWants} />

      <div>
        <label className={styles.formLabel} htmlFor="item-notes">
          {t("mathtrade:itemForm.notesLabel")}
        </label>
        <input
          id="item-notes"
          className={styles.notesInput}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder={t("mathtrade:itemForm.notesPlaceholder")}
        />
      </div>

      <div className={styles.itemActions}>
        <button type="submit" className={styles.cta} disabled={saving}>
          {saving
            ? t("mathtrade:itemForm.submitting")
            : item
              ? t("mathtrade:itemForm.submitEdit")
              : t("mathtrade:itemForm.submitCreate")}
        </button>
        {onCancel && (
          <button type="button" className={styles.smallBtn} onClick={onCancel}>
            {t("common:actions.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
