"use client";

import {
  AudioLines,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatDuration } from "@/lib/format-duration";

const SKIP_SECONDS = 15;

const skipIconClass =
  "inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-[8px] text-podcast-foreground/85 transition-colors hover:bg-white/10 hover:text-podcast-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-podcast-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]";

const playButtonClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2a2a2a] text-white transition-colors hover:bg-[#363636] focus:outline-none focus-visible:ring-2 focus-visible:ring-podcast-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]";

const volumeRangeClass =
  "podcast-volume-slider h-[10px] w-10 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-podcast-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212] sm:w-14";

export interface PodcastAudioPlayerProps {
  className?: string;
  durationSeconds?: null | number;
  src: string;
}

export function PodcastAudioPlayer({
  className = "",
  durationSeconds = null,
  src,
}: PodcastAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(1);

  const effectiveDuration =
    duration > 0 && Number.isFinite(duration)
      ? duration
      : durationSeconds != null && durationSeconds > 0
        ? durationSeconds
        : 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [muted, volume]);

  const togglePlay = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        setPlaying(false);
      }
    } else {
      el.pause();
    }
  }, []);

  const skip = useCallback((delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    const d =
      el.duration > 0 && Number.isFinite(el.duration) ? el.duration : 0;
    const t = el.currentTime + delta;
    const next = d > 0 ? Math.min(Math.max(0, t), d) : Math.max(0, t);
    el.currentTime = next;
    setCurrentTime(next);
  }, []);

  const onLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const d = el.duration;
    if (Number.isFinite(d) && d > 0) {
      setDuration(d);
    }
  }, []);

  const onTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
  }, []);

  const onPlay = useCallback(() => setPlaying(true), []);
  const onPause = useCallback(() => setPlaying(false), []);

  const onEnded = useCallback(() => {
    setPlaying(false);
    const el = audioRef.current;
    if (el) {
      el.currentTime = 0;
      setCurrentTime(0);
    }
  }, []);

  const onSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = audioRef.current;
      if (!el) return;
      const v = Number(e.target.value);
      el.currentTime = v;
      setCurrentTime(v);
    },
    []
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const onVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setVolume(v);
      if (v > 0) setMuted(false);
    },
    []
  );

  const scrubMax =
    effectiveDuration > 0 ? effectiveDuration : Math.max(currentTime, 1);
  const timeLabelCurrent = formatDuration(Math.floor(currentTime));
  const timeLabelTotal = formatDuration(
    Math.floor(effectiveDuration > 0 ? effectiveDuration : 0)
  );
  const progressPct =
    scrubMax > 0 ? Math.min(100, (Math.min(currentTime, scrubMax) / scrubMax) * 100) : 0;
  const volumePct = muted ? 0 : volume * 100;

  return (
    <div
      aria-label="Episode audio player"
      className={`flex flex-col rounded-[25px] border border-podcast-accent bg-[#121212] px-4 pb-3 pt-2 shadow-sm sm:px-6 sm:pb-3.5 sm:pt-2.5 ${className}`}
      role="group"
    >
      <audio
        className="hidden"
        preload="metadata"
        ref={audioRef}
        src={src}
        onEnded={onEnded}
        onLoadedMetadata={onLoadedMetadata}
        onPause={onPause}
        onPlay={onPlay}
        onTimeUpdate={onTimeUpdate}
      >
        Your browser does not support the audio element.
      </audio>

      {/* Top row: waveform left; mute + volume slider right */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div aria-hidden className="opacity-90 shrink-0 text-podcast-accent">
          <AudioLines className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={2} />
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5">
          <button
            aria-label={muted ? "Unmute" : "Mute"}
            className="text-podcast-foreground/90 inline-flex min-h-8 min-w-6 shrink-0 items-center justify-start rounded-[8px] px-0 transition-colors hover:text-podcast-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-podcast-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]"
            type="button"
            onClick={toggleMute}
          >
            {muted || volume === 0 ? (
              <VolumeX aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <Volume2 aria-hidden className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            aria-label="Volume"
            className={volumeRangeClass}
            max={1}
            min={0}
            step={0.05}
            style={{
              backgroundImage: `linear-gradient(to right, var(--podcast-accent) 0%, var(--podcast-accent) ${volumePct}%, #3a3a3a ${volumePct}%, #3a3a3a 100%)`,
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "100% 3px",
            }}
            type="range"
            value={muted ? 0 : volume}
            onChange={onVolumeChange}
          />
        </div>
      </div>

      {/* Seek bar */}
      <div className="mt-3">
        <div className="relative h-2 w-full">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#3a3a3a]" />
          <div
            aria-hidden
            className="bg-podcast-accent absolute left-0 top-1/2 h-1.5 max-w-full -translate-y-1/2 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
          <div
            aria-hidden
            className="bg-podcast-accent pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_12px_rgba(238,207,62,0.7)]"
            style={{ left: `${progressPct}%` }}
          />
          <input
            aria-label="Seek audio position"
            className="absolute inset-0 top-1/2 h-6 w-full -translate-y-1/2 cursor-pointer opacity-0"
            disabled={effectiveDuration <= 0 && currentTime <= 0}
            max={scrubMax}
            min={0}
            step={0.1}
            type="range"
            value={Math.min(currentTime, scrubMax)}
            onChange={onSeekChange}
          />
        </div>
      </div>

      <div className="text-podcast-muted mt-1.5 flex justify-between font-sans text-xs tabular-nums sm:text-sm">
        <span>{timeLabelCurrent}</span>
        <span>{timeLabelTotal || "—:—"}</span>
      </div>

      {/* Bottom row: centered transport controls */}
      <div className="-mt-4 flex items-center justify-center gap-1.5 sm:gap-2">
        <button
          aria-label={`Rewind ${SKIP_SECONDS} seconds`}
          className={skipIconClass}
          type="button"
          onClick={() => skip(-SKIP_SECONDS)}
        >
          <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          aria-label={playing ? "Pause" : "Play"}
          className={playButtonClass}
          type="button"
          onClick={() => void togglePlay()}
        >
          {playing ? (
            <Pause aria-hidden className="h-4 w-4" />
          ) : (
            <Play aria-hidden className="ml-0.5 h-4 w-4" />
          )}
        </button>
        <button
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
          className={skipIconClass}
          type="button"
          onClick={() => skip(SKIP_SECONDS)}
        >
          <RotateCw aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
