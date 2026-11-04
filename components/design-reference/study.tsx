"use client"

import {
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  CircleAlert,
  Layers3,
  Plus,
  Wallet,
} from "lucide-react"
import * as React from "react"

import styles from "@/components/design-reference/study.module.css"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/currency-formatter"
import {
  referenceAccounts,
  referenceContext,
  referenceShare,
  type ReferenceEnvelope,
  type ReferenceScenario,
} from "@/lib/design-reference"

type Variant = "marea" | "faro"
type Context = ReturnType<typeof referenceContext>
const percent = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 1 })

function Money({
  amount,
  currency,
  prominent = false,
}: {
  amount: number | null
  currency: string
  prominent?: boolean
}) {
  return (
    <span className={prominent ? styles.amount : styles.money} data-reference-money>
      {amount === null ? (
        "Por confirmar"
      ) : (
        <>
          <span>{currency} </span>
          <span className={styles.moneyDigits}>
            {formatCurrency(amount, currency).replace(currency, "").trim()}
          </span>
        </>
      )}
    </span>
  )
}

function Distribution({ context }: { context: Context }) {
  const { rows, positive, account } = context
  return (
    <section className={styles.distribution} aria-label="Distribución de saldos positivos">
      <div className={styles.sectionHeading}>
        <h3>La distribución, de un vistazo</h3>
        <Layers3 aria-hidden="true" size={18} />
      </div>
      {positive === null ? (
        <p>La distribución estará disponible cuando se confirmen todos los saldos.</p>
      ) : positive === 0 ? (
        <p>Todavía no hay saldos positivos que distribuir.</p>
      ) : (
        <>
          <p className={styles.distributionTotal}>
            <Money amount={positive} currency={account.currency} />{" "}
            <span>en sobres con saldo positivo</span>
          </p>
          <div className={styles.bars} aria-hidden="true">
            {rows
              .filter((r) => r.balance! > 0)
              .map((row) => (
                <div key={row.id} className={styles.barLine}>
                  <span>{row.name}</span>
                  <div className={styles.track}>
                    <i style={{ width: `${referenceShare(row.balance, positive)}%` }} />
                  </div>
                </div>
              ))}
          </div>
          <p className={styles.distributionNote}>
            Las barras comparan saldos positivos. No indican metas ni suficiencia; los negativos se
            muestran por separado.
          </p>
        </>
      )}
    </section>
  )
}

function Attention({
  context,
  onReview,
}: {
  context: Context
  onReview: (row: ReferenceEnvelope) => void
}) {
  return (
    <aside
      className={`${styles.attention} ${!context.negative.length ? styles.neutralAttention : ""}`}
      aria-label="Necesidades de atención"
      id="reference-attention"
    >
      <div className={styles.eyebrow}>
        <CircleAlert aria-hidden="true" size={18} />{" "}
        {context.negative.length ? "Para revisar" : "Tu panorama"}
      </div>
      {context.negative.length ? (
        context.negative.map((row) => (
          <div key={row.id}>
            <h3>{row.name}</h3>
            <p className={styles.negative}>
              <Money amount={row.balance} currency={context.account.currency} />
            </p>
            <p>
              Este sobre tiene saldo negativo. Revisa sus movimientos antes de trasladar dinero.
            </p>
            <Button
              className={styles.outlineButton}
              variant="outline"
              onClick={() => onReview(row)}
            >
              Revisar sobre <ArrowUpRight aria-hidden="true" />
            </Button>
          </div>
        ))
      ) : (
        <>
          <h3>
            {context.balance === null ? "Falta confirmar información" : "Sin saldos negativos"}
          </h3>
          <p>
            {context.balance === null
              ? "Un dato pendiente no se interpreta como cero. Espera a tener el panorama completo."
              : "Este es un dato de saldo, no una evaluación de tus metas o gastos futuros."}
          </p>
        </>
      )}
    </aside>
  )
}

