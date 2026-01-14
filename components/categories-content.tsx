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
}

type CategoryFormData = {
  name: string
  parent: number | null
}

// Mock data with parent/child structure
const mockCategories: Category[] = [
  { id: 1, name: "Income", parent: null, active: true, isParent: true },
  { id: 2, name: "Salary", parent: 1, active: true, isParent: false },
  { id: 3, name: "Freelance", parent: 1, active: true, isParent: false },
  { id: 4, name: "Essential (50%)", parent: null, active: true, isParent: true },
  { id: 5, name: "Groceries", parent: 4, active: true, isParent: false },
  { id: 6, name: "Utilities", parent: 4, active: true, isParent: false },
  { id: 7, name: "Transportation", parent: 4, active: true, isParent: false },
  { id: 8, name: "Personal (30%)", parent: null, active: true, isParent: true },
  { id: 9, name: "Entertainment", parent: 8, active: true, isParent: false },
  { id: 10, name: "Dining Out", parent: 8, active: true, isParent: false },
  { id: 11, name: "Savings (20%)", parent: null, active: true, isParent: true },
  { id: 12, name: "Emergency Fund", parent: 11, active: true, isParent: false },
  { id: 13, name: "Investments", parent: 11, active: true, isParent: false },
]

export function CategoriesContent() {
  const [categories, setCategories] = React.useState<Category[]>(mockCategories)
  const [expandedParents, setExpandedParents] = React.useState<Set<number>>(new Set([1, 4, 8, 11]))
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [deactivateId, setDeactivateId] = React.useState<number | null>(null)
  const [editCategory, setEditCategory] = React.useState<Category | null>(null)
  const [formData, setFormData] = React.useState<CategoryFormData>({
    name: "",
    parent: null,
  })

  const parentCategories = categories.filter((c) => c.parent === null)
  const getChildren = (parentId: number) => categories.filter((c) => c.parent === parentId)

  const toggleExpand = (parentId: number) => {
    const newExpanded = new Set(expandedParents)
    if (newExpanded.has(parentId)) {
      newExpanded.delete(parentId)
    } else {
      newExpanded.add(parentId)
    }
    setExpandedParents(newExpanded)
  }

  const handleCreate = () => {
    const newCategory = {
      id: Math.max(...categories.map((c) => c.id)) + 1,
      name: formData.name,
      parent: formData.parent,
      active: true,
      isParent: false,
    }
    setCategories([...categories, newCategory])
    setIsCreateOpen(false)
    setFormData({ name: "", parent: null })
  }

  const handleEdit = () => {
    if (!editCategory) return
    setCategories(
      categories.map((cat) =>
        cat.id === editCategory.id ? { ...cat, name: formData.name, parent: formData.parent } : cat,
      ),
    )
    setIsEditOpen(false)
    setEditCategory(null)
    setFormData({ name: "", parent: null })
  }

  const handleDeactivate = () => {
    if (deactivateId) {
      setCategories(
        categories.map((cat) => (cat.id === deactivateId ? { ...cat, active: !cat.active } : cat)),
      )
      setDeactivateId(null)
    }
  }

  const openEdit = (category: Category) => {
    setEditCategory(category)
    setFormData({
      name: category.name,
      parent: category.parent,
    })
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                  value={formData.parent?.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, parent: value ? Number.parseInt(value) : null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (top-level)</SelectItem>
                    {parentCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No categories yet</p>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateId(parent.id)}
                          className="h-8 w-8 p-0"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
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
                                onClick={() => setDeactivateId(child.id)}
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
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
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
                value={formData.parent?.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, parent: value ? Number.parseInt(value) : null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None (top-level)</SelectItem>
                  {parentCategories
                    .filter((c) => c.id !== editCategory?.id)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={deactivateId !== null} onOpenChange={() => setDeactivateId(null)}>
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
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
