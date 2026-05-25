import { useState, useEffect, useCallback } from "react";

function read(key, defaultValue) {
  if (typeof window === "undefined" || !window.localStorage)
    return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function write(key, value) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded / disabled — ignore
  }
}

export default function useLocalStorageState(key, defaultValue) {
  const [value, setValue] = useState(() => read(key, defaultValue));

  useEffect(() => {
    write(key, value);
  }, [key, value]);

  const set = useCallback((next) => {
    setValue((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);

  return [value, set];
}
