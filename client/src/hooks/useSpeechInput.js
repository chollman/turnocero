import { useCallback, useEffect, useRef, useState } from "react";

// Dictado por voz con el reconocimiento del navegador (Web Speech API). Lo usa
// el agente de carga de partidas de BG Watch. Sin servidor: el audio lo procesa
// el navegador/sistema operativo.
//
// Soporte: Chrome/Edge (desktop y Android) y Safari (incluida la PWA en iOS,
// según versión). Donde no hay soporte, `supported` es false y la UI sugiere
// el dictado del teclado del celular.
//
// Devuelve:
//   supported   ¿el navegador tiene reconocimiento de voz?
//   listening   ¿está escuchando ahora?
//   transcript  texto reconocido en esta sesión (parcial mientras habla)
//   error       null | "permission" | "no-speech" | "failed"
//   start()     empieza a escuchar (pide permiso de micrófono la 1ª vez)
//   stop()      deja de escuchar (el texto reconocido queda en `transcript`)
//   reset()     limpia transcript y error
//
// Opción `onEnd(text)`: se llama cuando termina de escuchar, con el texto final
// (vacío si no se reconoció nada). Útil para volcarlo a un input sin efectos.

const LOCALES = { es: "es-AR", en: "en-US" };

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

export function useSpeechInput({ lang = "es", onEnd } = {}) {
  const Ctor = getRecognitionCtor();
  const supported = !!Ctor;
  const recRef = useRef(null);
  const textRef = useRef("");
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = LOCALES[lang] || LOCALES.es;
    rec.interimResults = true;
    // Una frase por toque: en mobile `continuous` se comporta distinto entre
    // navegadores; parar al silencio es más predecible.
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      textRef.current = text.trim();
      setTranscript(textRef.current);
    };
    rec.onerror = (event) => {
      const mapped = mapError(event.error);
      if (mapped) setError(mapped);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      onEndRef.current?.(textRef.current);
    };

    setError(null);
    setTranscript("");
    textRef.current = "";
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setError("failed");
    }
  }, [Ctor, lang]);

  const reset = useCallback(() => {
    textRef.current = "";
    setTranscript("");
    setError(null);
  }, []);

  // Al desmontar, cortar el micrófono.
  useEffect(
    () => () => {
      recRef.current?.abort?.();
      recRef.current = null;
    },
    [],
  );

  return { supported, listening, transcript, error, start, stop, reset };
}

export default useSpeechInput;
