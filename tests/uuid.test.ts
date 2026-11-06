import { afterEach, describe, expect, it, vi } from "vitest"

import { secureUuid } from "@/lib/uuid"

afterEach(() => vi.unstubAllGlobals())
describe("secure UUID generation on LAN HTTP", () => {
  it("uses getRandomValues without randomUUID and sets the version and variant bits", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => bytes.fill(255))
    vi.stubGlobal("crypto", { getRandomValues })
    expect(secureUuid()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff")
    expect(getRandomValues).toHaveBeenCalledOnce()
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(16)
  })
  it("fails closed when secure randomness is unavailable", () => {
    vi.stubGlobal("crypto", {})
    expect(() => secureUuid()).toThrow("Secure random generation is unavailable")
  })
})
