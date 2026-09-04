import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../test/server";
import { createJuntada, toGamePayload } from "./createJuntada";

const CREATED = { _id: "c1", title: "Juntada", images: [] };

function mockFile(name = "a.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
}

describe("createJuntada — create + images (existing 2-step flow)", () => {
  it("creates the post, uploads images in order, and returns the final post", async () => {
    let uploadCount = 0;
    server.use(
      http.post("/api/compartidas", () => HttpResponse.json(CREATED, { status: 201 })),
      http.post("/api/compartidas/c1/images", () => {
        uploadCount += 1;
        return HttpResponse.json(
          Array.from({ length: uploadCount }, (_, i) => ({
            url: `https://cdn/${i}.jpg`,
            publicId: `p${i}`,
          })),
          { status: 201 },
        );
      }),
    );

    const result = await createJuntada({
      payload: { category: "juntada", title: "Juntada" },
      files: [{ file: mockFile("a.jpg") }, { file: mockFile("b.jpg") }],
    });

    expect(uploadCount).toBe(2);
    expect(result.images).toHaveLength(2);
    expect(result._id).toBe("c1");
  });

  it("deletes the orphaned post and re-throws when an image upload fails", async () => {
    let deleted = false;
    server.use(
      http.post("/api/compartidas", () => HttpResponse.json(CREATED, { status: 201 })),
      http.post("/api/compartidas/c1/images", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
      http.delete("/api/compartidas/c1", () => {
        deleted = true;
        return HttpResponse.json({ message: "ok" });
      }),
    );

    await expect(
      createJuntada({
        payload: { category: "juntada", title: "x" },
        files: [{ file: mockFile() }],
      }),
    ).rejects.toBeTruthy();
    expect(deleted).toBe(true);
  });
});

describe("createJuntada — Instagram cross-post (3rd step)", () => {
  it("posts to instagram-post after images upload when a target was requested", async () => {
    let requestBody = null;
    server.use(
      http.post("/api/compartidas", () => HttpResponse.json(CREATED, { status: 201 })),
      http.post("/api/compartidas/c1/images", () =>
        HttpResponse.json([{ url: "https://cdn/a.jpg", publicId: "p0" }], {
          status: 201,
        }),
      ),
      http.post("/api/compartidas/c1/instagram-post", async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { ...CREATED, images: [{ url: "https://cdn/a.jpg" }], instagram: { feed: { status: "pending" } } },
          { status: 202 },
        );
      }),
    );

    const result = await createJuntada({
      payload: { category: "juntada", title: "x" },
      files: [{ file: mockFile() }],
      crosspostInstagram: { feed: true, story: false },
    });

    expect(requestBody).toEqual({ feed: true, story: false });
    expect(result.instagram.feed.status).toBe("pending");
  });

  it("does NOT call instagram-post when no images were uploaded", async () => {
    let called = false;
    server.use(
      http.post("/api/compartidas", () => HttpResponse.json(CREATED, { status: 201 })),
      http.post("/api/compartidas/c1/instagram-post", () => {
        called = true;
        return HttpResponse.json({}, { status: 202 });
      }),
    );

    await createJuntada({
      payload: { category: "juntada", title: "x" },
      files: [],
      crosspostInstagram: { feed: true, story: true },
    });

    expect(called).toBe(false);
  });

  it("does NOT call instagram-post when neither feed nor story was requested", async () => {
    let called = false;
    server.use(
      http.post("/api/compartidas", () => HttpResponse.json(CREATED, { status: 201 })),
      http.post("/api/compartidas/c1/images", () =>
        HttpResponse.json([{ url: "https://cdn/a.jpg", publicId: "p0" }], {
          status: 201,
        }),
      ),
      http.post("/api/compartidas/c1/instagram-post", () => {
        called = true;
        return HttpResponse.json({}, { status: 202 });
      }),
    );

    await createJuntada({
      payload: { category: "juntada", title: "x" },
      files: [{ file: mockFile() }],
      crosspostInstagram: { feed: false, story: false },
    });

    expect(called).toBe(false);
  });

  it("is isolated: an instagram-post failure does NOT delete the compartida or throw", async () => {
    let deleted = false;
    server.use(
      http.post("/api/compartidas", () => HttpResponse.json(CREATED, { status: 201 })),
      http.post("/api/compartidas/c1/images", () =>
        HttpResponse.json([{ url: "https://cdn/a.jpg", publicId: "p0" }], {
          status: 201,
        }),
      ),
      http.post("/api/compartidas/c1/instagram-post", () =>
        HttpResponse.json(
          { message: "Conectá tu cuenta de Instagram" },
          { status: 400 },
        ),
      ),
      http.delete("/api/compartidas/c1", () => {
        deleted = true;
        return HttpResponse.json({ message: "ok" });
      }),
    );

    const result = await createJuntada({
      payload: { category: "juntada", title: "x" },
      files: [{ file: mockFile() }],
      crosspostInstagram: { feed: true, story: false },
    });

    expect(deleted).toBe(false);
    expect(result.instagramCrosspostError).toBe("Conectá tu cuenta de Instagram");
    expect(result._id).toBe("c1");
  });
});

describe("toGamePayload", () => {
  it("maps a BGG search result to the compartida payload shape", () => {
    expect(
      toGamePayload({ id: 13, name: "Catan", thumbnail: "t", image: "i", year: 1995 }),
    ).toEqual({ bggId: 13, name: "Catan", thumbnail: "t", image: "i", year: 1995 });
  });
});
