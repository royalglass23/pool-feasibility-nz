import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  addressNumberFromQuery,
  addressTsQuery,
} from "@/modules/address-search/neon-linz-address-search";

describe("addressTsQuery", () => {
  it("keeps house suffixes distinct and creates prefix-token search", () => {
    expect(addressTsQuery("42A Bahari")).toBe("42a:* & bahari:*");
    expect(addressTsQuery("42 Bahari")).toBe("42:* & bahari:*");
  });

  it("normalizes whitespace and rejects an empty search", () => {
    expect(addressTsQuery("  Bahari   Drive ")).toBe("bahari:* & drive:*");
    expect(addressTsQuery("---")).toBeNull();
  });

  it("keeps an exact house number available for deterministic result ordering", () => {
    expect(addressNumberFromQuery("42A Bahari Drive")).toBe("42a");
    expect(addressNumberFromQuery("42 Bahari Drive")).toBe("42");
    expect(addressNumberFromQuery("Bahari Drive")).toBeNull();
  });
});
