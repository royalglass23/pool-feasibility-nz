import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { homeownerAssessments } from "@/db/schema";

describe("builder company persistence migration", () => {
  it("adds one nullable company column without rewriting legacy records", () => {
    const sql = readFileSync(
      path.resolve(process.cwd(), "drizzle/0010_soft_dormammu.sql"),
      "utf8",
    ).trim();

    expect(homeownerAssessments.builderCompanyName.name).toBe(
      "builder_company_name",
    );
    expect(sql).toBe(
      'ALTER TABLE "homeowner_assessments" ADD COLUMN "builder_company_name" text;',
    );
    expect(sql).not.toMatch(/not null|update|delete/i);
  });
});
