"use client"

import { Plus, Edit2, XCircle, ChevronDown, ChevronRight } from "lucide-react"
import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { AccessibleField, AccessibleFieldError } from "@/components/ui/accessible-field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  DialogTrigger,
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
import { readPublicError } from "@/lib/public-error"

type Category = {
  id: number
  name: string
  parent: number | null
  active: boolean
  isParent: boolean
  hasActiveChildren: boolean
}

type CategoryFormData = {
  name: string
  parent: number | null
}

export function CategoriesContent() {
  const [categories, setCategories] = React.useState<Category[]>([])
  const [expandedParents, setExpandedParents] = React.useState<Set<number>>(new Set())
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [editCategory, setEditCategory] = React.useState<Category | null>(null)
  const [formData, setFormData] = React.useState<CategoryFormData>({
    name: "",
    parent: null,
  })
  const [isSaving, setIsSaving] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  const [isDeactivating, setIsDeactivating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [deactivateError, setDeactivateError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  const parentCategories = categories.filter((c) => c.parent === null)
  const getChildren = (parentId: number) => categories.filter((c) => c.parent === parentId)
  const getNextId = (items: Category[]) =>
    items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1
  const normalizeId = React.useCallback((value: unknown) => {
    if (typeof value === "number") return value
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseInt(value, 10)
      return Number.isNaN(parsed) ? null : parsed
    }
    return null
  }, [])
  const mapApiCategory = React.useCallback(
    (item: {
      id: number | string
      name: string
      parentId?: number | string | null
      parent_id?: number | string | null
      parent?: number | string | { id?: number | string | null } | null
      active?: boolean
      hasActiveChildren?: boolean
    }): Category => {
      const parentValue =
        item.parentId ??
        item.parent_id ??
        (typeof item.parent === "object" && item.parent ? item.parent.id : item.parent)
      const parent = normalizeId(parentValue)
      return {
        id: normalizeId(item.id) ?? 0,
        name: item.name,
        parent,
        active: typeof item.active === "boolean" ? item.active : true,
        isParent: parent === null,
        hasActiveChildren: Boolean(item.hasActiveChildren),
      }
    },
    [normalizeId],
  )

  const toggleExpand = (parentId: number) => {
    const newExpanded = new Set(expandedParents)
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId)
    } else {
      newExpanded.add(parentId)
    }
    setExpandedParents(newExpanded)
  }

  const resetForm = () => {
    setFormData({ name: "", parent: null })
    setEditCategory(null)
  }

  const loadCategories = React.useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setLoadError(null)

      try {
        const response = await fetch("/api/categories?activeOnly=true", {
          headers: { accept: "application/json" },
          signal,
        })

        if (!response.ok) {
          throw new Error(
            await readPublicError(response, "No se pudo cargar categorías. Intenta más tarde."),
          )
        }

        const data = await response.json()
        const items = Array.isArray(data) ? data : []
        const mapped = items.map(mapApiCategory)
        setCategories(mapped)
        setExpandedParents(
          new Set(mapped.filter((item) => item.parent === null).map((item) => item.id)),
        )
      } catch (error) {
        if (signal?.aborted) return
        const fallbackMessage = "No se pudo cargar categorías. Intenta más tarde."
        const rawMessage = error instanceof Error && error.message ? error.message : fallbackMessage
        const isHtmlLike = /<!doctype\s+html|<html/i.test(rawMessage)
        const isNetworkError = /failed to fetch|networkerror/i.test(rawMessage)
        setLoadError(isHtmlLike || isNetworkError ? fallbackMessage : rawMessage)
      } finally {
        setIsLoading(false)
      }
    },
    [mapApiCategory],
  )

  React.useEffect(() => {
    const controller = new AbortController()
    loadCategories(controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadCategories])

  const handleCreate = async () => {
    if (!formData.name || isSaving) return
    setIsSaving(true)
    setCreateError(null)

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: 1,
          name: formData.name,
          parentId: formData.parent,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await readPublicError(
            response,
            "No pudimos crear la categoría. Revisa los datos y vuelve a intentar.",
          ),
        )
      }

      const data = await response.json()
      const parentId = normalizeId(data?.parentId ?? data?.parent) ?? formData.parent ?? null

      setCategories((prev) => {
        const nextId = getNextId(prev)
        const newCategory: Category = {
          id: normalizeId(data?.id) ?? nextId,
          name: typeof data?.name === "string" ? data.name : formData.name,
          parent: parentId,
          active: typeof data?.active === "boolean" ? data.active : true,
          isParent: parentId === null,
          hasActiveChildren: false,
        }
        return [...prev, newCategory]
      })

      setIsCreateOpen(false)
      resetForm()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "No pudimos crear la categoría. Revisa los datos y vuelve a intentar."
      setCreateError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!editCategory || !formData.name || isEditing) return

    const children = getChildren(editCategory.id)
    const hasActiveChildren =
      editCategory.hasActiveChildren || children.some((child) => child.active)
    const isAttemptingToBeChild = editCategory.parent === null && formData.parent !== null

    if (hasActiveChildren && isAttemptingToBeChild) {
      setEditError("No puedes mover una categoría principal con subcategorías activas.")
      return
    }

    setIsEditing(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/categories/${editCategory.id}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          parentId: formData.parent,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await readPublicError(response, "No pudimos guardar la categoría. Vuelve a intentar."),
        )
      }

      await loadCategories()
      setIsEditOpen(false)
      resetForm()
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "No pudimos guardar la categoría. Vuelve a intentar."
      setEditError(message)
    } finally {
      setIsEditing(false)
    }
  }

  const handleDeactivate = async () => {
    if (!deactivateId || isDeactivating) return
    setIsDeactivating(true)
    setDeactivateError(null)

    try {
      const response = await fetch(`/api/categories/${deactivateId}/deactivate`, {
        method: "POST",
        headers: { accept: "application/json" },
      })

      if (!response.ok) {
        throw new Error(
          await readPublicError(
            response,
            "No pudimos desactivar la categoría. Revisa sus subcategorías.",
          ),
        )
      }

      await loadCategories()
      setDeactivateId(null)
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "No pudimos desactivar la categoría. Revisa sus subcategorías."
      setDeactivateError(message)
    } finally {
      setIsDeactivating(false)
    }
  }

  const openEdit = (category: Category) => {
    setEditCategory(category)
    setFormData({
      name: category.name,
      parent: category.parent,
    })
    setEditError(null)
    setIsEditOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Categorías</>}
        description={<>Organiza categorías principales y subcategorías</>}
        actionsLabel="Acciones de categorías"
      >
        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) {
              setCreateError(null)
              resetForm()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Añadir categoría
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear categoría</DialogTitle>
              <DialogDescription>
                Añade una categoría. Las subcategorías se vinculan a los sobres.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <AccessibleField className="space-y-2">
                <Label htmlFor="name">Nombre de la categoría</Label>
                <Input
                  id="name"
                  placeholder="Por ejemplo, Alimentación"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </AccessibleField>
              <AccessibleField className="space-y-2">
                <Label htmlFor="parent">Categoría principal (opcional)</Label>
                <Select
                  value={formData.parent === null ? NO_PARENT_VALUE : formData.parent?.toString()}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      parent: value === NO_PARENT_VALUE ? null : Number.parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="Ninguna (categoría principal)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT_VALUE}>Ninguna (categoría principal)</SelectItem>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AccessibleField>
              {createError && (
                <AccessibleFieldError className="text-sm text-destructive">
                  {createError}
                </AccessibleFieldError>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false)
                  resetForm()
                  setCreateError(null)
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name || isSaving}>
                {isSaving ? "Creando…" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Cargando categorías…</p>
          </CardContent>
        </Card>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {loadError ? loadError : "Todavía no hay categorías"}
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Añadir mi primera categoría
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Árbol de categorías</CardTitle>
            <CardDescription>
              Organiza categorías principales y subcategorías. Estas últimas se vinculan a los
              sobres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {parentCategories.map((parent) => {
                const children = getChildren(parent.id)
                const isExpanded = expandedParents.has(parent.id)
                const hasActiveChildren =
                  parent.hasActiveChildren || children.some((child) => child.active)
                const canDeactivate = !hasActiveChildren

                return (
                  <div key={parent.id}>
                    <div className="flex items-center justify-between rounded-lg hover:bg-muted/50 p-2">
                      <div className="flex items-center gap-2 flex-1">
                        {children.length > 0 && (
                          <button
                            onClick={() => toggleExpand(parent.id)}
                            aria-label={(isExpanded ? "Contraer " : "Expandir ") + parent.name}
                            aria-expanded={isExpanded}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {children.length === 0 && <div className="w-4" />}
                        <span className="font-medium">{parent.name}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Principal
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(parent)}
                          aria-label={"Editar categoría " + parent.name}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {canDeactivate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeactivateId(parent.id)
                              setDeactivateError(null)
                            }}
                            className="h-8 w-8 p-0"
                            aria-label={"Desactivar categoría " + parent.name}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && children.length > 0 && (
                      <div className="ml-6 border-l border-border space-y-1">
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center justify-between rounded-lg hover:bg-muted/50 p-2"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div className="w-4" />
                              <span className="text-sm">{child.name}</span>
                              <Badge variant="outline" className="ml-auto text-xs">
                                {child.active ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(child)}
                                aria-label={"Editar categoría " + child.name}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeactivateId(child.id)
                                  setDeactivateError(null)
                                }}
                                className="h-8 w-8 p-0"
                                aria-label={"Desactivar categoría " + child.name}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open)
          if (!open) {
            resetForm()
            setEditError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
            <DialogDescription>Actualiza los datos de la categoría</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <AccessibleField className="space-y-2">
              <Label htmlFor="edit-name">Nombre de la categoría</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </AccessibleField>
            <AccessibleField className="space-y-2">
              <Label htmlFor="edit-parent">Categoría principal</Label>
              <Select
                disabled={
                  Boolean(editCategory) &&
                  editCategory?.parent === null &&
                  (editCategory?.hasActiveChildren ||
                    getChildren(editCategory?.id ?? 0).some((child) => child.active))
                }
                value={formData.parent === null ? NO_PARENT_VALUE : formData.parent?.toString()}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    parent: value === NO_PARENT_VALUE ? null : Number.parseInt(value),
                  })
                }
              >
                <SelectTrigger id="edit-parent">
                  <SelectValue placeholder="Ninguna (categoría principal)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT_VALUE}>Ninguna (categoría principal)</SelectItem>
                  {parentCategories
                    .filter((c) => c.id !== editCategory?.id)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {editCategory?.parent === null &&
                (editCategory?.hasActiveChildren ||
                  getChildren(editCategory?.id ?? 0).some((child) => child.active)) && (
                  <p className="text-xs text-muted-foreground">
                    No puedes mover una categoría principal con subcategorías activas.
                  </p>
                )}
            </AccessibleField>
            {editError && (
              <AccessibleFieldError className="text-sm text-destructive">
                {editError}
              </AccessibleFieldError>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditOpen(false)
                resetForm()
                setEditError(null)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name || isEditing}>
              {isEditing ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog
        open={deactivateId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateId(null)
            setDeactivateError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {categories.find((c) => c.id === deactivateId)?.active ? "Desactivar" : "Activar"}{" "}
              categoría
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción permitirá{" "}
              {categories.find((c) => c.id === deactivateId)?.active ? "deactivate" : "activate"} la
              categoría.
            </AlertDialogDescription>
            {deactivateError && (
              <AlertDialogDescription className="text-destructive">
                {deactivateError}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleDeactivate()
              }}
              disabled={isDeactivating}
            >
              {isDeactivating ? "Confirming..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
const NO_PARENT_VALUE = "none"
