// Unit tests para services/instagramService.js — todas las llamadas a la
// Graph API van por `fetch`, que acá se mockea (nunca pega a Meta real).

process.env.FB_APP_ID = "test-fb-app";
process.env.FB_APP_SECRET = "test-fb-secret";

const instagramService = require("../../../services/instagramService");

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

afterEach(() => {
  delete global.fetch;
});

describe("instagramService.validateAccessToken", () => {
  it("resolves when the token is valid and has all required scopes", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        data: {
          is_valid: true,
          app_id: process.env.FB_APP_ID,
          scopes: [
            "instagram_basic",
            "instagram_content_publish",
            "pages_show_list",
            "pages_read_engagement",
            "public_profile",
          ],
        },
      }),
    );
    await expect(
      instagramService.validateAccessToken("tok"),
    ).resolves.toMatchObject({ is_valid: true });
  });

  it("throws 401 when the token is invalid", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ data: { is_valid: false } }),
    );
    await expect(instagramService.validateAccessToken("tok")).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it("throws 401 when the app_id doesn't match (token substitution)", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ data: { is_valid: true, app_id: "someone-elses-app" } }),
    );
    await expect(instagramService.validateAccessToken("tok")).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it("throws 400 listing missing scopes", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({
        data: {
          is_valid: true,
          app_id: process.env.FB_APP_ID,
          scopes: ["instagram_basic"],
        },
      }),
    );
    await expect(
      instagramService.validateAccessToken("tok"),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("instagram_content_publish"),
    });
  });

  it("throws 503 when FB_APP_ID/FB_APP_SECRET aren't configured", async () => {
    const prevId = process.env.FB_APP_ID;
    delete process.env.FB_APP_ID;
    await expect(instagramService.validateAccessToken("tok")).rejects.toMatchObject(
      { status: 503 },
    );
    process.env.FB_APP_ID = prevId;
  });
});

describe("instagramService.exchangeLongLivedToken", () => {
  it("returns the long-lived access token", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ access_token: "long-lived-token", expires_in: 5184000 }),
    );
    await expect(
      instagramService.exchangeLongLivedToken("short-lived"),
    ).resolves.toBe("long-lived-token");
  });

  it("throws 502 when Meta doesn't return an access_token", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}));
    await expect(
      instagramService.exchangeLongLivedToken("short-lived"),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("throws when the Graph API responds with an error payload", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid token" } }, false, 400),
    );
    await expect(
      instagramService.exchangeLongLivedToken("short-lived"),
    ).rejects.toThrow(/Invalid token/);
  });
});

describe("instagramService.findInstagramPage", () => {
  it("returns the first page with a linked Instagram Business account", async () => {
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/me/accounts")) {
        return jsonResponse({
          data: [
            { id: "page-1", name: "Page One", access_token: "page-1-token" },
            { id: "page-2", name: "Page Two", access_token: "page-2-token" },
          ],
        });
      }
      if (u.includes("/page-1")) {
        return jsonResponse({ instagram_business_account: undefined });
      }
      if (u.includes("/page-2")) {
        return jsonResponse({ instagram_business_account: { id: "ig-user-2" } });
      }
      throw new Error(`unexpected url: ${u}`);
    });

    await expect(
      instagramService.findInstagramPage("long-lived"),
    ).resolves.toEqual({
      pageId: "page-2",
      pageName: "Page Two",
      pageAccessToken: "page-2-token",
      igUserId: "ig-user-2",
    });
  });

  it("returns null when no page has Instagram linked", async () => {
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/me/accounts")) {
        return jsonResponse({
          data: [{ id: "page-1", name: "Page One", access_token: "tok" }],
        });
      }
      return jsonResponse({ instagram_business_account: undefined });
    });

    await expect(instagramService.findInstagramPage("long-lived")).resolves.toBeNull();
  });

  it("returns null when the user manages no pages", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ data: [] }));
    await expect(instagramService.findInstagramPage("long-lived")).resolves.toBeNull();
  });
});

describe("instagramService.fetchIgUsername", () => {
  it("returns the @handle", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ username: "mesa.de.juegos" }));
    await expect(
      instagramService.fetchIgUsername("ig-user-1", "page-token"),
    ).resolves.toBe("mesa.de.juegos");
  });

  it("returns an empty string when the field is missing", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}));
    await expect(
      instagramService.fetchIgUsername("ig-user-1", "page-token"),
    ).resolves.toBe("");
  });
});

describe("instagramService.buildCaption", () => {
  it("joins title, body, and game names", () => {
    const caption = instagramService.buildCaption({
      title: "Juntada épica",
      body: "Jugamos varias partidas",
      boardGames: [{ name: "Catan" }, { name: "Wingspan" }],
    });
    expect(caption).toBe(
      "Juntada épica\n\nJugamos varias partidas\n\nCatan · Wingspan",
    );
  });

  it("skips missing fields without leaving stray separators", () => {
    expect(instagramService.buildCaption({ title: "Solo título" })).toBe(
      "Solo título",
    );
    expect(instagramService.buildCaption({})).toBe("");
  });

  it("truncates to Instagram's 2200-char caption limit", () => {
    const caption = instagramService.buildCaption({
      title: "x".repeat(3000),
    });
    expect(caption.length).toBe(2200);
    expect(caption.endsWith("…")).toBe(true);
  });
});

