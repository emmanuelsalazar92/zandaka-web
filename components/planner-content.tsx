"use client"

import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Send,
  RotateCcw,
  Copy,
  Settings2,
  Plus,
  Trash2,
  Calculator,
  FolderPlus,
  X,
} from "lucide-react"
import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface TaxBracket {
  id: number
  minAmount: number
  maxAmount: number | null
  percentage: number
}

interface MonthlyLegalConfig {
  seguroPercentage: number
  taxBrackets: TaxBracket[]
}

interface ExpenseItem {
  id: number
  name: string
  amount: number
  percentage: number
  isAutoCalculated?: boolean
  calculationType?: "seguro" | "renta"
}

interface ExpenseCategory {
  id: string
  name: string
  items: ExpenseItem[]
}

interface DistributionMapping {
  itemId: number
  itemName: string
  categoryName: string
  amount: number
  destinationAccountId: string
  destinationCategoryId: string
}

const defaultTaxBrackets2026: TaxBracket[] = [
  { id: 1, minAmount: 0, maxAmount: 918000, percentage: 0 },
  { id: 2, minAmount: 918000, maxAmount: 1347000, percentage: 10 },
  { id: 3, minAmount: 1347000, maxAmount: 2364000, percentage: 15 },
  { id: 4, minAmount: 2364000, maxAmount: 4727000, percentage: 20 },
  { id: 5, minAmount: 4727000, maxAmount: null, percentage: 25 },
]

const defaultTaxBrackets2025: TaxBracket[] = [
  { id: 1, minAmount: 0, maxAmount: 863000, percentage: 0 },
  { id: 2, minAmount: 863000, maxAmount: 1267000, percentage: 10 },
  { id: 3, minAmount: 1267000, maxAmount: 2223000, percentage: 15 },
  { id: 4, minAmount: 2223000, maxAmount: 4445000, percentage: 20 },
  { id: 5, minAmount: 4445000, maxAmount: null, percentage: 25 },
]

const mockCategories = [
  { id: "1", name: "Deducciones", parentId: null },
  { id: "2", name: "Necesidades Basicas", parentId: null },
  { id: "3", name: "Gastos Presindibles", parentId: null },
  { id: "4", name: "Ahorro", parentId: null },
  { id: "5", name: "Seguro", parentId: "1" },
  { id: "6", name: "Renta", parentId: "1" },
  { id: "7", name: "Aporte Residencia", parentId: "2" },
  { id: "8", name: "Transporte", parentId: "2" },
  { id: "9", name: "Telefono", parentId: "2" },
  { id: "10", name: "Internet", parentId: "2" },
  { id: "11", name: "Spotify", parentId: "3" },
  { id: "12", name: "Netflix", parentId: "3" },
  { id: "13", name: "HBO Max", parentId: "3" },
  { id: "14", name: "ChatGPT", parentId: "3" },
  { id: "15", name: "Pension", parentId: "4" },
  { id: "16", name: "Ahorro Libre", parentId: "4" },
  { id: "17", name: "Certificado", parentId: "4" },
  { id: "18", name: "Ropa", parentId: "4" },
  { id: "19", name: "Salud", parentId: "4" },
]

function calculateProgressiveTax(grossIncome: number, brackets: TaxBracket[]): number {
  let totalTax = 0
  const sortedBrackets = [...brackets].sort((a, b) => a.minAmount - b.minAmount)

  for (const bracket of sortedBrackets) {
    if (grossIncome <= bracket.minAmount) break

    const taxableInBracket = bracket.maxAmount
      ? Math.min(grossIncome, bracket.maxAmount) - bracket.minAmount
      : grossIncome - bracket.minAmount

    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * (bracket.percentage / 100)
    }
  }

  return totalTax
}

const mockIncome = [
  { id: 1, parentId: "salario", name: "ENCORA", amount: 2227000, percentage: 100 },
]

