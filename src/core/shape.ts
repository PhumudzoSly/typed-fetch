import type { ObjectField, ShapeNode, TypedFetchConfig } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function stableSortObject<T>(record: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    sorted[key] = record[key];
  }
  return sorted;
}

function shapeKey(shape: ShapeNode): string {
  return JSON.stringify(sortShape(shape));
}

function sortShape(shape: ShapeNode): ShapeNode {
  if (shape.kind === "array") {
    return { kind: "array", items: sortShape(shape.items) };
  }
  if (shape.kind === "object") {
    const fields = stableSortObject(
      Object.entries(shape.fields).reduce<Record<string, ObjectField>>(
        (acc, [name, field]) => {
          acc[name] = {
            shape: sortShape(field.shape),
            optional: field.optional,
            nullable: field.nullable,
          };
          return acc;
        },
        {}
      )
    );
    return { kind: "object", fields };
  }
  if (shape.kind === "union") {
    const variants = shape.variants
      .map((variant) => sortShape(variant))
      .sort((a, b) => shapeKey(a).localeCompare(shapeKey(b)));
    return { kind: "union", variants };
  }
  return shape;
}

function uniqueVariants(variants: ShapeNode[]): ShapeNode[] {
  const map = new Map<string, ShapeNode>();
  for (const variant of variants.map((v) => sortShape(v))) {
    map.set(shapeKey(variant), variant);
  }
  return Array.from(map.values()).sort((a, b) => shapeKey(a).localeCompare(shapeKey(b)));
}

function normalizeUnion(shape: ShapeNode): ShapeNode {
  if (shape.kind !== "union") {
    return sortShape(shape);
  }

  const flattened: ShapeNode[] = [];
  for (const variant of shape.variants) {
    if (variant.kind === "union") {
      flattened.push(...variant.variants);
    } else {
      flattened.push(variant);
    }
  }

  const variants = uniqueVariants(flattened);
  if (variants.length === 1) {
    return variants[0];
  }
  return { kind: "union", variants };
}

function mergeObjectFields(left: ObjectField, right: ObjectField): ObjectField {
  const nullable = Boolean(left.nullable || right.nullable);
  const optional = Boolean(left.optional || right.optional);
  return {
    shape: mergeShapes(left.shape, right.shape),
    optional: optional || undefined,
    nullable: nullable || undefined,
  };
}

function mergeUnionWith(shape: ShapeNode, other: ShapeNode): ShapeNode {
  const variants =
    shape.kind === "union" ? [...shape.variants, other] : [shape, other];
  return normalizeUnion({ kind: "union", variants });
}

export function inferShape(
  value: unknown,
  config: Pick<TypedFetchConfig, "maxDepth" | "maxArraySample" | "ignoreFieldNames">,
  depth = 0
): ShapeNode {
  if (depth > config.maxDepth) {
    return { kind: "unknown" };
  }

  if (value === undefined) {
    return { kind: "void" };
  }
  if (value === null) {
    return { kind: "null" };
  }
  if (typeof value === "string") {
    return { kind: "string" };
  }
  if (typeof value === "number") {
    return { kind: "number" };
  }
  if (typeof value === "boolean") {
    return { kind: "boolean" };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { kind: "array", items: { kind: "unknown" } };
    }

    const sample = value.slice(0, config.maxArraySample);
    let itemsShape = inferShape(sample[0], config, depth + 1);
    for (let index = 1; index < sample.length; index += 1) {
      itemsShape = mergeShapes(
        itemsShape,
        inferShape(sample[index], config, depth + 1)
      );
    }
    return { kind: "array", items: itemsShape };
  }

  if (isPlainObject(value)) {
    const fields: Record<string, ObjectField> = {};
    const entries = Object.entries(value).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [fieldName, fieldValue] of entries) {
      if (config.ignoreFieldNames.includes(fieldName.toLowerCase())) {
        continue;
      }

      const optional = fieldValue === undefined || undefined;
      const nullable = fieldValue === null || undefined;
      fields[fieldName] = {
        shape: inferShape(fieldValue, config, depth + 1),
        optional,
        nullable,
      };
    }
    return { kind: "object", fields };
  }

  return { kind: "unknown" };
}

export function mergeShapes(left: ShapeNode, right: ShapeNode): ShapeNode {
  if (shapeKey(left) === shapeKey(right)) {
    return left;
  }

  if (left.kind === "union" || right.kind === "union") {
    return mergeUnionWith(left, right);
  }

  if (left.kind === "object" && right.kind === "object") {
    const allFieldNames = new Set([
      ...Object.keys(left.fields),
      ...Object.keys(right.fields),
    ]);
    const mergedFields: Record<string, ObjectField> = {};

    for (const fieldName of Array.from(allFieldNames).sort((a, b) => a.localeCompare(b))) {
      const leftField = left.fields[fieldName];
      const rightField = right.fields[fieldName];

      if (leftField && rightField) {
        mergedFields[fieldName] = mergeObjectFields(leftField, rightField);
      } else if (leftField) {
        mergedFields[fieldName] = { ...leftField, optional: true };
      } else if (rightField) {
        mergedFields[fieldName] = { ...rightField, optional: true };
      }
    }

    return { kind: "object", fields: mergedFields };
  }

  if (left.kind === "array" && right.kind === "array") {
    return {
      kind: "array",
      items: mergeShapes(left.items, right.items),
    };
  }

  return normalizeUnion({ kind: "union", variants: [left, right] });
}

export function serializeShape(shape: ShapeNode): ShapeNode {
  return sortShape(shape);
}

export function shapeToTypeScript(shape: ShapeNode): string {
  switch (shape.kind) {
    case "void":
      return "void";
    case "unknown":
      return "unknown";
    case "null":
      return "null";
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "array":
      return `Array<${shapeToTypeScript(shape.items)}>`;
    case "object": {
      const fields = Object.keys(shape.fields)
        .sort((a, b) => a.localeCompare(b))
        .map((fieldName) => {
          const field = shape.fields[fieldName];
          const optional = field.optional ? "?" : "";
          const nullable = field.nullable ? " | null" : "";
          return `${JSON.stringify(fieldName)}${optional}: ${shapeToTypeScript(
            field.shape
          )}${nullable};`;
        });
      return `{ ${fields.join(" ")} }`;
    }
    case "union": {
      const variants = uniqueVariants(shape.variants).map((variant) =>
        shapeToTypeScript(variant)
      );
      return variants.join(" | ");
    }
    default:
      return "unknown";
  }
}

