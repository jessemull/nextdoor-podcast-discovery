"use client";

import { ChevronDown, ChevronUp, Eye, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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

export default function NewEpisodePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [aboutEpisode, setAboutEpisode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [audioStoragePath, setAudioStoragePath] = useState("");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [imageRows, setImageRows] = useState<ImageRow[]>([]);
  const [durationSeconds, setDurationSeconds] = useState("");
  const [showNotes, setShowNotes] = useState("");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
    null
  );
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const handleSaveConfirm = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/podcast/episodes", {
        body: JSON.stringify({
          about_episode: aboutEpisode.trim() || null,
          audio_storage_path: audioStoragePath || null,
          description: description || null,
          duration_seconds: durationSeconds
            ? parseInt(durationSeconds, 10)
            : null,
          episode_images: imagesPayload(imageRows),
          show_notes: showNotes || null,
          slug: title.trim().toLowerCase().replace(/\s+/g, "-"),
          status,
          title,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
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
      toast.success("Episode created.");
      router.push("/admin/episodes");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
      setError(msg);
      toast.error(msg);
      setSaveModalOpen(false);
      setSubmitting(false);
    }
  }, [
    aboutEpisode,
    audioStoragePath,
    description,
    durationSeconds,
    imageRows,
    showNotes,
    status,
    title,
    router,
    toast,
  ]);

  const dirty =
    title.trim() !== "" ||
    aboutEpisode.trim() !== "" ||
    description.trim() !== "" ||
    showNotes.trim() !== "" ||
    status !== "draft" ||
    audioStoragePath !== "" ||
    imageRows.length > 0 ||
    durationSeconds.trim() !== "";

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSaveModalOpen(true);
  }, []);

  const uploadImageFile = useCallback(
    async (file: File, targetKey: string | "new") => {
      setUploadingImageKey(
        targetKey === "new" ? "__new__" : targetKey
      );
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

  return (
    <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center gap-4">
          <Link
            className="text-muted hover:text-foreground text-sm"
            href="/admin/episodes"
          >
            ← Episodes
          </Link>
        </div>
        <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-wide">
          New Episode
        </h1>
        <p className="text-foreground mb-6 text-sm" style={labelStyle}>
          Add a new podcast episode.
        </p>
        {error && (
          <p className="text-destructive mb-4 text-sm">{error}</p>
        )}
        <Card className="mb-8 p-6">
        <h2 className="text-foreground mb-4 text-base font-semibold uppercase tracking-wide">
          Episode details
        </h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className={labelClass} htmlFor="new-ep-title" style={labelStyle}>
              Title *
            </label>
            <input
              className={inputClass}
              id="new-ep-title"
              placeholder="Please enter a title..."
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-ep-desc" style={labelStyle}>
              Description
            </label>
            <textarea
              className={inputClass}
              id="new-ep-desc"
              placeholder="Please enter a description..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-ep-about" style={labelStyle}>
              About the Episode
            </label>
            <textarea
              className={inputClass}
              id="new-ep-about"
              placeholder="Optional. Separate paragraphs with a blank line."
              rows={5}
              value={aboutEpisode}
              onChange={(e) => setAboutEpisode(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-ep-notes" style={labelStyle}>
              Show Notes
            </label>
            <textarea
              className={inputClass}
              id="new-ep-notes"
              placeholder="Please enter show notes..."
              rows={3}
              value={showNotes}
              onChange={(e) => setShowNotes(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="new-ep-status" style={labelStyle}>
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
            <label className={labelClass} htmlFor="new-ep-audio" style={labelStyle}>
              Audio File
            </label>
            <div className="mt-2 flex flex-col gap-2 text-sm md:flex-row md:items-center md:gap-3">
              <div className="order-1 flex min-w-0 items-center gap-2 md:order-2 md:flex-initial">
                <span className="text-foreground min-w-0 flex-1 truncate md:max-w-md md:flex-none">
                  {audioStoragePath ? audioStoragePath : "No file chosen."}
                </span>
                {(audioStoragePath || audioPreviewUrl) && (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    {audioPreviewUrl && (
                      <a
                        aria-label="Preview audio in new tab"
                        className="text-muted hover:text-foreground"
                        href={audioPreviewUrl}
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
                        setAudioPreviewUrl(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                )}
              </div>
              <label
                className="border-border bg-surface-hover text-foreground order-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2 font-medium hover:bg-surface-hover/80 md:order-1 md:w-auto"
                htmlFor="new-ep-audio"
              >
                {uploadingAudio && <Spinner size="sm" />}
                Choose File
              </label>
              <input
                accept="audio/*"
                className="sr-only"
                disabled={uploadingAudio}
                id="new-ep-audio"
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
                    if (j.data.previewUrl) setAudioPreviewUrl(j.data.previewUrl);
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
            <p className={labelClass} style={labelStyle}>
              Episode images
            </p>
            <p className="text-muted mb-3 text-xs">
              Add one or more images. The first image is used for listings and RSS.
            </p>
            <div className="space-y-4">
              {imageRows.map((row, index) => (
                <div
                  key={row.key}
                  className="border-border space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-foreground text-sm font-medium">
                      Image {index + 1}
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
                      <button
                        aria-label="Remove image"
                        className="text-muted hover:text-destructive p-1"
                        type="button"
                        onClick={() => {
                          setImageRows((prev) =>
                            prev.filter((r) => r.key !== row.key)
                          );
                        }}
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
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="text-foreground truncate">
                      {row.image_storage_path ?? row.image_url ?? "No file"}
                    </span>
                    {row.previewUrl && (
                      <a
                        aria-label="Open image preview"
                        className="text-muted shrink-0 hover:text-foreground"
                        href={row.previewUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <label
                    className="border-border bg-surface-hover text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-surface-hover/80"
                    htmlFor={`new-ep-image-${row.key}`}
                  >
                    {uploadingImageKey === row.key && <Spinner size="sm" />}
                    Replace file
                  </label>
                  <input
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingImageKey !== null}
                    id={`new-ep-image-${row.key}`}
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
                      className="text-foreground mb-1 block text-xs font-medium uppercase"
                      htmlFor={`new-ep-img-desc-${row.key}`}
                      style={labelStyle}
                    >
                      Description
                    </label>
                    <textarea
                      className={inputClass}
                      id={`new-ep-img-desc-${row.key}`}
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
                className="border-border bg-surface-hover text-foreground inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-surface-hover/80"
                htmlFor="new-ep-image-add"
              >
                {uploadingImageKey === "__new__" && <Spinner size="sm" />}
                <Plus className="h-4 w-4" />
                Add image
              </label>
              <input
                accept="image/*"
                className="sr-only"
                disabled={uploadingImageKey !== null}
                id="new-ep-image-add"
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
            <label className={labelClass} htmlFor="new-ep-duration" style={labelStyle}>
              Duration (Seconds)
            </label>
            <input
              className={inputClass}
              id="new-ep-duration"
              placeholder="Please enter a duration..."
              type="number"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
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
              Create
            </Button>
          </div>
        </form>
        </Card>
        <ConfirmModal
          cancelLabel="Cancel"
          confirmLabel="Create"
          confirmLoading={submitting}
          message="Are you sure you want to create this episode?"
          open={saveModalOpen}
          title="Create Episode"
          onCancel={() => setSaveModalOpen(false)}
          onConfirm={handleSaveConfirm}
        />
      </div>
    </main>
  );
}
