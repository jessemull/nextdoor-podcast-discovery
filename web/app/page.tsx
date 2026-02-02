export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">
          Nextdoor Podcast Discovery
        </h1>
        <p className="text-lg text-gray-400 mb-8">
          Discover and curate interesting Nextdoor posts for your podcast.
        </p>
        
        {/* TODO: Add SportsFact component for Matt */}
        {/* TODO: Add PostFeed component */}
        
        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-300">
            🚧 Dashboard coming soon...
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Set up Supabase and run the scraper to see posts here.
          </p>
        </div>
      </div>
    </main>
  );
}
