"use client"

import { Plus, Edit2, XCircle, ChevronDown, ChevronRight } from "lucide-react"
import * as React from "react"

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
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/categories?activeOnly=true`,
          {
            headers: { accept: "application/json" },
            signal,
          },
        )

        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || "Failed to load categories.")
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
        const message =
          error instanceof Error && error.message ? error.message : "Failed to load categories."
        setLoadError(message)
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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`, {
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
        const message = await response.text()
        throw new Error(message || "Failed to create category.")
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
        error instanceof Error && error.message ? error.message : "Failed to create category."
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
      setEditError("Parent categories with active subcategories cannot be moved.")
      return
    }

    setIsEditing(true)
    setEditError(null)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/categories/${editCategory.id}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            parentId: formData.parent,
          }),
        },
      )

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || "Failed to update category.")
      }

      await loadCategories()
      setIsEditOpen(false)
      resetForm()
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Failed to update category."
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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/categories/${deactivateId}/deactivate`,
        {
          method: "POST",
          headers: { accept: "application/json" },
        },
      )

      if (!response.ok) {
        let message = "Failed to deactivate category."
        try {
          const errorResponse = await response.json()
          message = errorResponse?.error?.message || errorResponse?.message || message
        } catch {}
        if (response.status === 409) {
          message = message || "Category has active subcategories."
        }
        throw new Error(message)
      }

      await loadCategories()
      setDeactivateId(null)
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Failed to deactivate category."
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Categories</h2>
          <p className="text-muted-foreground">
            Manage your budget categories (parent/child structure)
          </p>
        </div>
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
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
              <DialogDescription>
                Add a new category. Subcategories are used for envelopes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Groceries"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent">Parent Category (Optional)</Label>
                <Select
                  value={formData.parent === null ? NO_PARENT_VALUE : formData.parent?.toString()}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      parent: value === NO_PARENT_VALUE ? null : Number.parseInt(value),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT_VALUE}>None (top-level)</SelectItem>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
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
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name || isSaving}>
                {isSaving ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Loading categories...</p>
          </CardContent>
        </Card>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {loadError ? loadError : "No categories yet"}
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Category Tree</CardTitle>
            <CardDescription>
              Organize categories with parent/child relationships. Subcategories are used for
              envelopes.
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
                          Parent
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(parent)}
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
                                {child.active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(child)}
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
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Update category details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Category Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-parent">Parent Category</Label>
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
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT_VALUE}>None (top-level)</SelectItem>
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
                    Parent categories with active subcategories cannot be moved.
                  </p>
                )}
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
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
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name || isEditing}>
              {isEditing ? "Saving..." : "Save Changes"}
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
              {categories.find((c) => c.id === deactivateId)?.active ? "Deactivate" : "Activate"}{" "}
              Category?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will{" "}
              {categories.find((c) => c.id === deactivateId)?.active ? "deactivate" : "activate"}{" "}
              the category.
            </AlertDialogDescription>
            {deactivateError && (
              <AlertDialogDescription className="text-destructive">
                {deactivateError}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                handleDeactivate()
              }}
              disabled={isDeactivating}
            >
              {isDeactivating ? "Confirming..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
const NO_PARENT_VALUE = "none"
