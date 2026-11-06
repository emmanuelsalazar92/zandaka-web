"use client"
import { Archive, Download } from "lucide-react"
import * as React from "react"

import { useContextRead } from "@/components/accounts/hooks/use-context-read"
import { Button } from "@/components/ui/button"
import { Feedback, LoadingState } from "@/components/ui/feedback"
import { formatCurrency } from "@/lib/currency-formatter"
import { getReportHtmlUrl, getReportPdfUrl, type ReportSnapshot } from "@/lib/reports-api"

import { formatReportMonth, formatSnapshotTimestamp } from "./report-helpers"
import styles from "./reports.module.css"

type Props = { report: ReportSnapshot | null; archiveBusy?: boolean; onArchive?: () => void }
export function ReportPreviewPanel({ report, archiveBusy = false, onArchive }: Props) {
  const url = report ? getReportHtmlUrl(report.id) : null
  const load = React.useCallback(
    async (signal: AbortSignal) => {
      const response = await fetch(url!, {
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      })
      if (!response.ok || !response.headers.get("content-type")?.includes("text/html"))
        throw new Error("Vista no disponible")
      const html = await response.text()
      if (!/<html[\s>]/i.test(html)) throw new Error("Documento incompleto")
      const policy =
        '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; base-uri &#39;none&#39;; form-action &#39;none&#39;">'
      if (!/<head[\s>]/i.test(html)) throw new Error("Documento incompleto")
      return html.replace(/<head(?:\s[^>]*)?>/i, (head) => head + policy)
    },
    [url],
  )
  const preview = useContextRead(url, load)
  if (!report)
    return (
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Elige un reporte</h2>
        <p>Consulta una versión histórica sin modificar sus saldos.</p>
      </section>
    )
  const amount = (value: number | null, currency: string) =>
    value === null ? "No disponible" : formatCurrency(value, currency)
  return (
    <section aria-label="Versión histórica seleccionada" className="min-w-0 space-y-5">
      <div className={styles.hero}>
        <p className="text-sm">
          {formatReportMonth(report.reportMonth)} · Versión {report.version} ·{" "}
          {report.isLatest ? "Más reciente del mes" : "Versión anterior"}
        </p>
        <h2 className="mt-3">Tu dinero, en ese momento.</h2>
        <p className="mt-4 text-sm">Saldo consolidado · {report.baseCurrency}</p>
        <p className={styles.amount}>{amount(report.consolidatedAmount, report.baseCurrency)}</p>
        <p className="text-sm">
          Capturado {formatSnapshotTimestamp(report.generatedAt)} · Costa Rica
        </p>
      </div>
      <div className={styles.context}>
        Esta versión conserva los saldos capturados al generarse. El mes es una referencia; no
        acredita cierre contable. Los movimientos posteriores no recalculan este reporte.
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Saldo original · CRC</dt>
          <dd>{amount(report.totalCrc, "CRC")}</dd>
        </div>
        <div>
          <dt>Saldo original · USD</dt>
          <dd>{amount(report.totalUsd, "USD")}</dd>
        </div>
        <div>
          <dt>Conversión conservada</dt>
          <dd>
            {report.exchangeRateUsed === null
              ? "No disponible"
              : report.baseCurrency === "CRC"
                ? `1 USD = ${amount(report.exchangeRateUsed, "CRC")}`
                : `1 CRC = ${amount(report.exchangeRateUsed, "USD")}`}
          </dd>
        </div>
      </dl>
      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer font-medium">Trazabilidad y notas</summary>
        <dl className={`${styles.facts} mt-4`}>
          <div>
            <dt>Documento</dt>
            <dd>
              #{report.id} · v{report.version}
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              {{ DRAFT: "Borrador", FINALIZED: "Finalizado", ARCHIVED: "Archivado" }[report.status]}
            </dd>
          </div>
          <div>
            <dt>Regla CCSS conservada</dt>
            <dd>
              {report.ccssRuleSetId ? `#${report.ccssRuleSetId}` : "Sin referencia conservada"}
            </dd>
          </div>
          <div>
            <dt>Regla de renta conservada</dt>
            <dd>
              {report.incomeTaxRuleSetId
                ? `#${report.incomeTaxRuleSetId}`
                : "Sin referencia conservada"}
            </dd>
          </div>
          <div>
            <dt>Fecha efectiva de cotización / corte</dt>
            <dd>No conservados como campos independientes.</dd>
          </div>
        </dl>
        {report.notes && <p className="mt-4 whitespace-pre-wrap">{report.notes}</p>}
      </details>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={getReportPdfUrl(report.id, "attachment")}>
            <Download aria-hidden="true" className="size-4" />
            Descargar PDF
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={url!} target="_blank" rel="noopener noreferrer">
            Abrir informe
          </a>
        </Button>
        <Button variant="outline" disabled={archiveBusy} onClick={onArchive}>
          <Archive aria-hidden="true" className="size-4" />
          Archivar
        </Button>
      </div>
      <section className="min-w-0 space-y-3" aria-label="Documento histórico">
        <h2 className="text-xl font-semibold">Detalle por cuenta</h2>
        {preview.loading && <LoadingState>Cargando documento histórico…</LoadingState>}
        {preview.error && (
          <Feedback tone="error" title="Vista del documento no disponible">
            El resumen histórico sigue disponible. Puedes abrir el informe, descargar el PDF o{" "}
            <Button variant="outline" onClick={preview.reload}>
              Reintentar vista
            </Button>
            .
          </Feedback>
        )}
        {preview.data && (
          <iframe
            key={url}
            title={`Reporte histórico, versión ${report.version}`}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={preview.data}
            className="h-[70vh] min-h-96 w-full rounded-xl border bg-white"
          />
        )}
      </section>
    </section>
  )
}
