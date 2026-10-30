import { useCallback, useEffect, useRef, useState } from "react";

// Dictado por voz con el reconocimiento del navegador (Web Speech API). Lo usa
// el agente de carga de partidas de BG Watch. Sin servidor: el audio lo procesa
// el navegador/sistema operativo.
//
// Soporte: Chrome/Edge (desktop y Android) y Safari (incluida la PWA en iOS,
// según versión). Donde no hay soporte, `supported` es false y la UI sugiere
// el dictado del teclado del celular.
//
// Pausas: el navegador no deja configurar cuánto silencio tolera y, por su
// cuenta, corta enseguida tras una pausa corta. Por eso escuchamos en modo
// continuo y cortamos nosotros recién tras `silenceMs` sin oír nada nuevo. Si
// el navegador igual termina antes (pasa en varios celulares), se reabre solo y
// el texto se sigue sumando. Además hay un tope total de `maxMs` por toma.
//
// Devuelve:
//   supported   ¿el navegador tiene reconocimiento de voz?
//   listening   ¿está escuchando ahora?
//   transcript  texto reconocido en esta toma (parcial mientras habla)
//   error       null | "permission" | "no-speech" | "failed"
//   start()     empieza a escuchar (pide permiso de micrófono la 1ª vez)
//   stop()      deja de escuchar (el texto reconocido queda en `transcript`)
//   reset()     limpia transcript y error
//
// Opciones:
//   lang        "es" | "en"
//   onEnd(text) se llama al terminar de escuchar, con el texto final (vacío si
//               no se reconoció nada). Útil para volcarlo a un input sin efectos.
//   silenceMs   silencio tolerado antes de cortar solo (default 5 s)
//   maxMs       duración máxima de una toma (default 60 s)

const LOCALES = { es: "es-AR", en: "en-US" };
export const DEFAULT_SILENCE_MS = 5000;
export const DEFAULT_MAX_MS = 60000;
// Si el navegador corta y reabrimos muchas veces seguidas sin oír nada, algo
// anda mal (micrófono ocupado, servicio caído): se corta para no entrar en loop.
const MAX_RESTARTS_WITHOUT_SPEECH = 5;

function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function mapError(code) {
  if (code === "not-allowed" || code === "service-not-allowed")
    return "permission";
  if (code === "no-speech") return "no-speech";
  if (code === "aborted") return null;
  return "failed";
}

function joinText(a, b) {
  return [a, b]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

export function useSpeechInput({
  lang = "es",
  onEnd,
  silenceMs = DEFAULT_SILENCE_MS,
  maxMs = DEFAULT_MAX_MS,
} = {}) {
  const Ctor = getRecognitionCtor();
  const supported = !!Ctor;
  // Toma en curso: { finish(), abort() } o null.
  const sessionRef = useRef(null);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);

  const start = useCallback(() => {
    if (!Ctor || sessionRef.current) return;

    // Texto de los tramos anteriores (si el navegador cortó y reabrimos) y del
    // tramo actual.
    let committed = "";
    let segment = "";
    // true cuando el corte es definitivo (usuario, silencio, tope o error
    // grave): el `onend` del navegador ya no reabre el micrófono.
    let finishing = false;
    let fatal = null;
    let heardSomething = false;
    let restartsWithoutSpeech = 0;
    let rec = null;
    let silenceTimer = null;
    let maxTimer = null;

    const fullText = () => joinText(committed, segment);
    const clearTimers = () => {
      clearTimeout(silenceTimer);
      clearTimeout(maxTimer);
    };

    const done = () => {
      clearTimers();
      sessionRef.current = null;
      setListening(false);
      const text = fullText();
      if (fatal) setError(fatal);
      else if (!text) setError("no-speech");
      onEndRef.current?.(text);
    };

    const finish = () => {
      if (finishing) return;
      finishing = true;
      clearTimers();
      if (rec) rec.stop();
      else done();
    };

    const armSilence = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(finish, silenceMs);
    };

    const openSegment = () => {
      const r = new Ctor();
      r.lang = LOCALES[lang] || LOCALES.es;
      r.interimResults = true;
      r.continuous = true;
      r.maxAlternatives = 1;

      r.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        segment = text.trim();
        heardSomething = true;
        restartsWithoutSpeech = 0;
        setTranscript(fullText());
        armSilence();
      };
      r.onerror = (event) => {
        // "no-speech" a mitad de una toma no corta: decide nuestro
        // temporizador de silencio.
        if (event.error === "no-speech") return;
        const mapped = mapError(event.error);
        if (mapped) {
          fatal = mapped;
          finishing = true;
          clearTimers();
        }
      };
      r.onend = () => {
        rec = null;
        if (!finishing) {
          // El navegador cortó antes que nuestro silencio: se guarda lo dicho y
          // se reabre para seguir escuchando.
          committed = fullText();
          segment = "";
          if (!heardSomething) restartsWithoutSpeech += 1;
          heardSomething = false;
          if (restartsWithoutSpeech <= MAX_RESTARTS_WITHOUT_SPEECH) {
            try {
              openSegment();
              return;
            } catch {
              fatal = "failed";
            }
          }
          finishing = true;
        }
        done();
      };

      rec = r;
      r.start();
    };

    setError(null);
    setTranscript("");
    try {
      openSegment();
    } catch {
      rec = null;
      setError("failed");
      return;
    }
    sessionRef.current = {
      finish,
      abort: () => {
        finishing = true;
        clearTimers();
        const r = rec;
        rec = null;
        if (r) {
          r.onend = null;
          r.abort?.();
        }
      },
    };
    setListening(true);
    armSilence();
    maxTimer = setTimeout(finish, maxMs);
  }, [Ctor, lang, silenceMs, maxMs]);

  const stop = useCallback(() => {
    sessionRef.current?.finish();
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  // Al desmontar, cortar el micrófono.
  useEffect(
    () => () => {
      sessionRef.current?.abort();
      sessionRef.current = null;
    },
    [],
  );

  return { supported, listening, transcript, error, start, stop, reset };
}

export default useSpeechInput;
