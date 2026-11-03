"use client"

import { Loader2, Sparkles } from "lucide-react"

import { MoneyDisplay } from "@/components/budgets/money-display"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { NetSalaryCalculation } from "@/lib/settings-api"

type BudgetSummaryCardProps = {
  currency: string
  grossSalary: number
  ccssDeduction: number
  incomeTaxDeduction: number
  exchangeLossDeduction: number
  finalBudgetIncome: number
  payrollAvailable: boolean
  payrollLoading: boolean
  payrollRulesLabel: string | null
  preview: NetSalaryCalculation | null
}

type SummaryRowProps = {
  label: string
  amount: number
  currency: string
  tone?: "default" | "muted" | "positive" | "negative"
}

function SummaryRow({ label, amount, currency, tone = "default" }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <MoneyDisplay amount={amount} currency={currency} tone={tone} className="text-right" />
    </div>
  )
}

export function BudgetSummaryCard({
  currency,
  grossSalary,
  ccssDeduction,
  incomeTaxDeduction,
  exchangeLossDeduction,
  finalBudgetIncome,
  payrollAvailable,
  payrollLoading,
  payrollRulesLabel,
  preview,
}: BudgetSummaryCardProps) {
  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/8 via-card to-card">
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>4. Resumen de resultados</CardTitle>
          <CardDescription>
            Revisa el cálculo de nómina y el ingreso final del presupuesto.
          </CardDescription>
        </div>
        <CardAction>
          {payrollLoading ? (
            <Badge variant="outline" className="gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Actualizando cálculo
            </Badge>
          ) : payrollRulesLabel ? (
            <Badge variant="outline">Reglas de nómina utilizadas: {payrollRulesLabel}</Badge>
          ) : null}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <SummaryRow label="Salario bruto" amount={grossSalary} currency={currency} />
          <SummaryRow label="− CCSS" amount={ccssDeduction} currency={currency} tone="negative" />
          <SummaryRow
            label="− Impuesto sobre la renta"
            amount={incomeTaxDeduction}
            currency={currency}
            tone="negative"
          />
          <SummaryRow
            label="− Reserva cambiaria"
            amount={exchangeLossDeduction}
            currency={currency}
            tone="negative"
          />
        </div>

        <Separator />

        <div className="grid gap-3">
          <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <p className="text-sm font-medium">Salario neto estimado</p>
            </div>
            {payrollAvailable ? (
              preview ? (
                <>
                  <MoneyDisplay
                    amount={preview.netSalary}
                    currency={currency}
                    size="lg"
                    className="block text-right"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Salario bruto menos CCSS e impuesto sobre la renta del mes seleccionado.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Introduce un ingreso y un mes válidos para ver el cálculo.
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                El cálculo de nómina no está disponible para esta moneda.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-4">
            <p className="text-sm font-medium text-cyan-50">Ingreso final del presupuesto</p>
            <MoneyDisplay
              amount={finalBudgetIncome}
              currency={currency}
              size="lg"
              className="mt-2 block text-right text-cyan-50"
            />
            <p className="mt-2 text-xs text-cyan-100/70">
              Este es el importe del presupuesto después de las deducciones seleccionadas.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
