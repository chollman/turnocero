const mongoose = require("mongoose");
const communityScoped = require("../../../models/plugins/communityScoped");
const SCOPED_MODELS = require("../../../config/scopedModels");

describe("communityScoped plugin", () => {
  it("adds a community ObjectId path that refs Community", () => {
    const schema = new mongoose.Schema({ x: String });
    schema.plugin(communityScoped);
    const path = schema.path("community");
    expect(path).toBeDefined();
    expect(path.instance).toBe("ObjectId");
    expect(path.options.ref).toBe("Community");
  });

  it("keeps community optional at the model level (route default + guardrail cover the risk)", () => {
    expect(communityScoped.COMMUNITY_REQUIRED).toBe(false);
    const schema = new mongoose.Schema({});
    schema.plugin(communityScoped);
    expect(schema.path("community").isRequired).toBeFalsy();
  });

  it("builds compound indexes with community as the leader", () => {
    const schema = new mongoose.Schema({});
    schema.plugin(communityScoped, { indexes: [{ status: 1, date: 1 }] });
    const found = schema
      .indexes()
      .some(
        ([def]) =>
          def.community === 1 && def.status === 1 && def.date === 1,
      );
    expect(found).toBe(true);
  });

  it("falls back to a single-field community index when none are given", () => {
    const schema = new mongoose.Schema({});
    schema.plugin(communityScoped);
    const found = schema
      .indexes()
      .some(([def]) => def.community === 1 && Object.keys(def).length === 1);
    expect(found).toBe(true);
  });
});

describe("scopedModels registry", () => {
  it("registers exactly the six content models", () => {
    expect(SCOPED_MODELS).toHaveLength(6);
    const labels = SCOPED_MODELS.map((m) => m.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        "Mesas",
        "Compartidas",
        "Eventos",
        "Torneos",
        "Noticias",
        "Math Trades",
      ]),
    );
  });

  it("every registered model carries the community path + an index on it", () => {
    for (const { model, label } of SCOPED_MODELS) {
      expect(model.schema.path("community"), `${label} community path`).toBeDefined();
      const hasIdx = model.schema
        .indexes()
        .some(([def]) => def.community === 1);
      expect(hasIdx, `${label} community index`).toBe(true);
    }
  });
});
