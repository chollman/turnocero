import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import "../../i18n";
import { STORAGE_KEYS } from "../../utils/storageKeys";

const addToast = vi.fn();
vi.mock("../../context/NotificationContext", () => ({
  useNotifications: () => ({ addToast }),
}));
vi.mock("../../hooks/useLanguage", () => ({
  useLanguage: () => ({ lang: "es" }),
}));

import PlayAgent from "./PlayAgent";

// Reconocimiento de voz falso (última instancia accesible para disparar eventos).
let rec;
class FakeRecognition {
  constructor() {
    rec = this;
    this.start = vi.fn();
    this.stop = vi.fn(() => this.onend?.());
    this.abort = vi.fn();
  }
}

const DRAFT = {
  game: { id: "13", name: "Catan" },
  details: { playdate: "2026-10-29", length: null, location: "", comments: "" },
  mode: "versus",
  coopResult: null,
  variant: "",
  expansions: [],
  players: [
    { name: "Me", username: "meBGG", score: "10", win: true, team: "", faction: "" },
    { name: "Juan", username: "juanp", score: "8", win: false, team: "", faction: "" },
  ],
};

function renderAgent(props = {}) {
  const onDraft = props.onDraft || vi.fn();
  const getFormContext = props.getFormContext || vi.fn(() => ({ playdate: "2026-10-30" }));
  render(
    <PlayAgent onDraft={onDraft} getFormContext={getFormContext} formDirty={props.formDirty} />,
  );
  return { onDraft, getFormContext };
}

const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /cargar la partida con el asistente/i }));
const textbox = () => screen.getByRole("textbox", { name: /contá cómo fue la partida/i });
const sendBtn = () => screen.getByRole("button", { name: /^enviar$/i });

beforeEach(() => {
  addToast.mockClear();
  localStorage.removeItem(STORAGE_KEYS.PLAY_AGENT_DISMISSALS);
});
afterEach(() => {
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
});

describe("<PlayAgent> — burbuja", () => {
  it("muestra la burbuja con la sugerencia", () => {
    renderAgent();
    expect(screen.getByRole("button", { name: /cargar la partida con el asistente/i })).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/te la cargo yo/i);
  });

  it("cerrar la sugerencia la cuenta y a la 3ª deja solo el ícono", () => {
    localStorage.setItem(STORAGE_KEYS.PLAY_AGENT_DISMISSALS, "2");
    const { unmount } = render(<PlayAgent onDraft={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar sugerencia/i }));
    expect(screen.queryByRole("note")).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.PLAY_AGENT_DISMISSALS)).toBe("3");
    unmount();
    render(<PlayAgent onDraft={vi.fn()} />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("no ofrece la sugerencia si el form ya está a medio llenar", () => {
    renderAgent({ formDirty: true });
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.getByRole("button", { name: /cargar la partida con el asistente/i })).toBeInTheDocument();
  });
});

describe("<PlayAgent> — conversación", () => {
  it("manda el mensaje con el contexto del form y aplica el borrador", async () => {
    const bodies = [];
    server.use(
      http.post("/api/bgg/agente", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({
          conversationId: "c1",
          reply: "Listo, revisá el formulario.",
          draft: DRAFT,
          warnings: [],
          status: "draft_created",
          turnsLeft: 5,
        });
      }),
    );
    const { onDraft, getFormContext } = renderAgent();
    openPanel();
    fireEvent.change(textbox(), { target: { value: "ayer Catan con Juan, gané 10 a 8" } });
    fireEvent.click(sendBtn());

    expect(await screen.findByText("Listo, revisá el formulario.")).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({
      message: "ayer Catan con Juan, gané 10 a 8",
      formContext: { playdate: "2026-10-30" },
    });
    expect(typeof bodies[0].timezone).toBe("string");
    expect(getFormContext).toHaveBeenCalled();
    expect(onDraft).toHaveBeenCalledWith(
      expect.objectContaining({ game: expect.objectContaining({ id: 13, name: "Catan" }), fromAgent: true }),
    );
    expect(screen.getByText(/completé el formulario/i)).toBeInTheDocument();
    expect(screen.getByText(/te quedan 5 mensajes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /revisar formulario/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("los mensajes siguientes van con conversationId y sin contexto", async () => {
    const bodies = [];
    server.use(
      http.post("/api/bgg/agente", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ conversationId: "c1", reply: "¿Qué juego?", draft: null, warnings: [], status: "active", turnsLeft: 5 });
      }),
    );
    renderAgent();
    openPanel();
    fireEvent.change(textbox(), { target: { value: "jugamos ayer" } });
    fireEvent.click(sendBtn());
    await screen.findByText("¿Qué juego?");
    fireEvent.change(textbox(), { target: { value: "Azul" } });
    fireEvent.click(sendBtn());
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toMatchObject({ message: "Azul", conversationId: "c1" });
    expect(bodies[1]).not.toHaveProperty("formContext");
  });

  it("ante el límite diario avisa con un toast y bloquea el input", async () => {
    server.use(
      http.post("/api/bgg/agente", () =>
        HttpResponse.json({ message: "Llegaste al límite de 10 cargas por día con el asistente." }, { status: 429 }),
      ),
    );
    renderAgent();
    openPanel();
    fireEvent.change(textbox(), { target: { value: "hola" } });
    fireEvent.click(sendBtn());
    await waitFor(() =>
      expect(addToast).toHaveBeenCalledWith({
        type: "error",
        message: "Llegaste al límite de 10 cargas por día con el asistente.",
      }),
    );
    expect(textbox()).toBeDisabled();
    expect(screen.getByRole("button", { name: /completar a mano/i })).toBeInTheDocument();
  });

  it("no manda mensajes vacíos", () => {
    renderAgent();
    openPanel();
    expect(sendBtn()).toBeDisabled();
  });
});

describe("<PlayAgent> — voz", () => {
  it("sin soporte de voz sugiere el dictado del teclado", () => {
    renderAgent();
    openPanel();
    expect(screen.queryByRole("button", { name: /dictar por voz/i })).toBeNull();
    expect(screen.getByText(/micrófono del teclado/i)).toBeInTheDocument();
  });

  it("dicta, muestra la transcripción y la deja editable al terminar", async () => {
    window.SpeechRecognition = FakeRecognition;
    renderAgent();
    openPanel();
    fireEvent.change(textbox(), { target: { value: "Ayer" } });
    fireEvent.click(screen.getByRole("button", { name: /dictar por voz/i }));
    expect(rec.lang).toBe("es-AR");
    expect(screen.getByText(/escuchando/i)).toBeInTheDocument();

    act(() => rec.onresult({ results: [[{ transcript: "jugamos Azul con Juan" }]] }));
    expect(textbox()).toHaveValue("Ayer jugamos Azul con Juan");

    fireEvent.click(screen.getByRole("button", { name: /dejar de escuchar/i }));
    await waitFor(() => expect(screen.queryByText(/escuchando/i)).toBeNull());
    expect(textbox()).toHaveValue("Ayer jugamos Azul con Juan");
    expect(textbox()).not.toHaveAttribute("readonly");
  });

  it("si se niega el micrófono lo explica", () => {
    window.SpeechRecognition = FakeRecognition;
    renderAgent();
    openPanel();
    fireEvent.click(screen.getByRole("button", { name: /dictar por voz/i }));
    act(() => {
      rec.onerror({ error: "not-allowed" });
      rec.onend();
    });
    expect(screen.getByText(/permiso para usar el micrófono/i)).toBeInTheDocument();
  });
});
