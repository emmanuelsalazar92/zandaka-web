/** API codes stay unchanged. Product copy never exposes server exceptions or implementation details. */
export function publicErrorMessage(payload: unknown, fallback: string): string {
  const error =
    typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error?: unknown }).error
      : payload
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : ""
  const messages: Record<string, string> = {
    VALIDATION_ERROR: "Revisa los campos indicados y vuelve a intentar.",
    NOT_FOUND: "No encontramos este registro. Actualiza la vista para continuar.",
    CONFLICT: "El registro cambió o ya existe. Actualiza la vista y revisa los datos.",
    UNAUTHORIZED: "Tu sesión necesita atención. Vuelve a ingresar para continuar.",
    FORBIDDEN: "No tienes acceso a esta acción. Revisa tu sesión.",
    INTERNAL_ERROR: "No pudimos completar la operación. Vuelve a intentar en un momento.",
  }
  return messages[code] ?? fallback
}

export async function readPublicError(response: Response, fallback: string): Promise<string> {
  const payload: unknown = await response.json().catch(() => null)
  return publicErrorMessage(payload, fallback)
}
