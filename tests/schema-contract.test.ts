import { describe, expect, it } from "vitest";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractionSchema } from "@/lib/domain/schema";

/**
 * The same zod schema is sent to Claude as a JSON-schema output format. This guards against accidentally using
 * constructs the structured-output subset doesn't support (numeric bounds, string patterns, $ref recursion...).
 */
describe("Claude structured-output schema", () => {
  const fmt = zodOutputFormat(ExtractionSchema) as unknown as { type: string; schema: Record<string, unknown> };
  const text = JSON.stringify(fmt.schema);

  it("is a closed JSON schema", () => {
    expect(fmt.type).toBe("json_schema");
    expect(text).toContain('"additionalProperties":false');
  });
  it("only uses local, non-recursive $ref definitions", () => {
    const defs = (fmt.schema["$defs"] ?? {}) as Record<string, unknown>;
    const refs = [...text.matchAll(/"\$ref":"([^"]+)"/g)].map((m) => m[1]);
    for (const r of refs) expect(r).toMatch(/^#\/\$defs\//);
    // a definition must never reference itself (recursion is unsupported)
    for (const [name, def] of Object.entries(defs)) expect(JSON.stringify(def)).not.toContain(`"#/$defs/${name}"`);
  });
  it("avoids unsupported constraints", () => {
    for (const bad of ["minimum", "maximum", "minLength", "maxLength", "pattern", "minItems", "maxItems", "oneOf"]) {
      expect(text, `schema must not contain ${bad}`).not.toContain(`"${bad}"`);
    }
  });
});
