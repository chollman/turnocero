const {
  emitToUser,
  emitToTableRoom,
  emitToEventoRoom,
  emitToEventosList,
  emitToAdminRoom,
} = require("../../../utils/socketHelpers");

function makeIo() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  const io = { to };
  return { io, to, emit };
}

function makeReq(io) {
  return {
    app: {
      get: vi.fn((key) => (key === "io" ? io : null)),
    },
  };
}

describe("socketHelpers", () => {
  describe("emitToUser", () => {
    it("emite al room user:<id>", () => {
      const { io, to, emit } = makeIo();
      emitToUser(makeReq(io), "abc123", "user:event", { foo: 1 });
      expect(to).toHaveBeenCalledWith("user:abc123");
      expect(emit).toHaveBeenCalledWith("user:event", { foo: 1 });
    });

    it("acepta ObjectId con .toString()", () => {
      const { io, to } = makeIo();
      const userId = { toString: () => "objid" };
      emitToUser(makeReq(io), userId, "user:event", {});
      expect(to).toHaveBeenCalledWith("user:objid");
    });

    it("ignora si no hay userId", () => {
      const { io, to } = makeIo();
      emitToUser(makeReq(io), null, "user:event", {});
      emitToUser(makeReq(io), undefined, "user:event", {});
      emitToUser(makeReq(io), "", "user:event", {});
      expect(to).not.toHaveBeenCalled();
    });

    it("ignora si no hay eventName", () => {
      const { io, to } = makeIo();
      emitToUser(makeReq(io), "abc", "", {});
      expect(to).not.toHaveBeenCalled();
    });

    it("no tira si req.app.get throws", () => {
      const req = {
        app: {
          get: () => {
            throw new Error("boom");
          },
        },
      };
      expect(() => emitToUser(req, "abc", "event", {})).not.toThrow();
    });

    it("no tira si io.to throws", () => {
      const req = {
        app: {
          get: () => ({
            to: () => {
              throw new Error("boom");
            },
          }),
        },
      };
      expect(() => emitToUser(req, "abc", "event", {})).not.toThrow();
    });

    it("es no-op si io no está en app.get", () => {
      const req = { app: { get: () => null } };
      expect(() => emitToUser(req, "abc", "event", {})).not.toThrow();
    });
  });

  describe("emitToTableRoom", () => {
    it("emite a table:<id>", () => {
      const { io, to } = makeIo();
      emitToTableRoom(makeReq(io), "tid", "chat:message", {});
      expect(to).toHaveBeenCalledWith("table:tid");
    });
  });

  describe("emitToEventoRoom", () => {
    it("emite a evento:<id>", () => {
      const { io, to } = makeIo();
      emitToEventoRoom(makeReq(io), "eid", "evento:update", {});
      expect(to).toHaveBeenCalledWith("evento:eid");
    });
  });

  describe("emitToEventosList", () => {
    it("emite al room broadcast eventos:list", () => {
      const { io, to, emit } = makeIo();
      emitToEventosList(makeReq(io), "evento:new", { id: 1 });
      expect(to).toHaveBeenCalledWith("eventos:list");
      expect(emit).toHaveBeenCalledWith("evento:new", { id: 1 });
    });
  });

  describe("emitToAdminRoom", () => {
    it("emite al room admin:room", () => {
      const { io, to } = makeIo();
      emitToAdminRoom(makeReq(io), "admin:msg", {});
      expect(to).toHaveBeenCalledWith("admin:room");
    });
  });
});
