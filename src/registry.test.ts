import { describe, expect, it } from "vitest";
import {
  computeSkippedSteps,
  getNextStep,
  getRequiredSteps,
  mergePathStateAfterImport,
  scoreRepoDigestCompleteness,
} from "./registry.js";
import type { RepoDigest } from "@majico-xyz/git-providers";

const baseDigest: RepoDigest = {
  provider: "github",
  owner: "acme",
  repo: "saas",
  ref: "main",
  files: [],
};

describe("agent-path registry", () => {
  it("scores digest completeness from file hits", () => {
    const digest: RepoDigest = {
      ...baseDigest,
      files: [
        { path: "docs/design.md", kind: "design_md" },
        { path: "README.md", kind: "readme" },
      ],
      parsed: { paletteTokens: { light: {} } },
    };
    expect(scoreRepoDigestCompleteness(digest)).toBeGreaterThanOrEqual(50);
  });

  it("adds logo asset and package.json to completeness score", () => {
    const digest: RepoDigest = {
      ...baseDigest,
      files: [
        { path: "public/brand/logo/mark.svg", kind: "logo_asset" },
        { path: "package.json", kind: "package_json" },
      ],
    };
    expect(scoreRepoDigestCompleteness(digest)).toBe(20);
  });

  it("returns no skipped steps outside repo_import path", () => {
    expect(computeSkippedSteps("brief_first", baseDigest)).toEqual([]);
  });

  it("does not skip steps when digest score is below 15", () => {
    expect(computeSkippedSteps("repo_import", baseDigest)).toEqual([]);
  });

  it("skips niche/logo when design tokens found", () => {
    const digest: RepoDigest = {
      ...baseDigest,
      files: [{ path: "docs/design.md", kind: "design_md" }],
      parsed: { paletteTokens: { light: { accent: "#f00" } } },
    };
    const skipped = computeSkippedSteps("repo_import", digest);
    expect(skipped).toContain("niche");
    expect(skipped).toContain("logo");
  });

  it("returns next incomplete step for repo_import path", () => {
    const next = getNextStep("repo_import", {
      completedSteps: [],
      skippedSteps: ["brief", "niche", "logo"],
    });
    expect(next).toBe("preview");
  });

  it("mergePathStateAfterImport sets entryRepo and skippedSteps", () => {
    const digest: RepoDigest = {
      ...baseDigest,
      files: [{ path: "README.md", kind: "readme" }],
    };
    const state = mergePathStateAfterImport("repo_import", digest);
    expect(state.entryRepo?.owner).toBe("acme");
    expect(state.skippedSteps).toContain("niche");
  });

  it("skips only niche when digest score is moderate", () => {
    const digest: RepoDigest = {
      ...baseDigest,
      files: [{ path: "README.md", kind: "readme" }],
      parsed: { oneLiner: "Hello" },
    };
    const skipped = computeSkippedSteps("repo_import", digest);
    expect(skipped).toEqual(["niche"]);
  });

  it("skips brief when brand story is present at high completeness", () => {
    const digest: RepoDigest = {
      ...baseDigest,
      files: [
        { path: "docs/design.md", kind: "design_md" },
        { path: "docs/BRAND.md", kind: "brand_md" },
        { path: "README.md", kind: "readme" },
      ],
      parsed: {
        paletteTokens: { light: {} },
        brandStory: "We ship fast.",
      },
    };
    const skipped = computeSkippedSteps("repo_import", digest);
    expect(skipped).toContain("brief");
  });

  it("getNextStep returns export when preview is complete on repo_import", () => {
    const next = getNextStep("repo_import", {
      completedSteps: ["preview"],
      skippedSteps: ["brief", "niche", "logo"],
    });
    expect(next).toBe("export");
  });

  it("getNextStep returns null when all required steps are done", () => {
    expect(
      getNextStep("repo_import", {
        completedSteps: ["preview", "export"],
        skippedSteps: ["brief", "niche", "logo"],
      })
    ).toBeNull();
  });

  it("getNextStep treats missing step arrays as empty", () => {
    expect(getNextStep("repo_import", {})).toBe("preview");
  });

  it("falls back to the full step list for unknown paths", () => {
    expect(getRequiredSteps("unknown" as "brief_first")).toHaveLength(7);
  });
});
