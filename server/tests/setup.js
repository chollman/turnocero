const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const crypto = require("crypto");

// Test-only env vars (set BEFORE any module that reads process.env)
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-vitest";
process.env.BGG_CREDS_KEY =
  process.env.BGG_CREDS_KEY || crypto.randomBytes(32).toString("hex");
process.env.CORS_ORIGIN = "http://localhost:3000";
// Stub Cloudinary creds so the SDK config call doesn't blow up at load time.
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
process.env.CLOUDINARY_API_KEY = "test-key";
process.env.CLOUDINARY_API_SECRET = "test-secret";

// ── Monkey-patch external boundaries BEFORE app/routes are loaded ──
// `vi.mock` doesn't reliably intercept CommonJS `require()` in vitest 4, so we
// mutate the actual module exports here. Anything that requires these modules
// later gets the patched versions transparently.

// Cloudinary wrapper: replace uploadToCloudinary + destroy with vi.fn() stubs
// (test files can access them via require('../mocks/cloudinary')).
const cloudMock = require("./mocks/cloudinary");
const cloudWrapper = require("../config/cloudinary");
cloudWrapper.uploadToCloudinary = cloudMock.uploadToCloudinary;
Object.assign(cloudWrapper.cloudinary.uploader, cloudMock.cloudinary.uploader);

// Email wrapper: replace sendEmail only (the actual network boundary). The
// pure template helpers (verificationEmail, passwordResetEmail) are left
// intact so their unit tests still exercise real logic.
const emailMock = require("./mocks/email");
const emailWrapper = require("../utils/email");
emailWrapper.sendEmail = emailMock.sendEmail;

// express-rate-limit: no-op so test suites can spam endpoints without 429s.
// Mutate require.cache so any subsequent `require('express-rate-limit')` gets
// our pass-through factory.
const rlPath = require.resolve("express-rate-limit");
const noopFactory = () => (_req, _res, next) => next();
// Soportar tanto `require('express-rate-limit')` (default export) como el
// destructuring `{ rateLimit, ipKeyGenerator }` que usa userRateLimit.js.
noopFactory.default = noopFactory;
noopFactory.rateLimit = noopFactory;
noopFactory.ipKeyGenerator = (req) => req.ip || "test-ip";
require.cache[rlPath] = {
  id: rlPath,
  filename: rlPath,
  loaded: true,
  exports: noopFactory,
};

// ── Socket.IO stub ───────────────────────────────────────────────────
// Many routes call `req.app.get('io').to('room').emit(...)`. In tests there
// is no real Socket.IO server, so we install a no-op stub that exposes the
// same surface and records emits for assertions.
const ioStub = {
  emitted: [],
  to(room) {
    const self = this;
    return {
      emit(event, payload) {
        self.emitted.push({ room, event, payload });
      },
    };
  },
  emit(event, payload) {
    this.emitted.push({ room: null, event, payload });
  },
  __reset() {
    this.emitted = [];
  },
};

// Expose globally so any test file can assert on emitted events.
global.__ioStub = ioStub;

// ── Mongo lifecycle ──────────────────────────────────────────────────
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  // Lazy-require app AFTER monkey-patches and Mongo are ready; cache it so
  // every test file's `require('../../app')` reuses the same instance.
  const app = require("../app");
  app.set("io", ioStub);
  // Wait for every model's indexes (incluyendo los `unique: true`) to finish
  // building. Mongoose programa el index build async cuando se conecta — si un
  // test corre antes de que termine, las constraints unique no se enforcean y
  // un duplicate insert se cuela silenciosamente. Pasó con el test de
  // duplicate-email en register cuando se corría aislado con `-t`.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  // El caché del singleton base de Community guarda el _id; al limpiar las
  // colecciones entre tests ese id queda stale. Resetear para que el próximo
  // getBase()/ensureBase() vuelva a consultar/crear.
  require("../models/Community").__resetBaseCache();
  // Idem para el caché de tenants (slug→comunidad) — sin reset, un slug
  // resuelto (o un negativo) de un test contaminaría al siguiente.
  require("../models/Community").__resetTenantCache();
  // Limpiar los emits acumulados del socket stub para que un test no vea
  // eventos emitidos por el anterior (los tests que assertean sobre emits ya
  // no dependen de un __reset() manual previo).
  ioStub.__reset();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});
