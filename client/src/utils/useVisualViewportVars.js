import { useEffect } from "react";

// Publishes the current visualViewport offset/size/scale as CSS variables on :root,
// so position:fixed elements can stay glued to the visible area during pinch-zoom.
//
// --vv-top:    distance from layout viewport top to visible area top (CSS px)
// --vv-left:   distance from layout viewport left to visible area left (CSS px)
// --vv-width:  width of the visible area (CSS px)
// --vv-bottom: distance from visible area bottom to layout viewport bottom (CSS px)
// --vv-scale:  current pinch-zoom factor (1 = no zoom). Apply transform: scale(1 / var(--vv-scale))
//              on a fixed element to keep its physical size constant while content zooms.
export default function useVisualViewportVars() {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return undefined;

    const root = document.documentElement;

    const update = () => {
      const layoutHeight = root.clientHeight || window.innerHeight || 0;
      const top = vv.offsetTop || 0;
      const left = vv.offsetLeft || 0;
      const width = vv.width || 0;
      const height = vv.height || 0;
      const scale = vv.scale || 1;
      const bottom = Math.max(0, layoutHeight - top - height);
      root.style.setProperty("--vv-top", `${top}px`);
      root.style.setProperty("--vv-left", `${left}px`);
      root.style.setProperty("--vv-width", `${width}px`);
      root.style.setProperty("--vv-bottom", `${bottom}px`);
      root.style.setProperty("--vv-scale", `${scale}`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
}
