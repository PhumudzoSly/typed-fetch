const test = require("node:test");
const assert = require("node:assert/strict");

const { inferShape, mergeShapes, shapeToTypeScript } = require("../dist/core/shape");

const baseConfig = {
  maxDepth: 8,
  maxArraySample: 32,
  ignoreFieldNames: ["password", "token", "secret", "authorization"],
};

test("infers object shape and ignores sensitive fields", () => {
  const shape = inferShape(
    {
      id: 1,
      profile: { name: "Ada" },
      token: "dont-store",
    },
    baseConfig
  );

  assert.equal(shape.kind, "object");
  assert.ok(shape.fields.id);
  assert.ok(shape.fields.profile);
  assert.equal(shape.fields.token, undefined);
});

test("merges object shapes with optional and nullable fields", () => {
  const left = inferShape({ id: 1, email: "a@example.com" }, baseConfig);
  const right = inferShape({ id: 2, email: null, nickname: "A" }, baseConfig);
  const merged = mergeShapes(left, right);

  assert.equal(merged.kind, "object");
  assert.equal(merged.fields.email.nullable, true);
  assert.equal(merged.fields.nickname.optional, true);
});

test("renders unions to TypeScript", () => {
  const merged = mergeShapes(
    inferShape({ value: 1 }, baseConfig),
    inferShape({ value: "one" }, baseConfig)
  );

  const ts = shapeToTypeScript(merged);
  assert.match(ts, /number \| string/);
});

