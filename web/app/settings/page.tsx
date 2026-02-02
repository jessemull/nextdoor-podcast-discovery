// TODO: Implement settings page
// - Display current ranking weights
// - Allow adjusting weights (absurdity, humor, drama, relatability)
// - Save to Supabase settings table

export default function SettingsPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Settings</h1>
        <p className="text-gray-400 mb-8">
          Configure ranking weights and preferences.
        </p>

        <div className="bg-gray-800 rounded-lg p-6">
          <p className="text-gray-300">🚧 Settings coming soon...</p>
          <p className="text-sm text-gray-500 mt-2">
            Adjust how posts are scored and ranked.
          </p>
        </div>
      </div>
    </main>
  );
}
