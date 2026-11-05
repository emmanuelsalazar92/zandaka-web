"use client"

import { ArrowRight, CalendarDays, Plus, RefreshCw } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { calculateBudgetPlan } from "@/lib/budget-plan"
import {
  PlanApiError,
  parseSavedPlan,
  planRequest,
  type SavedBudgetPlan,
} from "@/lib/budget-plan-api"
import { formatPlanMoney as formatCurrency } from "@/lib/budget-plan-view"
import { categoryManagement } from "@/lib/navigation"

import styles from "./plan.module.css"

export const planMonth = (value: string) =>
  new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}-01T12:00:00Z`),
  )
export function BudgetPlansList() {
  const [plans, setPlans] = React.useState<SavedBudgetPlan[]>([]),
    [page, setPage] = React.useState(1),
    [pages, setPages] = React.useState(1),
    [busy, setBusy] = React.useState(true),
    [error, setError] = React.useState<string | null>(null),
    [reload, setReload] = React.useState(0)
  React.useEffect(() => {
    const controller = new AbortController()
    setBusy(true)
    setError(null)
    void planRequest<{ items: unknown[]; totalPages: number }>(
      `?page=${page}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (
          !Array.isArray(result.items) ||
          !Number.isInteger(result.totalPages) ||
          result.totalPages < 0
        )
          throw new Error()
        setPlans(result.items.map((item) => parseSavedPlan(item)))
        setPages(Math.max(1, result.totalPages))
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof PlanApiError
              ? cause.message
              : "No pudimos consultar los presupuestos.",
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false)
      })
    return () => controller.abort()
  }, [page, reload])
  return (
    <div className={`marea-surface ${styles.page}`}>
      <PageHeader
        title="Presupuestos"
        description="Prepara el mes y distribuye tu dinero a sobres."
        related={[categoryManagement]}
      >
        <Button asChild>
          <Link href="/budgets/plans/new">
            <Plus aria-hidden="true" className="mr-2 size-4" />
            Nuevo presupuesto
          </Link>
        </Button>
      </PageHeader>
      <div className={styles.listTools}>
        <Link href="/budgets/legacy">Consultar presupuestos anteriores</Link>
        <Button variant="ghost" onClick={() => setReload((n) => n + 1)} disabled={busy}>
          <RefreshCw aria-hidden="true" className="mr-2 size-4" />
          Actualizar
        </Button>
      </div>
      {busy ? (
        <LoadingState>Consultando presupuestos…</LoadingState>
      ) : error ? (
        <Feedback tone="error" title="Presupuestos no disponibles">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setReload((n) => n + 1)}>
            Volver a intentar
          </Button>
        </Feedback>
      ) : plans.length === 0 ? (
        <section className={styles.empty}>
          <CalendarDays aria-hidden="true" />
          <h2>Tu próximo mes empieza aquí</h2>
          <p>
            Vincula un ingreso recibido, define tus asignaciones y revisa cuánto conservarás libre.
          </p>
          <Button asChild>
            <Link href="/budgets/plans/new">Preparar un presupuesto</Link>
          </Button>
        </section>
      ) : (
        <>
          <div className={styles.planList}>
            {plans.map((plan) => {
              const calculation = calculateBudgetPlan(plan.document)
              return (
                <Link className={styles.planCard} key={plan.id} href={`/budgets/plans/${plan.id}`}>
                  <div>
                    <span className={styles.eyebrow}>
                      {plan.status === "draft"
                        ? "Borrador"
                        : plan.status === "finalized"
                          ? "Preparado"
                          : "Asignado a sobres"}
                    </span>
                    <h2>{planMonth(plan.document.month)}</h2>
                    <p>
                      {plan.document.incomeMonth
                        ? `Ingreso de ${planMonth(plan.document.incomeMonth)}`
                        : "Mes del ingreso por definir"}
                    </p>
                  </div>
                  <div className={styles.listAmount}>
                    <strong>
                      {calculation.net === null
                        ? "Ingreso por definir"
                        : formatCurrency(calculation.net, "USD")}
                    </strong>
                    <span>
                      {calculation.free === null
                        ? "Distribución pendiente"
                        : `${formatCurrency(calculation.free, "USD")} libre`}
                    </span>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </Link>
              )
            })}
          </div>
          <div className={styles.pagination}>
            <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span>
              Página {page} de {pages}
            </span>
            <Button
              variant="outline"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
