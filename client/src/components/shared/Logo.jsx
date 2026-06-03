import { useEffect, useState } from "react";

const readTheme = () => {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
};

// `srcLight`/`srcDark` permiten overridear el logo (ej. el de la comunidad-skin
// activa) por tema. Si no se pasan, cae a los assets estáticos de TurnoCero. El
// componente sigue siendo context-free a propósito (el brand lo inyecta el
// parent vía estas props), para no acoplar Logo a CommunityContext.
export default function Logo({ className, alt = "TurnoCero", srcLight, srcDark }) {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const fallback = theme === "light" ? "/logo-light.svg" : "/logo.svg";
  const override = theme === "light" ? srcLight : srcDark;
  return <img src={override || fallback} alt={alt} className={className} />;
}
