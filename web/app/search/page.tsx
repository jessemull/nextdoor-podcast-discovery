/**
 * Search Page - Semantic search for posts
 *
 * Features to implement:
 * - Search input with debouncing (use useDeferredValue or custom hook)
 * - Call Supabase RPC function for vector similarity search
 * - Display results as PostCard components
 * - Show loading state and empty state
 */

export default function SearchPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Search Posts</h1>
        <p className="text-gray-400 mb-8">
          Find similar posts using semantic search.
        </p>

        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-300">🚧 Search coming soon...</p>
          <p className="text-sm text-gray-500 mt-2">
            This will use vector embeddings to find semantically similar posts.
          </p>
        </div>
      </div>
    </main>
  );
}
