import PodcastLayout from "./(podcast)/layout";
import PodcastHomePage from "./(podcast)/page";

export const revalidate = 60;

interface RootPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default function RootPage({ searchParams }: RootPageProps) {
  return (
    <PodcastLayout>
      <PodcastHomePage searchParams={searchParams} />
    </PodcastLayout>
  );
}
