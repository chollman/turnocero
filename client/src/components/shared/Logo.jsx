import { useEffect, useState } from "react";

const readTheme = () => {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
};

export default function Logo({ className, alt = "TurnoCero" }) {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const src = theme === "light" ? "/logo-light.svg" : "/logo.svg";
  return <img src={src} alt={alt} className={className} />;
}
