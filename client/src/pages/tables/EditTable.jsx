import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { API } from "../../api/endpoints";
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

  const [initialValues, setInitialValues] = useState(null);
  const [playersCount, setPlayersCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    const ac = new AbortController();
    const fetchTable = async () => {
      try {
        const { data } = await axios.get(API.tables.DETAIL(id), {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        const uid = user._id?.toString();
        const isHost =
          data.host?._id === user._id ||
          data.host?._id?.toString() === uid;
        // Host puede siempre. Admin puede SOLO cuando la mesa ya pasó
        // (override del freeze — ver feedback del freeze post-fecha).
        const isPast = data.date && new Date(data.date).getTime() < Date.now();
        const canEdit = isHost || (user.isAdmin && isPast);
        if (!canEdit || data.status === "cancelled") {
          navigate("/mesas");
          return;
        }
        // location puede llegar como string legacy o subdoc.
        const loc =
          typeof data.location === "string"
            ? { texto: data.location, lat: null, lng: null }
            : {
                texto: data.location?.texto || "",
                lat: data.location?.lat ?? null,
                lng: data.location?.lng ?? null,
              };
        setInitialValues({
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
        });
        setPlayersCount(data.players?.length || 0);
      } catch (err) {
        if (axios.isCancel(err)) return;
        navigate("/mesas");
      }
    };
    fetchTable();
    return () => ac.abort();
  }, [id, user._id, user.isAdmin, navigate]);

  const goBack = () => navigate(`/mesas/${id}`);

  const handleSubmit = async (payload) => {
    setServerError("");
    setSubmitting(true);
    try {
      await axios.put(API.tables.DETAIL(id), {
        date: payload.date,
        // UI cuenta al host; server espera spots libres → -1.
        maxPlayers: Math.max(1, Number(payload.maxPlayers) - 1),
        location: payload.location,
        description: payload.description,
        rules: payload.rules,
        tags: payload.tags,
        privacy: payload.privacy,
      });
      navigate(`/mesas/${id}`);
    } catch (err) {
      const msg =
        err.response?.data?.message || "Error al guardar los cambios";
      setServerError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Cancelar la mesa? Esta acción no se puede deshacer."))
      return;
    setSubmitting(true);
    try {
      await axios.delete(API.tables.DETAIL(id));
      navigate("/mesas");
    } catch (err) {
      const msg =
        err.response?.data?.message || "Error al cancelar la mesa";
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
