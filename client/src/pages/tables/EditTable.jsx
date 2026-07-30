import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { useTableQuery, tableKeys, updateTable, cancelTable } from "../../queries/tables";
import { toLocalInputValue } from "../../utils/eventoDate";
import MesaForm from "./MesaForm";

// Thin wrapper: fetchea la mesa, valida que el viewer pueda editarla
// (host o admin), normaliza el shape al que consume MesaForm y delega
// el render del wizard. El mismo MesaForm sirve para crear y editar —
// diferencias: editMode=true bloquea el campo "Nombre del juego" y
// muestra la "Zona delicada" abajo de los CTAs.
export default function EditTable() {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const { t } = useTranslation("tables");
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const { data, isPending, isError } = useTableQuery(id);

  const uid = user._id?.toString();
  const isHost =
    !!data &&
    (data.host?._id === user._id || data.host?._id?.toString() === uid);
  // Host puede siempre. Admin puede SOLO cuando la mesa ya pasó (override
  // del freeze — ver feedback del freeze post-fecha).
  const isPast = !!data?.date && new Date(data.date) < new Date();
  const canEdit = !!data && (isHost || (user.isAdmin && isPast));
  const shouldRedirect =
    !isPending && (isError || (!!data && (!canEdit || data.status === "cancelled")));

  useEffect(() => {
    if (shouldRedirect) navigate("/mesas");
  }, [shouldRedirect, navigate]);

  const initialValues = useMemo(() => {
    if (!data || !canEdit || data.status === "cancelled") return null;
    // location puede llegar como string legacy o subdoc.
    const loc =
      typeof data.location === "string"
        ? { texto: data.location, lat: null, lng: null }
        : {
            texto: data.location?.texto || "",
            lat: data.location?.lat ?? null,
            lng: data.location?.lng ?? null,
          };
    return {
      boardGame: data.boardGame,
      bggData: {
        id: data.bggId,
        name: data.boardGame,
        thumbnail: data.bggThumbnail,
        image: data.bggImage,
        year: data.bggYear,
      },
      // server guarda spots libres (sin host); UI cuenta total → +1.
      // toLocalInputValue convierte UTC del server a hora local que
      // consume <DateTimePicker>.
      date: toLocalInputValue(data.date),
      maxPlayers: data.maxPlayers + 1,
      location: loc,
      description: data.description || "",
      rules: data.rules || "",
      tags: data.tags || [],
      privacy: data.privacy || "public",
      tutorialMode: data.tutorialMode || "auto",
      tutorialVideoId: data.tutorialVideoId || null,
      bgaUrl: data.bgaUrl || null,
    };
  }, [data, canEdit]);
  const playersCount = data?.players?.length || 0;

  const goBack = () => navigate(`/mesas/${id}`);

  const handleSubmit = async (payload) => {
    setServerError("");
    setSubmitting(true);
    try {
      const { data: updated } = await updateTable(id, {
        date: payload.date,
        // UI cuenta al host; server espera spots libres → -1.
        maxPlayers: Math.max(1, Number(payload.maxPlayers) - 1),
        location: payload.location,
        description: payload.description,
        rules: payload.rules,
        tags: payload.tags,
        privacy: payload.privacy,
        tutorialMode: payload.tutorialMode,
        tutorialVideoId: payload.tutorialVideoId,
        bgaUrl: payload.bgaUrl,
      });
      queryClient.setQueryData(tableKeys.detail(id), updated);
      navigate(`/mesas/${id}`);
    } catch (err) {
      const msg =
        err.response?.data?.message || t("edit.errorSave");
      setServerError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("edit.confirmDelete")))
      return;
    setSubmitting(true);
    try {
      await cancelTable(id);
      navigate("/mesas");
    } catch (err) {
      const msg =
        err.response?.data?.message || t("edit.errorCancel");
      setServerError(msg);
      addToast({ type: "error", message: msg });
      setSubmitting(false);
    }
  };

  if (!initialValues) return null;

  return (
    <MesaForm
      editMode
      initialValues={initialValues}
      playersCount={playersCount}
      submitting={submitting}
      serverError={serverError}
      onSubmit={handleSubmit}
      onCancel={goBack}
      onDelete={handleDelete}
    />
  );
}
