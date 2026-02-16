"use client";

import { useCallback, useEffect, useState } from "react";

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
  return fetch(
    `/api/admin/jobs?type=fetch_permalink&limit=${PERMALINK_JOBS_LIMIT}`
  )
    .then((res) => (res.ok ? res.json() : { data: [] }))
    .then((body: JobsResponse) => body.data ?? []);
}

/**
 * Returns the queue status for a post by matching permalink jobs:
 * - job.params.post_id === post.id, or
 * - job.params.url === post.url
 * Uses the most recent matching job that is pending or running.
 */
function getQueueStatusForPostFromJobs(
  post: PostForQueueStatus,
  jobs: Job[]
): QueueStatus {
  const active = jobs.filter(
    (j) =>
      (j.status === "pending" || j.status === "running") &&
      ((j.params as { post_id?: string })?.post_id === post.id ||
        (j.params as { url?: string })?.url === post.url)
  );
  if (active.length === 0) return null;
  const byCreated = [...active].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return byCreated[0].status === "running" ? "running" : "pending";
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

  return {
    getQueueStatusForPost,
    permalinkJobs,
    refetch,
  };
}
