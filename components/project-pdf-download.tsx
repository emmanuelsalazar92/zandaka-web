"use client"

import { Download } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Feedback } from "@/components/ui/feedback"
import { getProjectPdf, ProjectRequestError } from "@/lib/project-api"

function errorMessage(error: unknown) {
  if (error instanceof ProjectRequestError) {
    switch (error.code) {
      case "PROJECT_PDF_LIMIT":
        return "El informe admite hasta 2.000 líneas que computan en el costo. Puedes consultar el desglose en el proyecto."
      case "PDF_BUSY":
        return "Ya se está generando otro informe. Espera un momento y vuelve a intentar."
      case "PDF_TIMEOUT":
        return "El informe tardó demasiado. Vuelve a seleccionar Descargar PDF."
      case "FEATURE_NOT_READY":
        return "El almacenamiento de Proyectos aún no está habilitado en este entorno."
      case "NOT_FOUND":
        return "El proyecto ya no está disponible. Actualiza la página para verificar su estado."
    }
  }
  return "Vuelve a seleccionar Descargar PDF para reintentar."
}

export function ProjectPdfDownload({
  id,
  variant,
}: {
  id: string
  variant: "default" | "outline"
}) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState("")
  const [downloaded, setDownloaded] = React.useState(false)
  const pending = React.useRef<AbortController>(null)

  React.useEffect(() => () => pending.current?.abort(), [])

  async function download() {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError("")
    setDownloaded(false)
    try {
      const { blob, filename } = await getProjectPdf(id, controller.signal)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.append(link)
      try {
        link.click()
      } finally {
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
      setDownloaded(true)
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error))
    } finally {
      pending.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <div className="min-w-0 space-y-2">
      <Button variant={variant} onClick={download} disabled={busy}>
        <Download aria-hidden="true" />
        {busy ? "Generando PDF…" : "Descargar PDF"}
      </Button>
      {error && (
        <Feedback tone="error" title="No pudimos descargar el PDF">
          {error}
        </Feedback>
      )}
      <span className="sr-only" role="status">
        {busy
          ? "Generando el informe del proyecto"
          : downloaded
            ? "Descarga del informe iniciada"
            : ""}
      </span>
    </div>
  )
}
