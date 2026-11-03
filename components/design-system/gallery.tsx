"use client"

import { ArrowDownLeft, ArrowUpRight, Check, Plus, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"

import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { EmptyState, Feedback, LoadingState } from "@/components/ui/feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/currency-formatter"

const accounts = [
  { value: "daily", label: "Cuenta del día a día · CRC" },
  { value: "savings", label: "Ahorro para viajar · USD" },
  { value: "cash", label: "Efectivo · CRC" },
  { value: "archived", label: "Cuenta archivada · CRC", disabled: true },
]
const sections = [
  ["composicion", "Composición"],
  ["acciones", "Acciones"],
  ["campos", "Campos"],
  ["datos", "Datos"],
  ["feedback", "Feedback"],
  ["capas", "Capas"],
]

function Section({
  id,
  number,
  title,
  description,
  children,
}: {
  id: string
  number: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 space-y-6 border-t pt-8"
    >
      <div className="flex items-start gap-4">
        <span className="pt-1 text-xs font-medium tabular-nums text-muted-foreground">
          {number}
        </span>
        <div className="space-y-1">
          <h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

export function DesignSystemGallery() {
  const { setTheme } = useTheme()
  const { toast } = useToast()
  const [account, setAccount] = React.useState("")
  const [concept, setConcept] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const conceptRef = React.useRef<HTMLInputElement>(null)
  const error = submitted && !concept.trim()
  const notify = () =>
    toast({
      title: "Vista de ejemplo guardada",
      description: "Esta demostración no modifica información financiera.",
    })

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-12 [overflow-wrap:anywhere]">
      <header className="space-y-5 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary">Zandaka · Sistema visual</Badge>
          <div aria-label="Tema de la galería" role="group" className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setTheme("light")}>
              <Sun aria-hidden="true" />
              Claro
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTheme("dark")}>
              <Moon aria-hidden="true" />
              Oscuro
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTheme("system")}>
              Sistema
            </Button>
          </div>
        </div>
        <div className="max-w-3xl space-y-3">
          <h1 className="text-display leading-tight font-semibold tracking-tight">
            Atlántico,
            <br />
            <span className="text-primary">en cada detalle.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Color con intención. Espacio para entender. Una misma experiencia, desde el primer
            movimiento hasta tu reporte.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Galería interactiva · Todos los datos son de ejemplo. No realiza operaciones financieras.
        </p>
        <nav
          aria-label="Secciones de la galería"
          className="flex flex-wrap gap-x-5 gap-y-3 text-sm"
        >
          {sections.map(([id, title]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              {title}
            </a>
          ))}
        </nav>
      </header>

      <Section
        id="composicion"
        number="01"
        title="Un foco. Toda la claridad."
        description="El cobalto guía la mirada; el turquesa aporta energía. El color de un saldo siempre conserva su significado."
      >
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[1.4fr_1fr]">
          <section
            aria-label="Saldo de ejemplo"
            className="atlantic-hero flex min-w-0 flex-col justify-between gap-10 p-6 sm:p-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="hero-caption text-sm">Tu perspectiva financiera</p>
              <span className="hero-caption text-xs">Noviembre 2026 · Ejemplo</span>
            </div>
            <div className="space-y-3">
              <p className="hero-caption text-sm">Saldo disponible</p>
              <p className="hero-amount">{formatCurrency(1280000, "CRC")}</p>
              <p className="hero-caption max-w-sm text-sm leading-relaxed">
                En tu moneda original. Sin conversiones que oculten el detalle.
              </p>
            </div>
            <div className="hero-caption flex flex-wrap gap-x-8 gap-y-3 border-t border-current/20 pt-5 text-sm">
              <span>3 cuentas</span>
              <span>12 sobres</span>
              <span>Una visión clara</span>
            </div>
          </section>
          <section
            aria-label="Reporte de ejemplo"
            className="flex min-w-0 flex-col justify-between gap-6 rounded-xl border bg-card p-6 shadow-surface sm:p-8"
          >
            <div className="space-y-1">
              <p className="text-xs font-medium tracking-widest text-muted-foreground">
                ZANDAKA / REPORTE
              </p>
              <h3 className="text-2xl font-semibold tracking-tight">Tu mes, en perspectiva.</h3>
              <p className="text-sm text-muted-foreground">Noviembre 2026 · Muestra visual</p>
            </div>
            <dl className="divide-y text-sm">
              {[
                ["Saldo en CRC", formatCurrency(1280000, "CRC")],
                ["Saldo en USD", formatCurrency(520, "USD")],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-wrap justify-between gap-2 py-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              Se muestran monedas por separado. Esta muestra no representa un cierre ni un snapshot
              real.
            </p>
          </section>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["bg-primary", "Cobalto", "Acción y orientación"],
            ["bg-brand-deep", "Profundidad", "Jerarquía y presentación"],
            ["bg-brand-turquoise", "Turquesa", "Acento, sin significado financiero"],
          ].map(([color, title, caption]) => (
            <div key={title} className="flex items-center gap-3">
              <span aria-hidden="true" className={`size-10 shrink-0 rounded-lg ${color}`} />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{caption}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="acciones"
        number="02"
        title="Acciones que se entienden."
        description="Una acción principal por contexto. Prueba hover con el cursor y foco con Tab; los controles conservan su nombre mientras cargan."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={notify}>
            <Plus aria-hidden="true" />
            Crear ejemplo
          </Button>
          <Button variant="secondary" onClick={notify}>
            Acción secundaria
          </Button>
          <Button variant="outline" onClick={notify}>
            Acción alternativa
          </Button>
          <Button variant="ghost" onClick={notify}>
            Acción discreta
          </Button>
          <Button variant="link" asChild>
            <a href="#campos">Ir a los campos</a>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>No disponible</Button>
          <Button loading>Guardando ejemplo</Button>
          <Button
            variant="destructive"
            onClick={() =>
              toast({
                variant: "destructive",
                title: "No se pudo guardar el ejemplo",
                description: "Tu información está intacta. Puedes volver a intentarlo.",
              })
            }
          >
            Mostrar error
          </Button>
          <Button size="icon" variant="outline" aria-label="Confirmar ejemplo" onClick={notify}>
            <Check aria-hidden="true" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={notify}>
            Compacto
          </Button>
          <Button onClick={notify}>Estándar</Button>
          <Button size="lg" onClick={notify}>
            Destacado
          </Button>
        </div>
      </Section>

      <Section
        id="campos"
        number="03"
        title="Menos fricción. Más confianza."
        description="Etiquetas visibles, errores asociados y selección con búsqueda. La validación aparece al enviar y se resuelve mientras escribes."
      >
        <form
          noValidate
          className="grid gap-6 rounded-xl border bg-card p-5 shadow-surface sm:p-6 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            setSaved(false)
            if (!concept.trim()) conceptRef.current?.focus()
            else setSaved(true)
          }}
        >
          <AccessibleField className="space-y-2">
            <Label>Concepto de ejemplo</Label>
            <Input
              ref={conceptRef}
              value={concept}
              onChange={(event) => {
                setConcept(event.target.value)
                setSaved(false)
              }}
              placeholder="Por ejemplo, ahorro del mes"
              required
            />
            <AccessibleFieldError className="text-sm text-error">
              {error ? "Escribe un concepto para continuar." : null}
            </AccessibleFieldError>
          </AccessibleField>
          <AccessibleField className="space-y-2">
            <Label>Cuenta de ejemplo</Label>
            <SearchableSelect
              options={accounts}
              value={account}
              onValueChange={setAccount}
              searchLabel="Buscar cuenta de ejemplo"
              placeholder="Busca por nombre o moneda"
            />
          </AccessibleField>
          <AccessibleField className="space-y-2">
            <Label>Moneda de ejemplo</Label>
            <Select defaultValue="CRC">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CRC">Colones · CRC</SelectItem>
                <SelectItem value="USD">Dólares · USD</SelectItem>
              </SelectContent>
            </Select>
          </AccessibleField>
          <AccessibleField className="space-y-2">
            <Label>Referencia no editable</Label>
            <Input value="Disponible al crear tu primer movimiento" disabled />
          </AccessibleField>
          <AccessibleField className="space-y-2 md:col-span-2">
            <Label>Nota de ejemplo</Label>
            <Textarea placeholder="Añade contexto si lo necesitas" />
          </AccessibleField>
          <div className="flex flex-wrap gap-x-8 gap-y-5 md:col-span-2">
            <AccessibleField className="flex items-center gap-3">
              <Switch defaultChecked />
              <Label>Mostrar resumen</Label>
            </AccessibleField>
            <AccessibleField className="flex items-center gap-3">
              <Checkbox />
              <Label>Incluir nota</Label>
            </AccessibleField>
            <AccessibleField className="flex items-center gap-3">
              <Switch disabled />
              <Label>Opción no disponible</Label>
            </AccessibleField>
          </div>
          <div className="space-y-3 md:col-span-2">
            <Button type="submit">Validar ejemplo</Button>
            {saved && (
              <Feedback tone="success" title="Ejemplo validado">
                Los cambios se mantienen solo en esta galería.
              </Feedback>
            )}
          </div>
        </form>
        <div className="grid gap-6 sm:grid-cols-2">
          <AccessibleField className="space-y-2">
            <Label>Selector vacío</Label>
            <SearchableSelect
              options={[]}
              value=""
              onValueChange={() => {}}
              searchLabel="Buscar en lista vacía"
            />
          </AccessibleField>
          <AccessibleField className="space-y-2">
            <Label>Selector cargando</Label>
            <SearchableSelect
              options={[]}
              value=""
              loading
              onValueChange={() => {}}
              searchLabel="Buscar mientras carga"
            />
          </AccessibleField>
        </div>
      </Section>

      <Section
        id="datos"
        number="04"
        title="Los números, primero."
        description="Tipografía tabular, monedas explícitas y signos intactos. Las superficies ordenan; no compiten con la información."
      >
        <div className="flex flex-wrap gap-2">
          <Badge>Activo</Badge>
          <Badge variant="secondary">Borrador</Badge>
          <Badge variant="outline">CRC</Badge>
          <Badge variant="success">Ingreso</Badge>
          <Badge variant="warning">Pendiente</Badge>
          <Badge variant="error">Requiere atención</Badge>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-2 shadow-surface sm:p-4">
          <Table>
            <TableCaption>
              Movimientos sintéticos · Monedas originales, sin consolidar.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Movimiento</TableHead>
                <TableHead scope="col">Estado</TableHead>
                <TableHead scope="col" className="text-right">
                  Monto
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <ArrowDownLeft aria-hidden="true" className="size-4 text-success" />
                    <span>
                      Ingreso de ejemplo
                      <span className="block text-xs text-muted-foreground">3 nov 2026</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="success">Confirmado</Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-success tabular-nums">
                  +{formatCurrency(250000, "CRC")}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <ArrowUpRight aria-hidden="true" className="size-4 text-error" />
                    <span>
                      Compra de ejemplo
                      <span className="block text-xs text-muted-foreground">3 nov 2026</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="warning">Por revisar</Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-error tabular-nums">
                  {formatCurrency(-35.5, "USD")}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section
        id="feedback"
        number="05"
        title="Siempre sabes qué sucede."
        description="El estado se comunica con texto e iconos, además del color. Los errores persistentes permanecen cerca de la tarea."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Feedback title="Monedas originales">
            El total se muestra por moneda hasta contar con una cotización válida.
          </Feedback>
          <Feedback tone="success" title="Todo en orden">
            La información de ejemplo está completa.
          </Feedback>
          <Feedback tone="warning" title="Cotización anterior">
            Revisa la fecha antes de interpretar un consolidado.
          </Feedback>
          <Feedback tone="error" title="No pudimos cargar este bloque">
            Conservamos el resto de tu información. Vuelve a intentarlo.
          </Feedback>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <LoadingState>Cargando movimientos de ejemplo…</LoadingState>
            <p className="text-xs text-muted-foreground">
              Estado de carga persistente para inspección.
            </p>
          </div>
          <EmptyState
            title="Un comienzo con claridad"
            action={
              <Button variant="outline" onClick={notify}>
                Probar acción del estado vacío
              </Button>
            }
          >
            Tus movimientos aparecerán aquí cuando registres el primero.
          </EmptyState>
        </div>
      </Section>

      <Section
        id="capas"
        number="06"
        title="El contexto nunca se pierde."
        description="Diálogos y paneles mantienen el foco dentro de la tarea. Escape cierra y devuelve el foco al control que los abrió."
      >
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Abrir diálogo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Un momento de claridad</DialogTitle>
                <DialogDescription>
                  Este diálogo es una muestra. No modifica tus cuentas.
                </DialogDescription>
              </DialogHeader>
              <AccessibleField className="space-y-2">
                <Label>Nombre del ejemplo</Label>
                <Input placeholder="Tu próximo objetivo" />
              </AccessibleField>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Volver</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Listo</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Abrir panel lateral</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader className="pr-12">
                <SheetTitle>El detalle, a tu alcance</SheetTitle>
                <SheetDescription>
                  Panel de ejemplo con espacio para revisar sin perder el contexto.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <Feedback title="Solo una demostración">
                  No hay información personal en este panel.
                </Feedback>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button>Entendido</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="outline">Abrir panel inferior</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Una tarea a la vez</DrawerTitle>
                <DrawerDescription>
                  Panel inferior de ejemplo. También se puede cerrar con Escape.
                </DrawerDescription>
              </DrawerHeader>
              <div className="mx-auto w-full max-w-lg px-4">
                <Feedback title="Diseñado para el tacto">
                  Controles cómodos y contenido desplazable.
                </Feedback>
              </div>
              <DrawerFooter className="mx-auto w-full max-w-lg">
                <DrawerClose asChild>
                  <Button>Cerrar panel inferior</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <Button variant="outline" onClick={notify}>
            Mostrar notificación
          </Button>
        </div>
      </Section>
      <footer className="border-t pt-6 text-sm text-muted-foreground">
        Atlántico · Fuentes del sistema · Sin recursos visuales externos · Movimiento reducido
        respetado.
      </footer>
    </div>
  )
}