const initialExpenseCategories: ExpenseCategory[] = [
  {
    id: "deducciones",
    name: "DEDUCCIONES",
    items: [
      {
        id: 1,
        name: "SEGURO",
        amount: 237620.9,
        percentage: 10.67,
        isAutoCalculated: true,
        calculationType: "seguro",
      },
      {
        id: 2,
        name: "RENTA",
        amount: 174250.0,
        percentage: 7.82,
        isAutoCalculated: true,
        calculationType: "renta",
      },
    ],
  },
  {
    id: "necesidades",
    name: "NECESIDADES BASICAS",
    items: [
      { id: 3, name: "NB - APORTE RESIDENCIA", amount: 400000, percentage: 17.96 },
      { id: 4, name: "NB - TRANSPORTE TRABAJO", amount: 0, percentage: 0 },
      { id: 5, name: "NB - TELEFONO PERSONAL", amount: 8100, percentage: 0.36 },
      { id: 6, name: "NB - INTERNET RESIDENCIA", amount: 15000, percentage: 0.67 },
    ],
  },
  {
    id: "gastos",
    name: "GASTOS PRESINDIBLES",
    items: [
      { id: 7, name: "GP - SPOTIFY", amount: 3800, percentage: 0.17 },
      { id: 8, name: "GP - NETFLIX", amount: 7650, percentage: 0.34 },
      { id: 9, name: "GP - HBO MAX", amount: 3000, percentage: 0.13 },
      { id: 10, name: "GP - MANGA", amount: 0, percentage: 0 },
      { id: 11, name: "GP - CHAT GPT", amount: 11750, percentage: 0.53 },
      { id: 12, name: "GP - LIBROS", amount: 0, percentage: 0 },
      { id: 13, name: "GP - ASIGNACION PERSONAL", amount: 0, percentage: 0 },
    ],
  },
  {
    id: "ahorro",
    name: "AHORRO",
    items: [
      { id: 14, name: "A - CERTIFICADO MAX-150K", amount: 0, percentage: 0 },
      { id: 15, name: "A - ROPA MAX-500K", amount: 0, percentage: 0 },
      { id: 16, name: "A - SALUD MAX-500K", amount: 0, percentage: 0 },
      { id: 17, name: "A - CELULAR MAX-700K", amount: 0, percentage: 0 },
      { id: 18, name: "A - LAPTOP MAX-1 MILLON", amount: 0, percentage: 0 },
      { id: 19, name: "A - JAPON MAX-3.5 MILLONES", amount: 0, percentage: 0 },
      { id: 20, name: "A - CARRO MAX-3.5 MILLONES", amount: 0, percentage: 0 },
      { id: 21, name: "A - CASA MAX-7 MILLONES", amount: 0, percentage: 0 },
      { id: 22, name: "A - PENSION", amount: 111350, percentage: 5 },
      { id: 23, name: "AHORRO LIBRE", amount: 1254479.1, percentage: 56.33 },
      { id: 24, name: "TRANSFERENCIA", amount: 0, percentage: 0 },
    ],
  },
]

const mockAccounts = [
  { id: 1, name: "Cuenta Principal", currency: "CRC" },
  { id: 2, name: "Cuenta Ahorros", currency: "CRC" },
  { id: 3, name: "Tarjeta Credito", currency: "CRC" },
]

const months = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatPercentage(value: number) {
  return `${value.toFixed(2)}%`
}

