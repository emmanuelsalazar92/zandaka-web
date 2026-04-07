import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { BudgetSummaryCard } from "@/components/budgets/budget-summary-card"
import { formatCurrency } from "@/lib/currency-formatter"

const matchesText = (expected: string) => (_content: string, node: Element | null) =>
  (node?.textContent ?? "").replace(/\s/g, " ").trim() === expected.replace(/\s/g, " ").trim()

describe("BudgetSummaryCard", () => {
  it("renders payroll preview and final budget income with the expected emphasis", () => {
    render(
      <BudgetSummaryCard
        currency="CRC"
        grossSalary={1500000}
        ccssDeduction={162450}
        incomeTaxDeduction={41955}
        exchangeLossDeduction={200000}
        finalBudgetIncome={1095595}
        payrollAvailable
        payrollLoading={false}
        payrollRulesLabel="CR 2026"
        preview={{
          grossSalary: 1500000,
          periodDate: "2026-04-01",
          ccssWorkerRate: 0.1083,
          ccssWorkerAmount: 162450,
          taxableBase: 1337550,
          incomeTaxAmount: 41955,
          netSalary: 1295595,
          ccssRuleSetId: 1,
          incomeTaxRuleSetId: 2,
          taxBreakdown: [],
        }}
      />,
    )

    expect(screen.getByText("4. Results Summary")).toBeInTheDocument()
    expect(screen.getByText("Using payroll rules: CR 2026")).toBeInTheDocument()
    expect(screen.getByText("Net Salary Preview")).toBeInTheDocument()
    expect(screen.getByText("Final Budget Income")).toBeInTheDocument()
    expect(screen.getByText(matchesText(formatCurrency(1295595, "CRC")))).toBeInTheDocument()
    expect(screen.getByText(matchesText(formatCurrency(1095595, "CRC")))).toBeInTheDocument()
  })
})
