"use client";

import { Eye, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/lib/ToastContext";

const inputClass =
  "border-border bg-background w-full rounded-lg border px-3 py-2 text-foreground focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-border-focus";
const labelClass = "text-foreground mb-1 block text-sm font-medium uppercase";
const labelStyle = { opacity: 0.85 };

interface Episode {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  show_notes: string | null;
  transcript: string | null;
  published_at: string | null;
  status: string;
  audio_url: string | null;
  image_url: string | null;
  audio_storage_path: string | null;
  image_storage_path: string | null;
  duration_seconds: number | null;
  order_index: number;
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEpisodePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = typeof params.id === "string" ? params.id : "";
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [showNotes, setShowNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [publishedAt, setPublishedAt] = useState("");
  const [audioStoragePath, setAudioStoragePath] = useState("");
  const [audioDisplayUrl, setAudioDisplayUrl] = useState<string | null>(null);
  const [imageStoragePath, setImageStoragePath] = useState("");
  const [imageDisplayUrl, setImageDisplayUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState("");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
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
        const res = await fetch(`/api/admin/podcast/episodes/${id}`);
        if (!res.ok || cancelled) return;
        const { data } = await res.json();
        if (data) {
          setEpisode(data);
          setTitle(data.title ?? "");
          setSlug(data.slug ?? "");
          setDescription(data.description ?? "");
          setShowNotes(data.show_notes ?? "");
          setStatus(
            data.status === "published" ? "published" : "draft"
          );
          setPublishedAt(toDatetimeLocal(data.published_at));
          setAudioStoragePath(data.audio_storage_path ?? "");
          setImageStoragePath(data.image_storage_path ?? "");
          setDurationSeconds(
            data.duration_seconds != null ? String(data.duration_seconds) : ""
          );
          if (data.audio_url) {
            setAudioDisplayUrl(data.audio_url);
          } else if (data.audio_storage_path) {
            const sr = await fetch(
              `/api/admin/podcast/episodes/${id}/signed-url?type=audio`
            );
            const sj = await sr.json().catch(() => ({}));
            if (sr.ok && sj.url) setAudioDisplayUrl(sj.url);
          }
          if (data.image_url) {
            setImageDisplayUrl(data.image_url);
          } else if (data.image_storage_path) {
            const ir = await fetch(
              `/api/admin/podcast/episodes/${id}/signed-url?type=image`
            );
            const ij = await ir.json().catch(() => ({}));
            if (ir.ok && ij.url) setImageDisplayUrl(ij.url);
          }
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
      const res = await fetch(`/api/admin/podcast/episodes/${id}`, {
        body: JSON.stringify({
          audio_storage_path: audioStoragePath || null,
          description: description || null,
          duration_seconds: durationSeconds
            ? parseInt(durationSeconds, 10)
            : null,
          image_storage_path: imageStoragePath || null,
          show_notes: showNotes || null,
          slug: slug || title.toLowerCase().replace(/\s+/g, "-"),
          status,
          title,
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
      toast.success("Episode saved.");
      router.push("/admin/episodes");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setError(msg);
      toast.error(msg);
      setSaveModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [
    id,
    audioStoragePath,
    description,
    durationSeconds,
    imageStoragePath,
    showNotes,
    slug,
    status,
    title,
    router,
    toast,
  ]);

  const initialDuration =
    episode?.duration_seconds != null
      ? String(episode.duration_seconds)
      : "";
  const dirty = episode
    ? title.trim() !== (episode.title ?? "").trim() ||
      (slug || title.toLowerCase().replace(/\s+/g, "-")) !==
        (episode.slug ?? "").toLowerCase().replace(/\s+/g, "-") ||
      (description || null) !== (episode.description ?? null) ||
      (showNotes || null) !== (episode.show_notes ?? null) ||
      status !== (episode.status === "published" ? "published" : "draft") ||
      (audioStoragePath || null) !== (episode.audio_storage_path ?? null) ||
      (imageStoragePath || null) !== (episode.image_storage_path ?? null) ||
      durationSeconds !== initialDuration
    : false;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSaveModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/podcast/episodes/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteModalOpen(false);
        toast.success("Episode deleted.");
        router.push("/admin/episodes");
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
          <div className="mb-6">
            <div className="bg-surface-hover h-4 w-24 animate-pulse rounded" />
          </div>
          <div className="text-foreground mb-2 h-8 w-48 animate-pulse rounded bg-surface-hover" />
          <div className="text-foreground mb-6 h-4 w-64 animate-pulse rounded bg-surface-hover" />
          <Card className="mb-8 p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="bg-surface-hover h-5 w-40 animate-pulse rounded" />
              <div className="bg-surface-hover h-9 w-9 animate-pulse rounded" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-12 animate-pulse rounded" />
                <div className="bg-surface-hover h-10 w-full animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-10 animate-pulse rounded" />
                <div className="bg-surface-hover h-10 w-full animate-pulse rounded-lg font-mono" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-20 animate-pulse rounded" />
                <div className="bg-surface-hover h-20 w-full animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-20 animate-pulse rounded" />
                <div className="bg-surface-hover h-20 w-full animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-12 animate-pulse rounded" />
                <div className="bg-surface-hover h-10 w-32 animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-20 animate-pulse rounded" />
                <div className="bg-surface-hover mb-4 mt-3 h-12 w-full max-w-md animate-pulse rounded" />
                <div className="bg-surface-hover mt-4 flex h-10 w-64 animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-20 animate-pulse rounded" />
                <div className="bg-surface-hover mb-4 mt-3 h-48 w-full animate-pulse rounded" />
                <div className="bg-surface-hover mt-4 flex h-10 w-64 animate-pulse rounded-lg" />
              </div>
              <div>
                <div className="bg-surface-hover mb-2 h-3 w-24 animate-pulse rounded" />
                <div className="bg-surface-hover h-10 w-24 animate-pulse rounded-lg" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <div className="bg-surface-hover h-9 w-16 animate-pulse rounded-md" />
                <div className="bg-surface-hover h-9 w-14 animate-pulse rounded-md" />
              </div>
            </div>
          </Card>
        </div>
      </main>
    );
  }
  if (!episode) {
    return (
      <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-muted text-sm">Episode not found.</p>
          <Link className="text-foreground mt-2 inline-block text-sm underline" href="/admin/episodes">
            Back to Episodes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            className="text-muted hover:text-foreground text-sm"
            href="/admin/episodes"
          >
            ← Episodes
          </Link>
        </div>
        <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          {episode.title}
        </h1>
        <p className="text-foreground mb-6 text-sm" style={labelStyle}>
          Update episode details. Changes appear on the public site when published.
        </p>
        {error && (
          <p className="text-destructive mb-4 text-sm">{error}</p>
        )}
        <Card className="mb-8 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-foreground text-base font-semibold uppercase tracking-wide">
              Episode details
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
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className={labelClass} style={labelStyle}>
              Title *
            </label>
            <input
              className={inputClass}
              placeholder="Please enter a title..."
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Slug
            </label>
            <input
              className={`${inputClass} font-mono`}
              placeholder="Please enter a slug..."
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Description
            </label>
            <textarea
              className={inputClass}
              placeholder="Please enter a description..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Show Notes
            </label>
            <textarea
              className={inputClass}
              placeholder="Please enter show notes..."
              rows={3}
              value={showNotes}
              onChange={(e) => setShowNotes(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Status
            </label>
            <CustomSelect
              ariaLabel="Status"
              className="h-10 w-full"
              options={[
                { label: "Draft", value: "draft" },
                { label: "Published", value: "published" },
              ]}
              value={status}
              onChange={(val) => setStatus(val as "draft" | "published")}
            />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Audio File
            </label>
            {audioDisplayUrl && (
              <div className="mb-4 mt-3">
                <audio className="w-full max-w-md" controls src={audioDisplayUrl} />
              </div>
            )}
            <div className="mt-4 flex items-center gap-3 text-sm">
              <label
                className="border-border bg-surface-hover text-foreground flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 font-medium hover:bg-surface-hover/80"
                htmlFor="edit-ep-audio"
              >
                {uploadingAudio && <Spinner size="sm" />}
                Choose File
              </label>
              <span className="text-foreground">
                {audioStoragePath ? audioStoragePath : "No file chosen."}
              </span>
              {(audioStoragePath || audioDisplayUrl) && (
                <span className="inline-flex items-center gap-1">
                  {audioDisplayUrl && (
                    <a
                      aria-label="Preview audio in new tab"
                      className="text-muted hover:text-foreground"
                      href={audioDisplayUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    aria-label="Remove audio file"
                    className="text-muted hover:text-destructive p-0.5 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1 focus:ring-offset-surface"
                    type="button"
                    onClick={() => {
                      setAudioStoragePath("");
                      setAudioDisplayUrl(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              )}
              <input
                accept="audio/*"
                className="sr-only"
                disabled={uploadingAudio}
                id="edit-ep-audio"
                type="file"
                onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingAudio(true);
                try {
                  const form = new FormData();
                  form.set("file", file);
                  form.set("type", "audio");
                  const res = await fetch("/api/admin/podcast/upload", {
                    body: form,
                    method: "POST",
                  });
                  const j = await res.json().catch(() => ({}));
                  if (res.ok && j.data?.path) {
                    setAudioStoragePath(j.data.path);
                    if (j.data.previewUrl) setAudioDisplayUrl(j.data.previewUrl);
                  } else {
                    setError(j.error ?? "Upload failed");
                  }
                } finally {
                  setUploadingAudio(false);
                  e.target.value = "";
                }
              }}
              />
            </div>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Image File
            </label>
            {imageDisplayUrl && (
              <div className="relative mb-4 mt-3 h-48 w-full">
                <Image
                  alt="Episode"
                  className="rounded object-left object-contain"
                  fill
                  src={imageDisplayUrl}
                  unoptimized
                />
              </div>
            )}
            <div className="mt-4 flex items-center gap-3 text-sm">
              <label
                className="border-border bg-surface-hover text-foreground flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 font-medium hover:bg-surface-hover/80"
                htmlFor="edit-ep-image"
              >
                {uploadingImage && <Spinner size="sm" />}
                Choose File
              </label>
              <span className="text-foreground">
                {imageStoragePath ? imageStoragePath : "No file chosen."}
              </span>
              {(imageStoragePath || imageDisplayUrl) && (
                <span className="inline-flex items-center gap-1">
                  {imageDisplayUrl && (
                    <a
                      aria-label="Preview image in new tab"
                      className="text-muted hover:text-foreground"
                      href={imageDisplayUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    aria-label="Remove image file"
                    className="text-muted hover:text-destructive p-0.5 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1 focus:ring-offset-surface"
                    type="button"
                    onClick={() => {
                      setImageStoragePath("");
                      setImageDisplayUrl(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              )}
              <input
                accept="image/*"
                className="sr-only"
                disabled={uploadingImage}
                id="edit-ep-image"
                type="file"
                onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingImage(true);
                try {
                  const form = new FormData();
                  form.set("file", file);
                  form.set("type", "image");
                  const res = await fetch("/api/admin/podcast/upload", {
                    body: form,
                    method: "POST",
                  });
                  const j = await res.json().catch(() => ({}));
                  if (res.ok && j.data?.path) {
                    setImageStoragePath(j.data.path);
                    if (j.data.previewUrl) setImageDisplayUrl(j.data.previewUrl);
                  } else {
                    setError(j.error ?? "Upload failed");
                  }
                } finally {
                  setUploadingImage(false);
                  e.target.value = "";
                }
              }}
              />
            </div>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>
              Duration (Seconds)
            </label>
            <input
              className={inputClass}
              placeholder="Please enter a duration..."
              type="number"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
            <Link href="/admin/episodes">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button
              disabled={!dirty || submitting}
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
          message="Are you sure you want to delete this episode? This cannot be undone."
          open={deleteModalOpen}
          title="Delete Episode"
          onCancel={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteConfirm}
        />
        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Save"
          confirmLoading={submitting}
          message="Are you sure you want to save changes to this episode?"
          open={saveModalOpen}
          title="Save Changes"
          onCancel={() => setSaveModalOpen(false)}
          onConfirm={handleSaveConfirm}
        />
      </div>
    </main>
  );
}
