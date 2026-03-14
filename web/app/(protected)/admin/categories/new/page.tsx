"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/lib/ToastContext";

const inputClass =
  "border-border bg-background w-full rounded-lg border px-3 py-2 text-foreground focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus";
const labelClass = "text-foreground mb-1 block text-sm font-medium uppercase";
const labelStyle = { opacity: 0.85 };

export default function NewCategoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const handleSaveConfirm = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/podcast/categories", {
        body: JSON.stringify({
          description: description || null,
          name: name.trim(),
        }),
        method: "POST",
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
      toast.success("Category created.");
      router.push("/admin/categories");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setError(msg);
      toast.error(msg);
      setSaveModalOpen(false);
      setSubmitting(false);
    }
  }, [description, name, router, toast]);

  const dirty =
    name.trim() !== "" || description.trim() !== "";
  const nameError =
    name.trim() === "" && (dirty || triedSubmit);
  const saveDisabled = !dirty || submitting || name.trim() === "";

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === "") {
      setTriedSubmit(true);
      return;
    }
    setSaveModalOpen(true);
  }, [name]);

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
        <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          New Category
        </h1>
        <p className="text-foreground mb-6 text-sm" style={labelStyle}>
          Add a category for browsing episodes on the public site.
        </p>
        {error && (
          <p className="text-destructive mb-4 text-sm">{error}</p>
        )}
        <Card className="mb-8 p-6">
          <h2 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
            Category Details
          </h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className={labelClass} htmlFor="cat-name" style={labelStyle}>
                Name *
              </label>
              <input
                className={inputClass}
                id="cat-name"
                placeholder="Please enter a name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {nameError && (
                <p className="text-destructive mt-1 text-sm">
                  Please enter a name.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass} htmlFor="cat-desc" style={labelStyle}>
                Description
              </label>
              <textarea
                className={inputClass}
                id="cat-desc"
                placeholder="Please enter a description..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
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
                Create
              </Button>
            </div>
          </form>
        </Card>
        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Create"
          confirmLoading={submitting}
          message="Are you sure you want to create this category?"
          open={saveModalOpen}
          title="Create Category"
          onCancel={() => setSaveModalOpen(false)}
          onConfirm={handleSaveConfirm}
        />
      </div>
    </main>
  );
}