export function PlannerContent() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = React.useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = React.useState(currentDate.getFullYear())
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(
    new Set(["deducciones", "necesidades", "gastos", "ahorro"]),
  )
  const [incomeItems, setIncomeItems] = React.useState(mockIncome)
  const [expenseCategories, setExpenseCategories] =
    React.useState<ExpenseCategory[]>(initialExpenseCategories)
  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false)

  const [sourceAccountId, setSourceAccountId] = React.useState("")
  const [distributionMappings, setDistributionMappings] = React.useState<DistributionMapping[]>([])

  const [monthlyConfigs, setMonthlyConfigs] = React.useState<Record<string, MonthlyLegalConfig>>({})
  const [isConfigSheetOpen, setIsConfigSheetOpen] = React.useState(false)

  const [isAddCategoryOpen, setIsAddCategoryOpen] = React.useState(false)
  const [newCategoryName, setNewCategoryName] = React.useState("")

  const [nextItemId, setNextItemId] = React.useState(100)

  const configKey = `${selectedYear}-${selectedMonth}`

  const currentConfig = React.useMemo(() => {
    if (monthlyConfigs[configKey]) {
      return monthlyConfigs[configKey]
    }
    return {
      seguroPercentage: 10.67,
      taxBrackets: selectedYear >= 2026 ? defaultTaxBrackets2026 : defaultTaxBrackets2025,
    }
  }, [monthlyConfigs, configKey, selectedYear])

  const updateMonthlyConfig = (updates: Partial<MonthlyLegalConfig>) => {
    setMonthlyConfigs((prev) => ({
      ...prev,
      [configKey]: {
        ...currentConfig,
        ...updates,
      },
    }))
  }

  const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0)

  const calculatedSeguro = totalIncome * (currentConfig.seguroPercentage / 100)
  const calculatedRenta = calculateProgressiveTax(totalIncome, currentConfig.taxBrackets)

  const expenseCategoriesWithCalculations = React.useMemo(() => {
    return expenseCategories.map((cat) => {
      if (cat.id === "deducciones") {
        return {
          ...cat,
          items: cat.items.map((item) => {
            if (item.calculationType === "seguro") {
              return {
                ...item,
                amount: calculatedSeguro,
                percentage: (calculatedSeguro / totalIncome) * 100,
              }
            }
            if (item.calculationType === "renta") {
              return {
                ...item,
                amount: calculatedRenta,
                percentage: (calculatedRenta / totalIncome) * 100,
              }
            }
            return item
          }),
        }
      }
      return cat
    })
  }, [expenseCategories, calculatedSeguro, calculatedRenta, totalIncome])

  const categoryTotals = expenseCategoriesWithCalculations.map((cat) => ({
    ...cat,
    total: cat.items.reduce((sum, item) => sum + item.amount, 0),
    percentage: (cat.items.reduce((sum, item) => sum + item.amount, 0) / totalIncome) * 100,
  }))

  const totalExpenses = categoryTotals.reduce((sum, cat) => sum + cat.total, 0)
  const remaining = totalIncome - totalExpenses

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const handleAmountChange = (categoryId: string, itemId: number, newAmount: string) => {
    const amount = Number.parseFloat(newAmount) || 0
    setExpenseCategories((cats) =>
      cats.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId
                  ? { ...item, amount, percentage: (amount / totalIncome) * 100 }
                  : item,
              ),
            }
          : cat,
      ),
    )
  }

  const handleIncomeChange = (itemId: number, newAmount: string) => {
    const amount = Number.parseFloat(newAmount) || 0
    setIncomeItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, amount } : item)),
    )
  }

  const handleNewMonth = () => {
    setExpenseCategories((cats) =>
      cats.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => ({
          ...item,
          amount: item.isAutoCalculated ? item.amount : 0,
          percentage: item.isAutoCalculated ? item.percentage : 0,
        })),
      })),
    )
    setIncomeItems((items) => items.map((item) => ({ ...item, amount: 0 })))
  }

  const handleCopyPreviousMonth = () => {
    setExpenseCategories(initialExpenseCategories)
    setIncomeItems(mockIncome)
  }

  const handleOpenApplyModal = () => {
    // Build distribution mappings from current expense categories
    const mappings: DistributionMapping[] = []
    for (const category of expenseCategoriesWithCalculations) {
      for (const item of category.items) {
        if (item.amount > 0) {
          mappings.push({
            itemId: item.id,
            itemName: item.name,
            categoryName: category.name,
            amount: item.amount,
            destinationAccountId: "",
            destinationCategoryId: "",
          })
        }
      }
    }
    setDistributionMappings(mappings)
    setSourceAccountId("")
    setIsApplyModalOpen(true)
  }

  const handleUpdateDestination = (
    itemId: number,
    field: "account" | "category",
    value: string,
  ) => {
    setDistributionMappings((mappings) =>
      mappings.map((m) =>
        m.itemId === itemId
          ? {
              ...m,
              ...(field === "account"
                ? { destinationAccountId: value }
                : { destinationCategoryId: value }),
            }
          : m,
      ),
    )
  }

  const handleSetAllDestinationAccounts = (accountId: string) => {
    setDistributionMappings((mappings) =>
      mappings.map((m) => ({ ...m, destinationAccountId: accountId })),
    )
  }

  const handleSetAllDestinationCategories = (categoryId: string) => {
    setDistributionMappings((mappings) =>
      mappings.map((m) => ({ ...m, destinationCategoryId: categoryId })),
    )
  }

  const handleApplyDistribution = () => {
    console.log("Applying distribution:", {
      month: `${months[selectedMonth]} ${selectedYear}`,
      sourceAccount: sourceAccountId,
      distributions: distributionMappings,
      legalConfig: currentConfig,
    })
    setIsApplyModalOpen(false)
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    const categoryId = newCategoryName.toLowerCase().replace(/\s+/g, "-")
    setExpenseCategories((cats) => [
      ...cats,
      {
        id: categoryId,
        name: newCategoryName.toUpperCase(),
        items: [],
      },
    ])
    setExpandedCategories((prev) => new Set([...prev, categoryId]))
    setNewCategoryName("")
    setIsAddCategoryOpen(false)
  }

  const handleRemoveCategory = (categoryId: string) => {
    setExpenseCategories((cats) => cats.filter((c) => c.id !== categoryId))
    setExpandedCategories((prev) => {
      const newSet = new Set(prev)
      newSet.delete(categoryId)
      return newSet
    })
  }

  const handleAddItem = (categoryId: string) => {
    const newId = nextItemId
    setNextItemId((prev) => prev + 1)
    setExpenseCategories((cats) =>
      cats.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: [...cat.items, { id: newId, name: "Nuevo Item", amount: 0, percentage: 0 }],
            }
          : cat,
      ),
    )
  }

  const handleRemoveItem = (categoryId: string, itemId: number) => {
    setExpenseCategories((cats) =>
      cats.map((cat) =>
        cat.id === categoryId
          ? { ...cat, items: cat.items.filter((item) => item.id !== itemId) }
          : cat,
      ),
    )
  }

  const handleItemNameChange = (categoryId: string, itemId: number, newName: string) => {
    setExpenseCategories((cats) =>
      cats.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              items: cat.items.map((item) =>
                item.id === itemId ? { ...item, name: newName } : item,
              ),
            }
          : cat,
      ),
    )
  }

  const addTaxBracket = () => {
    const newBrackets = [...currentConfig.taxBrackets]
    const lastBracket = newBrackets[newBrackets.length - 1]
    const newId = Math.max(...newBrackets.map((b) => b.id)) + 1

    if (lastBracket.maxAmount === null) {
      newBrackets.splice(newBrackets.length - 1, 0, {
        id: newId,
        minAmount: lastBracket.minAmount,
        maxAmount: lastBracket.minAmount + 500000,
        percentage: lastBracket.percentage,
      })
      lastBracket.minAmount = lastBracket.minAmount + 500000
    } else {
      newBrackets.push({
        id: newId,
        minAmount: lastBracket.maxAmount,
        maxAmount: null,
        percentage: 25,
      })
    }

    updateMonthlyConfig({ taxBrackets: newBrackets })
  }

  const removeTaxBracket = (id: number) => {
    if (currentConfig.taxBrackets.length <= 2) return
    const newBrackets = currentConfig.taxBrackets.filter((b) => b.id !== id)
    updateMonthlyConfig({ taxBrackets: newBrackets })
  }

  const updateTaxBracket = (id: number, field: keyof TaxBracket, value: number | null) => {
    const newBrackets = currentConfig.taxBrackets.map((b) =>
      b.id === id ? { ...b, [field]: value } : b,
    )
    updateMonthlyConfig({ taxBrackets: newBrackets })
  }

  const years = [2024, 2025, 2026]

  const allDistributionsMapped = distributionMappings.every(
    (m) => m.destinationAccountId !== "" && m.destinationCategoryId !== "",
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-col sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Planificador de Sobres</h2>
          <p className="text-muted-foreground">Distribuye tu ingreso mensual en categorias</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Sheet open={isConfigSheetOpen} onOpenChange={setIsConfigSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="mr-2 h-4 w-4" />
                Config Legal
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  Configuracion Legal - {months[selectedMonth]} {selectedYear}
                </SheetTitle>
                <SheetDescription>
                  Configura los porcentajes de deducciones legales para este mes. Los cambios solo
                  afectan a {months[selectedMonth]} {selectedYear}.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Seguro (CCSS) Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calculator className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Seguro Social (CCSS)</h4>
                      <p className="text-xs text-muted-foreground">
                        Porcentaje sobre salario bruto
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-10">
                    <Input
                      type="number"
                      step="0.01"
                      value={currentConfig.seguroPercentage}
                      onChange={(e) =>
                        updateMonthlyConfig({
                          seguroPercentage: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-24 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      = {formatCurrency(calculatedSeguro)}
                    </span>
                  </div>
                </div>

                {/* Renta (Tax Brackets) Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Calculator className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Impuesto sobre la Renta</h4>
                        <p className="text-xs text-muted-foreground">Franjas progresivas</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={addTaxBracket}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 pl-10">
                    {currentConfig.taxBrackets
                      .sort((a, b) => a.minAmount - b.minAmount)
                      .map((bracket) => (
                        <div
                          key={bracket.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Desde</Label>
                              <Input
                                type="number"
                                value={bracket.minAmount}
                                onChange={(e) =>
                                  updateTaxBracket(
                                    bracket.id,
                                    "minAmount",
                                    Number.parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Hasta</Label>
                              <Input
                                type="number"
                                value={bracket.maxAmount ?? ""}
                                placeholder="∞"
                                onChange={(e) =>
                                  updateTaxBracket(
                                    bracket.id,
                                    "maxAmount",
                                    e.target.value ? Number.parseFloat(e.target.value) : null,
                                  )
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">%</Label>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={bracket.percentage}
                                  onChange={(e) =>
                                    updateTaxBracket(
                                      bracket.id,
                                      "percentage",
                                      Number.parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className="h-8 text-xs"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => removeTaxBracket(bracket.id)}
                                  disabled={currentConfig.taxBrackets.length <= 2}
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="pl-10 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Renta calculada:</span>
                      <span className="font-mono font-semibold text-error">
                        {formatCurrency(calculatedRenta)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Sobre ingreso de:</span>
                      <span className="font-mono">{formatCurrency(totalIncome)}</span>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="rounded-lg bg-error/10 p-4 space-y-2">
                  <h4 className="font-semibold text-error">Total Deducciones Legales</h4>
                  <div className="flex justify-between">
                    <span className="text-sm">Seguro:</span>
                    <span className="font-mono">{formatCurrency(calculatedSeguro)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Renta:</span>
                    <span className="font-mono">{formatCurrency(calculatedRenta)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-error/20 font-semibold">
                    <span>Total:</span>
                    <span className="font-mono text-error">
                      {formatCurrency(calculatedSeguro + calculatedRenta)}
                    </span>
                  </div>
                </div>

                {/* Presets */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Cargar franjas predeterminadas
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => updateMonthlyConfig({ taxBrackets: defaultTaxBrackets2025 })}
                    >
                      Costa Rica 2025
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-transparent"
                      onClick={() => updateMonthlyConfig({ taxBrackets: defaultTaxBrackets2026 })}
                    >
                      Costa Rica 2026
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="outline" size="sm" onClick={handleCopyPreviousMonth}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar Mes Anterior
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewMonth}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nuevo Mes
          </Button>
          <Button onClick={handleOpenApplyModal}>
            <Send className="mr-2 h-4 w-4" />
            Aplicar Distribucion
          </Button>
        </div>
      </div>

      {/* Month Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Periodo</CardTitle>
            {monthlyConfigs[configKey] && (
              <Badge variant="secondary" className="text-xs">
                Config personalizada
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(v) => setSelectedMonth(Number.parseInt(v))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(Number.parseInt(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex items-end">
              <Badge variant="secondary" className="text-lg px-4 py-2">
                {months[selectedMonth].toUpperCase()} {selectedYear}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Income Section */}
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-success">INGRESOS</CardTitle>
            <Badge className="bg-success text-success-foreground">
              {formatCurrency(totalIncome)} - 100.00%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 bg-success/10 rounded-lg">
              <span className="font-medium text-sm">SALARIO</span>
              <div className="flex items-center gap-4">
                {incomeItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <Input
                      type="number"
                      value={item.amount}
                      onChange={(e) => handleIncomeChange(item.id, e.target.value)}
                      className="w-36 text-right font-mono"
                    />
                    <span className="text-sm text-muted-foreground w-16 text-right">100.00%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-success/20 rounded-lg font-semibold">
              <span>SUB-TOTAL</span>
              <div className="flex items-center gap-4">
                <span className="font-mono">{formatCurrency(totalIncome)}</span>
                <span className="w-16 text-right">100.00%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Section */}
      <Card className="border-error/30 bg-error/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-error">EGRESOS</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddCategoryOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Nueva Categoria
              </Button>
              <Badge
                variant="outline"
                className={cn(
                  remaining >= 0 ? "border-success text-success" : "border-error text-error",
                )}
              >
                Restante: {formatCurrency(remaining)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {categoryTotals.map((category) => {
            const isExpanded = expandedCategories.has(category.id)
            const hasAutoItems = category.items.some((item) => item.isAutoCalculated)
            return (
              <div key={category.id} className="border rounded-lg overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center justify-between p-3 bg-muted/50">
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="font-semibold">{category.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-error">
                      {formatCurrency(category.total)}
                    </span>
                    <Badge variant="secondary">{formatPercentage(category.percentage)}</Badge>
                    {!hasAutoItems && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-error"
                        onClick={() => handleRemoveCategory(category.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Category Items */}
                {isExpanded && (
                  <div className="divide-y">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2 px-4 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          {item.isAutoCalculated ? (
                            <>
                              <span className="text-sm">{item.name}</span>
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                <Calculator className="h-3 w-3 mr-1" />
                                Auto
                              </Badge>
                            </>
                          ) : (
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                handleItemNameChange(category.id, item.id, e.target.value)
                              }
                              className="h-7 text-sm max-w-[200px]"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.amount.toFixed(2)}
                            onChange={(e) =>
                              handleAmountChange(category.id, item.id, e.target.value)
                            }
                            disabled={item.isAutoCalculated}
                            className={cn(
                              "w-32 text-right font-mono text-sm",
                              item.amount > 0 && "text-error",
                              item.isAutoCalculated && "bg-muted cursor-not-allowed",
                            )}
                          />
                          <span className="text-xs text-muted-foreground w-14 text-right">
                            {formatPercentage((item.amount / totalIncome) * 100 || 0)}
                          </span>
                          {!item.isAutoCalculated && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-error"
                              onClick={() => handleRemoveItem(category.id, item.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 px-4 bg-muted/20">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleAddItem(category.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar Item
                      </Button>
                    </div>
                    {/* Subtotal Row */}
                    <div className="flex items-center justify-between py-2 px-4 bg-error/10 font-semibold">
                      <span>SUB-TOTAL</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-error w-32 text-right">
                          {formatCurrency(category.total)}
                        </span>
                        <span className="text-xs w-14 text-right">
                          {formatPercentage(category.percentage)}
                        </span>
                        <div className="w-7" /> {/* Spacer for alignment */}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Distribucion</CardTitle>
          <CardDescription>
            {months[selectedMonth]} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-success/10 p-4">
              <p className="text-sm text-muted-foreground">Total Ingresos</p>
              <p className="text-2xl font-bold text-success">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="rounded-lg bg-error/10 p-4">
              <p className="text-sm text-muted-foreground">Total Egresos</p>
              <p className="text-2xl font-bold text-error">{formatCurrency(totalExpenses)}</p>
            </div>
            <div
              className={cn("rounded-lg p-4", remaining >= 0 ? "bg-success/10" : "bg-warning/10")}
            >
              <p className="text-sm text-muted-foreground">Restante</p>
              <p
                className={cn(
                  "text-2xl font-bold",
                  remaining >= 0 ? "text-success" : "text-warning",
                )}
              >
                {formatCurrency(remaining)}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">% Asignado</p>
              <p className="text-2xl font-bold">
                {formatPercentage((totalExpenses / totalIncome) * 100 || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Categoria</DialogTitle>
            <DialogDescription>
              Crea una nueva categoria para organizar tus gastos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la Categoria</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej: ENTRETENIMIENTO"
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              Crear Categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Aplicar Distribucion</DialogTitle>
            <DialogDescription>
              Crea transacciones para {months[selectedMonth]} {selectedYear}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-2">
            {/* Source Account - more compact */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Cuenta Origen</Label>
                <span className="text-xs text-muted-foreground">De donde salen los fondos</span>
              </div>
              <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Seleccionar cuenta origen" />
                </SelectTrigger>
                <SelectContent>
                  {mockAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name} ({account.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Assign Section - more compact */}
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-medium">Asignacion Rapida</p>
              <div className="grid grid-cols-2 gap-2">
                <Select onValueChange={handleSetAllDestinationAccounts}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas las cuentas" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select onValueChange={handleSetAllDestinationCategories}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Todas las categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockCategories
                      .filter((c) => c.parentId !== null)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Distribution Items - compact table-like layout */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Items a Distribuir</Label>
                <Badge variant="outline" className="text-xs">
                  {distributionMappings.length} items
                </Badge>
              </div>

              <div className="grid grid-cols-[1fr,auto,1fr,1fr] gap-2 px-2 py-1 text-xs font-medium text-muted-foreground border-b">
                <span>Item</span>
                <span className="text-right">Monto</span>
                <span>Cuenta</span>
                <span>Categoria</span>
              </div>

              <div className="max-h-[280px] overflow-y-auto space-y-1">
                {expenseCategoriesWithCalculations.map((category) => {
                  const categoryMappings = distributionMappings.filter(
                    (m) => m.categoryName === category.name,
                  )
                  if (categoryMappings.length === 0) return null

                  return (
                    <div key={category.id}>
                      {/* Category header - very compact */}
                      <div className="px-2 py-1 bg-muted/50 rounded text-xs font-semibold uppercase tracking-wide">
                        {category.name}
                      </div>

                      {/* Items as compact rows */}
                      {categoryMappings.map((mapping) => (
                        <div
                          key={mapping.itemId}
                          className="grid grid-cols-[1fr,auto,1fr,1fr] gap-2 items-center px-2 py-1.5 hover:bg-muted/30 rounded"
                        >
                          <span className="text-sm truncate">{mapping.itemName}</span>
                          <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {formatCurrency(mapping.amount)}
                          </span>
                          <Select
                            value={mapping.destinationAccountId}
                            onValueChange={(v) =>
                              handleUpdateDestination(mapping.itemId, "account", v)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Cuenta" />
                            </SelectTrigger>
                            <SelectContent>
                              {mockAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id.toString()}>
                                  {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={mapping.destinationCategoryId}
                            onValueChange={(v) =>
                              handleUpdateDestination(mapping.itemId, "category", v)
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {mockCategories
                                .filter((c) => c.parentId !== null)
                                .map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 border-t pt-3 space-y-3">
            <div className="flex items-center justify-between text-sm px-1">
              <div className="flex gap-4">
                <span>
                  Total:{" "}
                  <span className="font-mono font-bold">{formatCurrency(totalExpenses)}</span>
                </span>
                <span className={cn(allDistributionsMapped ? "text-success" : "text-warning")}>
                  {
                    distributionMappings.filter(
                      (m) => m.destinationAccountId !== "" && m.destinationCategoryId !== "",
                    ).length
                  }{" "}
                  / {distributionMappings.length} configurados
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsApplyModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleApplyDistribution}
                disabled={!allDistributionsMapped || !sourceAccountId}
              >
                <Send className="w-4 h-4 mr-2" />
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
