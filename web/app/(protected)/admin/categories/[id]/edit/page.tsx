"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  adminFormInputClass as inputClass,
  adminFormLabelClass as labelClass,
} from "@/lib/admin-form-classes";
import { useToast } from "@/lib/ToastContext";

const labelStyle = { opacity: 0.85 };

interface Category {
  description: string | null;
  id: string;
  name: string;
  slug: string;
}

export default function EditCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof params.id === "string" ? params.id : "";
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/podcast/categories/${id}`);
        if (!res.ok || cancelled) return;
        const { data } = await res.json();
        if (data) {
          setCategory(data);
          setName(data.name ?? "");
          setSlug(data.slug ?? "");
          setDescription(data.description ?? "");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSaveConfirm = useCallback(async () => {
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/podcast/categories/${id}`, {
        body: JSON.stringify({
          description: description || null,
          name: name.trim(),
          slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
        }),
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      setSaveModalOpen(false);
      if (!res.ok) {
        const msg = j.error ?? res.statusText;
        setError(msg);
        toast.error(msg);
        setSubmitting(false);
        return;
      }
      toast.success("Category saved.");
      router.push("/admin/categories");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setError(msg);
      toast.error(msg);
      setSaveModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [description, id, name, router, slug, toast]);

  const dirty = category
    ? name.trim() !== (category.name ?? "").trim() ||
      slug.trim().toLowerCase().replace(/\s+/g, "-") !==
        (category.slug ?? "").toLowerCase().replace(/\s+/g, "-") ||
      (description || null) !== (category.description ?? null)
    : false;

  const nameError = name.trim() === "";
  const saveDisabled = !dirty || submitting || nameError;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === "") return;
    setSaveModalOpen(true);
  }, [name]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/podcast/categories/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteModalOpen(false);
        toast.success("Category deleted.");
        router.push("/admin/categories");
      } else {
        const j = await res.json().catch(() => ({}));
        const msg = j.error ?? "Delete failed";
        setError(msg);
        toast.error(msg);
        setDeleteModalOpen(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      toast.error(msg);
      setDeleteModalOpen(false);
    }
  }, [id, router, toast]);

  if (loading) {
    return (
      <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center gap-4">
            <div className="bg-surface-hover h-4 w-24 animate-pulse rounded" />
          </div>
          <div className="text-foreground mb-2 h-8 w-48 animate-pulse rounded bg-surface-hover" />
          <div className="text-foreground mb-6 h-4 w-64 animate-pulse rounded bg-surface-hover" />
          <Card className="mb-8 p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="bg-surface-hover h-5 w-40 animate-pulse rounded" />
              <div className="bg-surface-hover h-9 w-9 animate-pulse rounded" />
            </div>
            <div className="space-y-6">
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-12 animate-pulse rounded" />
                <div className="bg-surface-hover h-10 w-full animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-10 animate-pulse rounded" />
                <div className="bg-surface-hover h-10 w-full animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-20 animate-pulse rounded" />
                <div className="bg-surface-hover h-20 w-full animate-pulse rounded-lg" />
              </div>
              <div className="flex justify-end gap-4 pt-8">
                <div className="bg-surface-hover h-9 w-16 animate-pulse rounded-md" />
                <div className="bg-surface-hover h-9 w-14 animate-pulse rounded-md" />
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }
  if (!category) {
    return (
      <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-muted text-sm">Category not found.</p>
          <Link
            className="text-foreground mt-2 inline-block text-sm underline"
            href="/admin/categories"
          >
            Back to Categories
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <Link
            className="text-muted hover:text-foreground text-sm"
            href="/admin/categories"
          >
            ← Categories
          </Link>
        </div>
        <h1 className="text-foreground mb-3 text-2xl font-semibold tracking-wide">
          {category.name}
        </h1>
        <p className="text-foreground mb-8 text-sm" style={labelStyle}>
          Update category details.
        </p>
        {error && (
          <p className="text-destructive mb-6 text-sm">{error}</p>
        )}
        <Card className="mb-8 p-8 font-sans text-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
              Category Details
            </h2>
            <Button
              aria-label="Delete"
              className="cursor-pointer p-2 hover:bg-transparent"
              type="button"
              variant="ghost"
              onClick={() => setDeleteModalOpen(true)}
            >
              <Trash2 aria-hidden className="h-4 w-4" />
            </Button>
          </div>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className={labelClass} htmlFor="edit-cat-name" style={labelStyle}>
                Name *
              </label>
              <input
                className={inputClass}
                id="edit-cat-name"
                placeholder="Please enter a name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {nameError && (
                <p className="text-destructive mt-2 text-xs">
                  Please enter a name.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="edit-cat-slug" style={labelStyle}>
                Slug
              </label>
              <input
                className={`${inputClass} font-mono`}
                id="edit-cat-slug"
                placeholder="Please enter a slug..."
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="edit-cat-desc" style={labelStyle}>
                Description
              </label>
              <textarea
                className={inputClass}
                id="edit-cat-desc"
                placeholder="Please enter a description..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-4 pt-8">
              <Link href="/admin/categories">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button
                disabled={saveDisabled}
                loading={submitting}
                type="submit"
                variant="primary"
              >
                Save
              </Button>
            </div>
          </form>
        </Card>
        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Delete"
          message="Are you sure you want to delete this category? This cannot be undone."
          open={deleteModalOpen}
          title="Delete Category"
          onCancel={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteConfirm}
        />
        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Save"
          confirmLoading={submitting}
          message="Are you sure you want to save changes to this category?"
          open={saveModalOpen}
          title="Save Changes"
          onCancel={() => setSaveModalOpen(false)}
          onConfirm={handleSaveConfirm}
        />
      </div>
    </main>
  );
}
