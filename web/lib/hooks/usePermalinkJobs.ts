"use client";

import { useCallback, useEffect, useState } from "react";

import { authFetch } from "@/lib/authFetch.client";

import type { Job } from "@/lib/types";

const PERMALINK_JOBS_LIMIT = 50;
const POLL_INTERVAL_MS = 8000;

interface JobsResponse {
  data: Job[];
  total: number;
}

interface PostForQueueStatus {
  id: string;
  url: null | string;
}

export type QueueStatus = "pending" | "running" | null;

function fetchPermalinkJobs(): Promise<Job[]> {
  return authFetch(
    `/api/admin/jobs?type=fetch_permalink&limit=${PERMALINK_JOBS_LIMIT}`,
    { cache: "no-store" }
  )
    .then((res) => (res.ok ? res.json() : { data: [] }))
    .then((body: JobsResponse) => body.data ?? []);
}

export type ActiveJobForPost = {
  id: string;
  status: "pending" | "running";
};

/**
 * Returns the matching active job for a post (same match as status).
 * Only returns real jobs (id does not start with "opt-"); optimistic jobs cannot be cancelled.
 */
function getActiveJobForPostFromJobs(
  post: PostForQueueStatus,
  jobs: Job[]
): ActiveJobForPost | null {
  const active = jobs.filter(
    (j) =>
      !j.id.startsWith("opt-") &&
      (j.status === "pending" || j.status === "running") &&
      ((j.params as { post_id?: string })?.post_id === post.id ||
        (j.params as { url?: string })?.url === post.url)
  );
  if (active.length === 0) return null;
  const byCreated = [...active].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const job = byCreated[0];
  return {
    id: job.id,
    status: job.status === "running" ? "running" : "pending",
  };
}

/**
 * Returns the queue status for a post by matching permalink jobs.
 */
function getQueueStatusForPostFromJobs(
  post: PostForQueueStatus,
  jobs: Job[]
): QueueStatus {
  const activeJob = getActiveJobForPostFromJobs(post, jobs);
  return activeJob?.status ?? null;
}

export function usePermalinkJobs() {
  const [permalinkJobs, setPermalinkJobs] = useState<Job[]>([]);

  const refetch = useCallback((): Promise<Job[]> => {
    return fetchPermalinkJobs().then((jobs) => {
      setPermalinkJobs(jobs);
      return jobs;
    });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const hasActive = permalinkJobs.some(
    (j) => j.status === "pending" || j.status === "running"
  );

  useEffect(() => {
    if (!hasActive) return;
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasActive, refetch]);

  const getQueueStatusForPost = useCallback(
    (post: PostForQueueStatus): QueueStatus =>
      getQueueStatusForPostFromJobs(post, permalinkJobs),
    [permalinkJobs]
  );

  const getActiveJobForPost = useCallback(
    (post: PostForQueueStatus): ActiveJobForPost | null =>
      getActiveJobForPostFromJobs(post, permalinkJobs),
    [permalinkJobs]
  );

  return {
    getActiveJobForPost,
    getQueueStatusForPost,
    permalinkJobs,
    refetch,
  };
}