describe("instagramService.createImageContainer", () => {
  it("returns the container id for a standalone Feed image", async () => {
    let sentParams = null;
    global.fetch = vi.fn(async (url, opts) => {
      sentParams = new URLSearchParams(opts.body);
      return jsonResponse({ id: "container-1" });
    });
    const id = await instagramService.createImageContainer({
      igUserId: "ig-1",
      pageAccessToken: "tok",
      imageUrl: "https://cdn/img.jpg",
      caption: "hola",
    });
    expect(id).toBe("container-1");
    expect(sentParams.get("caption")).toBe("hola");
    expect(sentParams.get("is_carousel_item")).toBeNull();
  });

  it("omits caption and sets is_carousel_item for carousel children", async () => {
    let sentParams = null;
    global.fetch = vi.fn(async (url, opts) => {
      sentParams = new URLSearchParams(opts.body);
      return jsonResponse({ id: "child-1" });
    });
    await instagramService.createImageContainer({
      igUserId: "ig-1",
      pageAccessToken: "tok",
      imageUrl: "https://cdn/img.jpg",
      caption: "should be ignored",
      isCarouselItem: true,
    });
    expect(sentParams.get("is_carousel_item")).toBe("true");
    expect(sentParams.get("caption")).toBeNull();
  });

  it("throws 502 when Meta doesn't return a container id", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}));
    await expect(
      instagramService.createImageContainer({
        igUserId: "ig-1",
        pageAccessToken: "tok",
        imageUrl: "https://cdn/img.jpg",
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe("instagramService.createCarouselContainer", () => {
  it("joins children ids and passes media_type CAROUSEL", async () => {
    let sentParams = null;
    global.fetch = vi.fn(async (url, opts) => {
      sentParams = new URLSearchParams(opts.body);
      return jsonResponse({ id: "carousel-1" });
    });
    const id = await instagramService.createCarouselContainer({
      igUserId: "ig-1",
      pageAccessToken: "tok",
      childrenIds: ["child-1", "child-2"],
      caption: "hola",
    });
    expect(id).toBe("carousel-1");
    expect(sentParams.get("media_type")).toBe("CAROUSEL");
    expect(sentParams.get("children")).toBe("child-1,child-2");
    expect(sentParams.get("caption")).toBe("hola");
  });
});

describe("instagramService.createStoryContainer", () => {
  it("passes media_type STORIES", async () => {
    let sentParams = null;
    global.fetch = vi.fn(async (url, opts) => {
      sentParams = new URLSearchParams(opts.body);
      return jsonResponse({ id: "story-1" });
    });
    const id = await instagramService.createStoryContainer({
      igUserId: "ig-1",
      pageAccessToken: "tok",
      imageUrl: "https://cdn/img.jpg",
    });
    expect(id).toBe("story-1");
    expect(sentParams.get("media_type")).toBe("STORIES");
  });
});

describe("instagramService.pollContainerStatus", () => {
  it("resolves immediately when status_code is FINISHED", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ status_code: "FINISHED" }));
    await expect(
      instagramService.pollContainerStatus("container-1", "tok", {
        intervalMs: 0,
      }),
    ).resolves.toBeUndefined();
  });

  it("polls until FINISHED", async () => {
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      return jsonResponse({
        status_code: calls < 3 ? "IN_PROGRESS" : "FINISHED",
      });
    });
    await instagramService.pollContainerStatus("container-1", "tok", {
      intervalMs: 0,
      maxAttempts: 5,
    });
    expect(calls).toBe(3);
  });

  it("throws when status_code is ERROR", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ status_code: "ERROR" }));
    await expect(
      instagramService.pollContainerStatus("container-1", "tok", {
        intervalMs: 0,
      }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("throws after exhausting maxAttempts still IN_PROGRESS", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ status_code: "IN_PROGRESS" }));
    await expect(
      instagramService.pollContainerStatus("container-1", "tok", {
        intervalMs: 0,
        maxAttempts: 3,
      }),
    ).rejects.toMatchObject({ status: 502 });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

describe("instagramService.publishContainer", () => {
  it("returns the published media id", async () => {
    global.fetch = vi.fn(async () => jsonResponse({ id: "media-1" }));
    await expect(
      instagramService.publishContainer("container-1", "ig-1", "tok"),
    ).resolves.toBe("media-1");
  });

  it("throws 502 when Meta doesn't return a media id", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}));
    await expect(
      instagramService.publishContainer("container-1", "ig-1", "tok"),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe("instagramService.fetchPermalink", () => {
  it("returns the permalink", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ permalink: "https://instagram.com/p/abc123" }),
    );
    await expect(
      instagramService.fetchPermalink("media-1", "tok"),
    ).resolves.toBe("https://instagram.com/p/abc123");
  });

  it("returns an empty string when missing", async () => {
    global.fetch = vi.fn(async () => jsonResponse({}));
    await expect(instagramService.fetchPermalink("media-1", "tok")).resolves.toBe(
      "",
    );
  });
});

describe("instagramService error mapping (OAuthException → 401)", () => {
  it("marks a revoked/expired token error as 401 with igErrorType set", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(
        {
          error: {
            message: "Error validating access token",
            type: "OAuthException",
            code: 190,
          },
        },
        false,
        400,
      ),
    );
    await expect(
      instagramService.publishContainer("container-1", "ig-1", "expired-tok"),
    ).rejects.toMatchObject({ status: 401, igErrorType: "OAuthException", igErrorCode: 190 });
  });
});
