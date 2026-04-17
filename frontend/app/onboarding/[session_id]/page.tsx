import dynamic from "next/dynamic";

const VideoRoom = dynamic(() => import("../../../components/VideoRoom"), {
  ssr: false,
});

interface OnboardingPageProps {
  params: {
    session_id: string;
  };
}

export default function OnboardingPage({ params }: OnboardingPageProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">Session</p>
        <h1 className="text-3xl font-semibold text-cyan-50">ID: {params.session_id}</h1>
      </div>
      <VideoRoom sessionId={params.session_id} />
    </main>
  );
}
