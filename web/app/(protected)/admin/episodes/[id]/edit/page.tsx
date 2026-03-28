"use client";

import { ChevronDown, ChevronUp, Eye, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Spinner } from "@/components/ui/Spinner";
import {
  adminFormInputClass as inputClass,
  adminFormLabelClass as labelClass,
} from "@/lib/admin-form-classes";
import { useToast } from "@/lib/ToastContext";

const labelStyle = { opacity: 0.85 };

interface Episode {
  about_episode: string | null;
  audio_storage_path: string | null;
  audio_url: string | null;
  description: string | null;
  duration_seconds: number | null;
  episode_images?: EpisodeImageRowApi[];
  id: string;
  image_description: string | null;
  image_storage_path: string | null;
  image_url: string | null;
  order_index: number;
  published_at: string | null;
  show_notes: string | null;
  slug: string;
  status: string;
  title: string;
  transcript: string | null;
}

interface EpisodeImageRowApi {
  created_at?: string;
  description: string | null;
  id: string;
  image_storage_path: string | null;
  image_url: string | null;
  sort_order?: number;
}

interface ImageRow {
  description: string;
  image_storage_path: string | null;
  image_url: string | null;
  previewUrl: string | null;
  key: string;
}

function imagesPayload(rows: ImageRow[]) {
  return rows.map((r) => ({
    description: r.description.trim() || null,
    image_storage_path: r.image_storage_path,
    image_url: r.image_url,
  }));
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
  const [aboutEpisode, setAboutEpisode] = useState("");
  const [description, setDescription] = useState("");
  const [showNotes, setShowNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [publishedAt, setPublishedAt] = useState("");
  const [audioStoragePath, setAudioStoragePath] = useState("");
  const [audioDisplayUrl, setAudioDisplayUrl] = useState<string | null>(null);
  const [imageRows, setImageRows] = useState<ImageRow[]>([]);
  const [durationSeconds, setDurationSeconds] = useState("");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
    null
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [imageRemoveKey, setImageRemoveKey] = useState<string | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const initialImagesJsonRef = useRef("");

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
          setAboutEpisode(data.about_episode ?? "");
          setDescription(data.description ?? "");
          setShowNotes(data.show_notes ?? "");
          setStatus(
            data.status === "published" ? "published" : "draft"
          );
          setPublishedAt(toDatetimeLocal(data.published_at));
          setAudioStoragePath(data.audio_storage_path ?? "");
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

          let apiRows = (data.episode_images ?? []) as EpisodeImageRowApi[];
          if (
            apiRows.length === 0 &&
            (data.image_storage_path || data.image_url)
          ) {
            apiRows = [
              {
                description: data.image_description,
                id: `legacy-${data.id}`,
                image_storage_path: data.image_storage_path,
                image_url: data.image_url,
              },
            ];
          }

          const builtRows: ImageRow[] = await Promise.all(
            apiRows.map(async (img) => {
              let previewUrl: string | null = img.image_url;
              if (!previewUrl && img.image_storage_path) {
                const ir = await fetch(
                  `/api/admin/podcast/episodes/${id}/signed-url?type=image&path=${encodeURIComponent(img.image_storage_path)}`
                );
                const ij = await ir.json().catch(() => ({}));
                if (ir.ok && ij.url) previewUrl = ij.url;
              }
              return {
                description: img.description ?? "",
                image_storage_path: img.image_storage_path,
                image_url: img.image_url,
                key: img.id,
                previewUrl,
              };
            })
          );
          setImageRows(builtRows);
          initialImagesJsonRef.current = JSON.stringify(
            imagesPayload(builtRows)
          );
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
          about_episode: aboutEpisode.trim() || null,
          audio_storage_path: audioStoragePath || null,
          description: description || null,
          duration_seconds: durationSeconds
            ? parseInt(durationSeconds, 10)
            : null,
          episode_images: imagesPayload(imageRows),
          show_notes: showNotes || null,
          slug: slug || title.toLowerCase().replace(/\s+/g, "-"),
          status,
          title,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
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
    aboutEpisode,
    audioStoragePath,
    description,
    durationSeconds,
    id,
    imageRows,
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
  const imagesDirty =
    JSON.stringify(imagesPayload(imageRows)) !== initialImagesJsonRef.current;

  const dirty = episode
    ? title.trim() !== (episode.title ?? "").trim() ||
      (slug || title.toLowerCase().replace(/\s+/g, "-")) !==
        (episode.slug ?? "").toLowerCase().replace(/\s+/g, "-") ||
      (aboutEpisode.trim() || null) !== (episode.about_episode ?? null) ||
      (description || null) !== (episode.description ?? null) ||
      (showNotes || null) !== (episode.show_notes ?? null) ||
      status !== (episode.status === "published" ? "published" : "draft") ||
      (audioStoragePath || null) !== (episode.audio_storage_path ?? null) ||
      durationSeconds !== initialDuration ||
      imagesDirty
    : false;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSaveModalOpen(true);
  }, []);

  const uploadImageFile = useCallback(
    async (file: File, targetKey: string | "new") => {
      setUploadingImageKey(targetKey === "new" ? "__new__" : targetKey);
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
          const previewUrl =
            typeof j.data.previewUrl === "string" ? j.data.previewUrl : null;
          if (targetKey === "new") {
            setImageRows((prev) => [
              ...prev,
              {
                description: "",
                image_storage_path: j.data.path,
                image_url: null,
                key: crypto.randomUUID(),
                previewUrl,
              },
            ]);
          } else {
            setImageRows((prev) =>
              prev.map((row) =>
                row.key === targetKey
                  ? {
                      ...row,
                      image_storage_path: j.data.path,
                      image_url: null,
                      previewUrl,
                    }
                  : row
              )
            );
          }
        } else {
          setError(j.error ?? "Upload failed");
        }
      } finally {
        setUploadingImageKey(null);
      }
    },
    []
  );

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

  const handleImageRemoveConfirm = useCallback(() => {
    if (!imageRemoveKey) return;
    setImageRows((prev) => prev.filter((r) => r.key !== imageRemoveKey));
    setImageRemoveKey(null);
  }, [imageRemoveKey]);

  if (loading) {
    return (
      <main className="px-6 py-6 sm:px-8 sm:py-8">
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
      <main className="px-6 py-6 sm:px-8 sm:py-8">
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
    <main className="px-6 py-6 sm:px-8 sm:py-8">
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
        <Card className="mb-8 p-6 font-sans text-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
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
            <label className={labelClass} htmlFor="edit-ep-about" style={labelStyle}>
              About the Episode
            </label>
            <textarea
              className={inputClass}
              id="edit-ep-about"
              placeholder="Optional. Separate paragraphs with a blank line."
              rows={5}
              value={aboutEpisode}
              onChange={(e) => setAboutEpisode(e.target.value)}
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
              className="h-10 w-full font-sans text-xs"
              options={[
                { label: "Draft", value: "draft" },
                { label: "Published", value: "published" },
              ]}
              value={status}
              onChange={(val) => setStatus(val as "draft" | "published")}
            />
          </div>
          <div>
            <p className={labelClass} style={labelStyle}>
              Episode audio
            </p>
            <p className="text-muted mb-3 text-xs">
              Upload the episode recording. You can replace or remove it from the card below.
            </p>
            <div className="space-y-4">
              <div className="border-border min-w-0 space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-foreground font-sans text-xs font-medium uppercase"
                    style={labelStyle}
                  >
                    Audio
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {audioDisplayUrl && (
                      <a
                        aria-label="Preview audio in new tab"
                        className="text-muted hover:text-foreground p-1"
                        href={audioDisplayUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                    {(audioStoragePath || audioDisplayUrl) && (
                      <button
                        aria-label="Remove audio file"
                        className="text-muted hover:text-destructive p-1 focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1 focus:ring-offset-surface"
                        type="button"
                        onClick={() => {
                          setAudioStoragePath("");
                          setAudioDisplayUrl(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {audioDisplayUrl ? (
                  <div className="rounded-md bg-surface-hover p-3">
                    <audio
                      className="w-full max-w-full"
                      controls
                      src={audioDisplayUrl}
                    />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-md bg-surface-hover text-muted text-xs">
                    No file chosen.
                  </div>
                )}
                <div>
                  <p className={labelClass} style={labelStyle}>
                    File Name
                  </p>
                  <span
                    className="text-foreground block min-w-0 truncate text-xs"
                    title={audioStoragePath ? audioStoragePath : undefined}
                  >
                    {audioStoragePath
                      ? audioStoragePath
                      : "No storage path yet."}
                  </span>
                </div>
                <label
                  className="border-border bg-surface-hover text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-surface-hover/80"
                  htmlFor="edit-ep-audio"
                >
                  {uploadingAudio && <Spinner size="sm" />}
                  {audioStoragePath || audioDisplayUrl
                    ? "Replace file"
                    : "Choose file"}
                </label>
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
          </div>
          <div>
            <p className={labelClass} style={labelStyle}>
              Episode images
            </p>
            <p className="text-muted mb-3 text-xs">
              The first image is used for listings and RSS. Drag order with the arrows.
            </p>
            <div className="space-y-4">
              {imageRows.map((row, index) => (
                <div
                  key={row.key}
                  className="border-border min-w-0 space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className="text-foreground font-sans text-xs font-medium uppercase"
                      style={labelStyle}
                    >
                      Image #{index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Move image up"
                        className="text-muted hover:text-foreground p-1 disabled:opacity-30"
                        disabled={index === 0}
                        type="button"
                        onClick={() => {
                          setImageRows((prev) => {
                            const next = [...prev];
                            [next[index - 1], next[index]] = [
                              next[index],
                              next[index - 1],
                            ];
                            return next;
                          });
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Move image down"
                        className="text-muted hover:text-foreground p-1 disabled:opacity-30"
                        disabled={index === imageRows.length - 1}
                        type="button"
                        onClick={() => {
                          setImageRows((prev) => {
                            const next = [...prev];
                            [next[index], next[index + 1]] = [
                              next[index + 1],
                              next[index],
                            ];
                            return next;
                          });
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      {row.previewUrl && (
                        <a
                          aria-label="Preview image in new tab"
                          className="text-muted hover:text-foreground p-1"
                          href={row.previewUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        aria-label="Remove image"
                        className="text-muted hover:text-destructive p-1"
                        type="button"
                        onClick={() => setImageRemoveKey(row.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {row.previewUrl && (
                    <a
                      aria-label="Preview image in new tab"
                      className="relative block h-40 w-full overflow-hidden rounded-md bg-surface-hover"
                      href={row.previewUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt=""
                        className="h-full w-full object-contain object-left"
                        src={row.previewUrl}
                      />
                    </a>
                  )}
                  <div>
                    <p className={labelClass} style={labelStyle}>
                      File Name
                    </p>
                    <span
                      className="text-foreground block min-w-0 truncate text-xs"
                      title={
                        row.image_storage_path ?? row.image_url ?? undefined
                      }
                    >
                      {row.image_storage_path ?? row.image_url ?? "No file"}
                    </span>
                  </div>
                  <label
                    className="border-border bg-surface-hover text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-surface-hover/80"
                    htmlFor={`edit-ep-image-${row.key}`}
                  >
                    {uploadingImageKey === row.key && <Spinner size="sm" />}
                    Replace file
                  </label>
                  <input
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingImageKey !== null}
                    id={`edit-ep-image-${row.key}`}
                    type="file"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await uploadImageFile(file, row.key);
                      e.target.value = "";
                    }}
                  />
                  <div>
                    <label
                      className={labelClass}
                      htmlFor={`edit-ep-img-desc-${row.key}`}
                      style={labelStyle}
                    >
                      Description
                    </label>
                    <textarea
                      className={inputClass}
                      id={`edit-ep-img-desc-${row.key}`}
                      placeholder="Caption or alt text..."
                      rows={2}
                      value={row.description}
                      onChange={(e) => {
                        const v = e.target.value;
                        setImageRows((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, description: v } : r
                          )
                        );
                      }}
                    />
                  </div>
                </div>
              ))}
              <label
                className="border-border bg-surface-hover text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium hover:bg-surface-hover/80"
                htmlFor="edit-ep-image-add"
              >
                {uploadingImageKey === "__new__" && <Spinner size="sm" />}
                <Plus className="h-4 w-4" />
                Add image
              </label>
              <input
                accept="image/*"
                className="sr-only"
                disabled={uploadingImageKey !== null}
                id="edit-ep-image-add"
                type="file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadImageFile(file, "new");
                  e.target.value = "";
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
          confirmLabel="Remove"
          message="Are you sure you want to remove this image from the episode?"
          open={imageRemoveKey !== null}
          title="Remove Image"
          onCancel={() => setImageRemoveKey(null)}
          onConfirm={handleImageRemoveConfirm}
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
