import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { createJuntada, toGamePayload } from "./createJuntada";

describe("toGamePayload", () => {
  it("mapea id → bggId y conserva name/thumbnail/image/year", () => {
    expect(
      toGamePayload({
        id: 13,
        name: "Catan",
        thumbnail: "t.jpg",
        image: "i.jpg",
        year: 1995,
      }),
    ).toEqual({
      bggId: 13,
      name: "Catan",
      thumbnail: "t.jpg",
      image: "i.jpg",
      year: 1995,
    });
  });
});

describe("createJuntada", () => {
  it("sin fotos: hace un solo POST a /compartidas con el payload y devuelve el post", async () => {
    let captured = null;
    server.use(
      http.post("/api/compartidas", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ _id: "j1", category: "juntada", images: [] });
      }),
    );
    const payload = {
      category: "juntada",
      title: "Noche",
      body: "texto",
      boardGames: [{ bggId: 13 }],
      privacy: "public",
    };
    const post = await createJuntada({ payload, files: [] });
    expect(post._id).toBe("j1");
    expect(captured).toEqual(payload);
  });

  it("forwardea el payload tal cual (incluye playResult)", async () => {
    let captured = null;
    server.use(
      http.post("/api/compartidas", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ _id: "j1", images: [] });
      }),
    );
    await createJuntada({
      payload: {
        category: "juntada",
        playResult: { mode: "coop", players: [{ name: "A", win: true }] },
      },
      files: [],
    });
    expect(captured.playResult.mode).toBe("coop");
    expect(captured.playResult.players[0].name).toBe("A");
  });

  it("con fotos: 1 POST de creación + 1 POST de imagen por archivo, en orden, acumulando images", async () => {
    const imageCalls = [];
    server.use(
      http.post("/api/compartidas", () =>
        HttpResponse.json({ _id: "j2", images: [] }),
      ),
      http.post("/api/compartidas/:id/images", ({ params }) => {
        imageCalls.push(params.id);
        // Cada respuesta acumula una imagen más.
        return HttpResponse.json(
          imageCalls.map((_, i) => ({ url: `img${i}.jpg`, publicId: `p${i}` })),
        );
      }),
    );
    const files = [
      { file: new File(["1"], "a.jpg", { type: "image/jpeg" }) },
      { file: new File(["2"], "b.jpg", { type: "image/jpeg" }) },
    ];
    const post = await createJuntada({
      payload: { category: "juntada" },
      files,
    });
    expect(imageCalls).toEqual(["j2", "j2"]);
    expect(post.images).toHaveLength(2);
  });

  it("si falla una imagen: borra la compartida (cleanup) y re-lanza", async () => {
    let deleted = null;
    server.use(
      http.post("/api/compartidas", () =>
        HttpResponse.json({ _id: "j3", images: [] }),
      ),
      http.post("/api/compartidas/:id/images", () =>
        HttpResponse.json({ message: "fallo imagen" }, { status: 500 }),
      ),
      http.delete("/api/compartidas/:id", ({ params }) => {
        deleted = params.id;
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(
      createJuntada({
        payload: { category: "juntada" },
        files: [{ file: new File(["1"], "a.jpg", { type: "image/jpeg" }) }],
      }),
    ).rejects.toBeTruthy();
    expect(deleted).toBe("j3");
  });

  it("si falla la creación: re-lanza y NO intenta borrar", async () => {
    const onDelete = vi.fn();
    server.use(
      http.post("/api/compartidas", () =>
        HttpResponse.json({ message: "nope" }, { status: 500 }),
      ),
      http.delete("/api/compartidas/:id", () => {
        onDelete();
        return HttpResponse.json({ ok: true });
      }),
    );
    await expect(
      createJuntada({ payload: { category: "juntada" }, files: [] }),
    ).rejects.toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
