import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fundPlan,
  parseSavedPlan,
  PlanApiError,
  planRequest,
  savePlan,
} from "@/lib/budget-plan-api"

import { exampleSavedPlan, planId } from "./fixtures/budget-plan"

afterEach(() => vi.unstubAllGlobals())
describe("budget response and retry boundary", () => {
  it("rejects a different plan or user in a successful-looking response", () => {
    expect(() => parseSavedPlan({ ...exampleSavedPlan(), userId: 2 }, planId)).toThrow(PlanApiError)
    expect(() =>
      parseSavedPlan(exampleSavedPlan(), "00000000-0000-4000-8000-000000000098"),
    ).toThrow(PlanApiError)
  })
  it("does not accept funded status without a coherent receipt", () => {
    expect(() => parseSavedPlan({ ...exampleSavedPlan(), status: "funded" })).toThrow(PlanApiError)
  })
  it("does not accept a save acknowledgement with another document or revision", async () => {
    const plan = exampleSavedPlan()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...plan,
            revision: 2,
            document: { ...plan.document, incomeMonth: "2026-04" },
          }),
        ),
      ),
    )
    await expect(savePlan(planId, 1, plan.document)).rejects.toMatchObject({ uncertain: true })
  })
  it("keeps transport and malformed-success outcomes uncertain for writes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("private diagnostic")))
    await expect(planRequest("/x", "PUT", {})).rejects.toMatchObject({ uncertain: true })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")))
    await expect(planRequest("/x", "POST", {})).rejects.toMatchObject({ uncertain: true })
  })
  it("does not expose server exception text and treats missing setup as a definitive rejection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "FEATURE_NOT_READY", message: "secret path /app/private" },
          }),
          { status: 503 },
        ),
      ),
    )
    await expect(planRequest("/x", "PUT", {})).rejects.toMatchObject({
      uncertain: false,
      message: "La planificación de presupuestos aún no está habilitada en este entorno.",
    })
  })
  it("requires the original request, revision, date and every line in the funding receipt", async () => {
    const plan = exampleSavedPlan()
    const requestId = "20000000-0000-4000-8000-000000000001"
    const forged = {
      ...plan,
      status: "funded",
      revision: 3,
      receipt: {
        requestId,
        date: "2026-11-01",
        revision: 2,
        postedAt: "2026-11-01T00:00:00Z",
        transactions: [],
      },
    }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(forged))))
    await expect(fundPlan(planId, 2, requestId, "2026-11-01")).rejects.toMatchObject({
      uncertain: true,
    })
  })
})
