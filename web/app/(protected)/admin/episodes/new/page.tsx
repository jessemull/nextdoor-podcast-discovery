"use client";

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

export default function NewEpisodePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [audioStoragePath, setAudioStoragePath] = useState("");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [imageStoragePath, setImageStoragePath] = useState("");
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState("");
  const [showNotes, setShowNotes] = useState("");
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const handleSaveConfirm = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/podcast/episodes", {
        body: JSON.stringify({
          audio_storage_path: audioStoragePath || null,
          description: description || null,
          duration_seconds: durationSeconds
            ? parseInt(durationSeconds, 10)
            : null,
          image_storage_path: imageStoragePath || null,
          show_notes: showNotes || null,
          slug: title.trim().toLowerCase().replace(/\s+/g, "-"),
          status,
          title,
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
    audioStoragePath,
    description,
    durationSeconds,
    imageStoragePath,
    showNotes,
    status,
    title,
    router,
    toast,
  ]);

  const dirty =
    title.trim() !== "" ||
    description.trim() !== "" ||
    showNotes.trim() !== "" ||
    status !== "draft" ||
    audioStoragePath !== "" ||
    imageStoragePath !== "" ||
    durationSeconds.trim() !== "";

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSaveModalOpen(true);
  }, []);

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
            <div className="mt-2 flex items-center gap-3 text-sm">
              <label
                className="border-border bg-muted text-foreground flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 font-medium"
                htmlFor="new-ep-audio"
              >
                {uploadingAudio && <Spinner size="sm" />}
                Choose File
              </label>
              <span className="text-foreground">
                {audioStoragePath ? audioStoragePath : "No file chosen."}
              </span>
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
            {audioStoragePath && (
              <p className="text-muted mt-1 text-xs">
                Uploaded: {audioStoragePath}
                {audioPreviewUrl && (
                  <span className="ml-2">
                    — <a href={audioPreviewUrl} rel="noopener noreferrer" target="_blank">Preview</a>
                  </span>
                )}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="new-ep-image" style={labelStyle}>
              Image File
            </label>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <label
                className="border-border bg-muted text-foreground flex cursor-pointer items-center gap-2 rounded px-3 py-1.5 font-medium"
                htmlFor="new-ep-image"
              >
                {uploadingImage && <Spinner size="sm" />}
                Choose File
              </label>
              <span className="text-foreground">
                {imageStoragePath ? imageStoragePath : "No file chosen."}
              </span>
              <input
                accept="image/*"
                className="sr-only"
                disabled={uploadingImage}
                id="new-ep-image"
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
                    if (j.data.previewUrl) setImagePreviewUrl(j.data.previewUrl);
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
            {imageStoragePath && (
              <p className="text-muted mt-1 text-xs">
                Uploaded: {imageStoragePath}
                {imagePreviewUrl && (
                  <span className="ml-2">
                    — <a href={imagePreviewUrl} rel="noopener noreferrer" target="_blank">Preview</a>
                  </span>
                )}
              </p>
            )}
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
