import Link from "next/link";

import { PostDetailClient } from "@/components/PostDetailClient";
import { getPostById } from "@/lib/posts.server";
import { UUID_REGEX } from "@/lib/validators";

interface PostDetailPageProps {
  params: { id: string };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const id = params.id;

  if (!UUID_REGEX.test(id)) {
    return (
      <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-6">
            <p className="text-red-400">Invalid post ID format</p>
            <Link className="mt-4 inline-block text-blue-400 hover:text-blue-300" href="/">
              Back to Feed
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const initialPost = await getPostById(id);

  if (!initialPost) {
    return (
      <main className="h-full overflow-auto px-6 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-lg border border-red-800 bg-red-900/20 p-6">
            <p className="text-red-400">Post not found</p>
            <Link className="mt-4 inline-block text-blue-400 hover:text-blue-300" href="/">
              Back to Feed
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <PostDetailClient initialPost={initialPost} postId={id} />;
}
