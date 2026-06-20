import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import useDialogA11y from "./useDialogA11y";

describe("useDialogA11y", () => {
  it("devuelve un ref estable", () => {
    const { result, rerender } = renderHook(({ open }) => useDialogA11y(open), {
      initialProps: { open: false },
    });
    const first = result.current;
    rerender({ open: true });
    expect(result.current).toBe(first);
  });

  it("restaura el foco al elemento previo al cerrar", () => {
    // Elemento que tiene el foco antes de abrir el diálogo.
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { result, rerender } = renderHook(({ open }) => useDialogA11y(open), {
      initialProps: { open: false },
    });

    // Abrir: conectar el ref a un contenedor focusable y abrir.
    const dialog = document.createElement("div");
    dialog.tabIndex = -1;
    document.body.appendChild(dialog);
    result.current.current = dialog;
    rerender({ open: true });
    dialog.focus();
    expect(document.activeElement).toBe(dialog);

    // Cerrar → restaura el foco al trigger.
    rerender({ open: false });
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    dialog.remove();
  });
});
