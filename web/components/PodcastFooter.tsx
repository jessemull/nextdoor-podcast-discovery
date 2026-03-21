export function PodcastFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-transparent bg-transparent">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-4 px-5 py-6 sm:px-7">
        <p className="text-podcast-muted text-sm">
          &copy; {currentYear} Was that a gunshot?
        </p>
      </div>
    </footer>
  );
}
