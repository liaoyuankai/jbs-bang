import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { MAX_BYTES, MAX_FILES } from "@/lib/uploads";

function parseSize(v: unknown): number {
  if (typeof v === "number") return v;
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/i.exec(String(v ?? ""));
  if (!m) return 0;
  const n = Number(m[1]);
  return { b: n, kb: n * 1024, mb: n * 1024 ** 2, gb: n * 1024 ** 3 }[m[2].toLowerCase()]!;
}

describe("next.config", () => {
  it("raises the server-action body limit above the evidence upload budget", () => {
    const limit = (nextConfig.experimental as { serverActions?: { bodySizeLimit?: unknown } } | undefined)
      ?.serverActions?.bodySizeLimit;
    expect(parseSize(limit)).toBeGreaterThanOrEqual(MAX_FILES * MAX_BYTES + 512 * 1024);
  });

  it("builds a standalone server for the docker image", () => {
    expect(nextConfig.output).toBe("standalone");
  });
});
