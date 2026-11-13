import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPotAddress } from "./chain";
import { assertPotAddress as reexported } from "./index";

const VALID = "0xf842F699128A2e575d20BcC92F0472C7ad59e5C8";

describe("assertPotAddress", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when NEXT_PUBLIC_POT_ADDRESS is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", undefined);
    expect(() => assertPotAddress()).toThrow("NEXT_PUBLIC_POT_ADDRESS is not set");
  });

  it("treats an empty or whitespace-only value as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", "");
    expect(() => assertPotAddress()).toThrow("NEXT_PUBLIC_POT_ADDRESS is not set");
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", "   ");
    expect(() => assertPotAddress()).toThrow("NEXT_PUBLIC_POT_ADDRESS is not set");
  });

  it("returns a whitespace-padded valid address trimmed", () => {
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", `  ${VALID}\n`);
    expect(assertPotAddress()).toBe(VALID);
  });

  it("rejects an invalid address and names the bad value", () => {
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", "0x123");
    expect(() => assertPotAddress()).toThrow('NEXT_PUBLIC_POT_ADDRESS is not a valid address: "0x123"');
  });

  it("rejects a mixed-case address with a bad checksum (strict)", () => {
    const badChecksum = "0xF842F699128A2e575d20BcC92F0472C7ad59e5C8";
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", badChecksum);
    expect(() => assertPotAddress()).toThrow(`NEXT_PUBLIC_POT_ADDRESS is not a valid address: "${badChecksum}"`);
  });

  it("rejects the zero address", () => {
    const zero = "0x0000000000000000000000000000000000000000";
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", zero);
    expect(() => assertPotAddress()).toThrow(`NEXT_PUBLIC_POT_ADDRESS is the zero address: "${zero}"`);
  });

  it("is re-exported from @/lib/pot", () => {
    expect(reexported).toBe(assertPotAddress);
  });
});

describe("POT_ADDRESS", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("exports a whitespace-padded address trimmed", async () => {
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", `  ${VALID}\n`);
    vi.resetModules();

    const { POT_ADDRESS } = await import("./chain");
    expect(POT_ADDRESS).toBe(VALID);
  });

  it("exports undefined when the address is all whitespace", async () => {
    vi.stubEnv("NEXT_PUBLIC_POT_ADDRESS", "  \t\n");
    vi.resetModules();

    const { POT_ADDRESS } = await import("./chain");
    expect(POT_ADDRESS).toBeUndefined();
  });
});