function EnvelopeList({
  context,
  grouped,
  onReview,
  onLink,
}: {
  context: Context
  grouped: boolean
  onReview: (row: ReferenceEnvelope) => void
  onLink: () => void
}) {
  const groups = grouped ? [...new Set(context.rows.map((row) => row.group))] : [""]
  return (
    <section className={styles.ledger} aria-label="Tus sobres">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Cada propósito, en su lugar</p>
          <h2>
            Tus sobres <span className={styles.count}>{context.rows.length}</span>
          </h2>
        </div>
        <Button variant="ghost" className={styles.textButton} onClick={onLink}>
          <Plus aria-hidden="true" /> Vincular categoría
        </Button>
      </div>
      {groups.map((group) => (
        <div key={group} className={styles.rowGroup}>
          {group && <h3 className={styles.groupTitle}>{group}</h3>}
          <ul>
            {context.rows
              .filter((row) => !group || row.group === group)
              .map((row) => {
                const share = referenceShare(row.balance, context.positive)
                return (
                  <li key={row.id} data-envelope-id={row.id} className={styles.envelopeRow}>
                    <span className={styles.rowMark} aria-hidden="true">
                      <Wallet size={18} />
                    </span>
                    <div className={styles.rowName}>
                      <h3>{row.name}</h3>
                      <p>
                        {row.balance === null
                          ? "Saldo pendiente"
                          : row.balance < 0
                            ? "Saldo negativo · requiere revisión"
                            : row.balance === 0
                              ? "Sin saldo"
                              : share === null
                                ? "Saldo positivo · distribución pendiente"
                                : `${percent.format(share)} % del saldo positivo`}
                      </p>
                    </div>
                    <div className={styles.rowAmount}>
                      <span
                        className={
                          row.balance !== null && row.balance < 0 ? styles.negative : undefined
                        }
                      >
                        <Money amount={row.balance} currency={context.account.currency} />
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={styles.rowAction}
                      aria-label={`Ver sobre ${row.name}`}
                      onClick={() => onReview(row)}
                    >
                      <ArrowUpRight aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
          </ul>
        </div>
      ))}
    </section>
  )
}

export function AtlanticCompositionStudy({
  initialVariant = "marea",
}: {
  initialVariant?: Variant
}) {
  const [variant, setVariant] = React.useState<Variant>(initialVariant)
  const [scenario, setScenario] = React.useState<ReferenceScenario>("complete")
  const [accountId, setAccountId] = React.useState(1)
  const [dialog, setDialog] = React.useState<ReferenceEnvelope | "transfer" | "link" | null>(null)
  const openerRef = React.useRef<HTMLElement | null>(null)
  const openDialog = (value: ReferenceEnvelope | "transfer" | "link") => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDialog(value)
  }
  const context = referenceContext(accountId, scenario)
  const { account, balance, rows } = context
  const blocked = scenario === "loading" || scenario === "error"
  const onLink = () => openDialog("link")
  const action = (
    <Button
      className={styles.primaryButton}
      disabled={blocked || balance === null || rows.length < 2}
      onClick={() => openDialog("transfer")}
    >
      <ArrowRightLeft aria-hidden="true" /> Mover dinero
    </Button>
  )
  const selectedRow = typeof dialog === "object" ? dialog : null

  return (
    <div className={styles.study} data-study-root>
      <section className={styles.reviewTools} aria-label="Controles de la referencia">
        <div>
          <p className={styles.eyebrow}>Estudio de composición · ZA-111</p>
          <h1>Un Atlántico con más carácter.</h1>
          <p>
            Marea es la referencia elegida por el propietario. Faro se conserva para comparación.
            Datos ficticios.
          </p>
        </div>
        <div className={styles.toolFields}>
          <div>
            <label htmlFor="reference-composition">Composición</label>
            <select
              id="reference-composition"
              value={variant}
              onChange={(e) => setVariant(e.target.value as Variant)}
            >
              <option value="marea">A · Marea</option>
              <option value="faro">B · Faro</option>
            </select>
          </div>
          <div>
            <label htmlFor="reference-scenario">Escenario</label>
            <select
              id="reference-scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ReferenceScenario)}
            >
              <option value="complete">Datos completos</option>
              <option value="pending">Saldo pendiente</option>
              <option value="empty">Sin sobres</option>
              <option value="loading">Cargando</option>
              <option value="error">Error de carga</option>
            </select>
          </div>
        </div>
        <p className={styles.variantDescription}>
          {variant === "marea"
            ? "Marea · Un plano cobalto reúne saldo y distribución; el detalle respira en filas abiertas."
            : "Faro · El saldo ocupa un plano turquesa lateral; los sobres se agrupan por propósito y la distribución tiene su propio plano."}{" "}
          Cambia el tema con el control de apariencia de Zandaka.
        </p>
      </section>

      <article
        className={`${styles.canvas} ${variant === "faro" ? styles.faro : styles.marea}`}
        aria-label={`Sobres · ${variant === "marea" ? "Marea" : "Faro"}`}
        data-reference-canvas
      >
        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Tu dinero, con intención</p>
            <h2>
              Sobres
              <span className={styles.titleDot} aria-hidden="true">
                .
              </span>
            </h2>
            <p>Un lugar para cada parte de tu dinero.</p>
          </div>
          <span className={styles.sampleLabel}>Datos de ejemplo</span>
        </header>
        <div className={styles.accountPicker}>
          <label htmlFor="reference-account">Cuenta que estás organizando</label>
          <select
            id="reference-account"
            value={accountId}
            onChange={(e) => setAccountId(Number(e.target.value))}
          >
            {referenceAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
              </option>
            ))}
          </select>
          <span>{account.institution} · Cuenta bancaria</span>
        </div>

        <div className={styles.composition}>
          <section className={styles.balancePanel} aria-label="Saldo de la cuenta seleccionada">
            <div className={styles.balanceContent}>
              <p className={styles.eyebrow}>
                {account.currency} · {account.name}
              </p>
              <h3>El saldo de tus sobres</h3>
              <Money amount={balance} currency={account.currency} prominent />
              {context.negative.length > 0 && (
                <a className={styles.heroStatus} href="#reference-attention">
                  <CircleAlert aria-hidden="true" size={16} /> {context.negative.length} sobre con
                  saldo negativo <ArrowRight aria-hidden="true" size={16} />
                </a>
              )}
              <p className={styles.balanceNote}>
                {balance === null
                  ? "No mostramos un total mientras falte confirmar información."
                  : "Incluye saldos positivos, negativos y sobres sin saldo. Solo esta cuenta; sin conversión de moneda."}
              </p>
              <div className={styles.heroFooter}>
                <span>
                  {blocked ? "Información no disponible" : `${rows.length} sobres vinculados`}
                </span>
                {action}
              </div>
            </div>
            {variant === "marea" && (
              <svg
                className={styles.tide}
                viewBox="0 0 700 240"
                aria-hidden="true"
                data-reference-tide
              >
                <path
                  d="M0 220C180-90 340 310 700 50M0 250C240-70 350 340 700 80M0 280C250-30 430 330 700 110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
            )}
          </section>

          {blocked ? (
            <section className={styles.statePanel} role={scenario === "error" ? "alert" : "status"}>
              <h3>
                {scenario === "loading" ? "Cargando tus sobres…" : "No pudimos cargar tus sobres"}
              </h3>
              <p>
                {scenario === "loading"
                  ? "El saldo aparecerá cuando la información esté disponible."
                  : "No interpretamos un error como saldo cero. Puedes volver a cargar la información."}
              </p>
              {scenario === "loading" ? (
                <div className={styles.skeleton} aria-hidden="true" />
              ) : (
                <Button className={styles.primaryButton} onClick={() => setScenario("complete")}>
                  Volver a cargar el ejemplo
                </Button>
              )}
            </section>
          ) : scenario === "empty" ? (
            <section className={styles.statePanel}>
              <Layers3 aria-hidden="true" size={36} />
              <h3>Un propósito empieza con un sobre.</h3>
              <p>
                Esta cuenta todavía no tiene sobres. Vincula una categoría para comenzar a
                organizarla.
              </p>
              <Button className={styles.primaryButton} onClick={onLink}>
                <Plus aria-hidden="true" /> Vincular categoría
              </Button>
            </section>
          ) : (
            <>
              <div className={styles.distributionPanel}>
                <Distribution context={context} />
              </div>
              <div className={styles.listPanel}>
                <EnvelopeList
                  context={context}
                  grouped={variant === "faro"}
                  onReview={openDialog}
                  onLink={onLink}
                />
              </div>
              <div className={styles.sidePanel}>
                <Attention context={context} onReview={openDialog} />
                <div className={styles.contextNote}>
                  <p className={styles.eyebrow}>Organizar no es gastar</p>
                  <h3>El dinero cambia de lugar, no de dueño.</h3>
                  <p>Mover dinero entre sobres de una misma cuenta conserva su saldo total.</p>
                  <ArrowRight aria-hidden="true" size={24} />
                </div>
              </div>
            </>
          )}
        </div>
        <footer className={styles.canvasFooter}>
          <span>Zandaka</span>
          <p>
            Referencia interactiva con datos ficticios. Ninguna acción modifica cuentas o saldos.
          </p>
        </footer>
      </article>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {selectedRow
                ? selectedRow.name
                : dialog === "transfer"
                  ? "Mover dinero entre sobres"
                  : "Vincular una categoría"}
            </DialogTitle>
            <DialogDescription>
              Muestra de interacción de ZA-111. Usa datos ficticios y no realiza operaciones.
            </DialogDescription>
          </DialogHeader>
          {selectedRow ? (
            <div className="space-y-3">
              <p>
                {account.name} · {account.currency}
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                <Money amount={selectedRow.balance} currency={account.currency} />
              </p>
              <p>
                {selectedRow.balance === null
                  ? "Este dato está por confirmar; no se sustituye por cero."
                  : selectedRow.balance < 0
                    ? "Saldo negativo. La vista real permitirá revisar sus movimientos."
                    : "La vista real permitirá consultar los movimientos de este sobre."}
              </p>
            </div>
          ) : (
            <p>
              {dialog === "transfer"
                ? "La aplicación dispone del compositor de transferencias en Movimientos. Esta referencia muestra la jerarquía y el acceso a esa acción, sin duplicar el flujo financiero."
                : "La categoría se vincula a la cuenta seleccionada para crear un sobre. Este ejemplo permite revisar el diálogo sin guardar cambios."}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button>Cerrar ejemplo</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
