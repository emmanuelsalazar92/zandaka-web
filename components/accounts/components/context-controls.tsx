import { AccessibleField } from "@/components/ui/accessible-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"

import styles from "../account-context.module.css"

export function ContextControls({
  prefix,
  query,
  setQuery,
  order,
  setOrder,
  density,
  setDensity,
  children,
}: {
  prefix: "accounts" | "envelopes"
  query: string
  setQuery: (value: string) => void
  order: string
  setOrder: (value: string) => void
  density: string
  setDensity: (value: "comfortable" | "compact") => void
  children?: React.ReactNode
}) {
  return (
    <div className={styles.toolbar}>
      <AccessibleField className="min-w-0 space-y-1">
        <Label htmlFor={`${prefix}-search`}>
          {prefix === "accounts" ? "Buscar cuentas" : "Buscar sobres"}
        </Label>
        <Input
          id={`${prefix}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Escribe un nombre"
        />
      </AccessibleField>
      <AccessibleField className="min-w-0 space-y-1">
        <Label htmlFor={`${prefix}-order`}>
          Ordenar {prefix === "accounts" ? "cuentas" : "sobres"}
        </Label>
        <SearchableSelect
          id={`${prefix}-order`}
          value={order}
          onValueChange={setOrder}
          searchLabel="Buscar orden"
          options={[
            {
              value: "desc",
              label: prefix === "accounts" ? "Mayor saldo por moneda" : "Mayor saldo primero",
            },
            {
              value: "asc",
              label: prefix === "accounts" ? "Menor saldo por moneda" : "Menor saldo primero",
            },
            { value: "name", label: "Nombre: A a Z" },
          ]}
        />
      </AccessibleField>
      {children}
      <div role="group" aria-label="Densidad de la lista" className={styles.density}>
        {(["comfortable", "compact"] as const).map((value) => (
          <Button
            key={value}
            variant="outline"
            aria-pressed={density === value}
            className={density === value ? "border-primary bg-accent" : undefined}
            onClick={() => setDensity(value)}
          >
            {value === "comfortable" ? "Cómoda" : "Compacta"}
          </Button>
        ))}
      </div>
    </div>
  )
}
