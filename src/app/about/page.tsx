import Link from "next/link";

export const metadata = { title: "About — Engineer AI" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-4xl font-black">About Engineer AI</h1>
      <p className="text-lg text-muted">Your personal engineering study assistant for Diesel Plant Fitting, motor vehicle mechanics and related courses.</p>
      <section className="card space-y-2 p-5">
        <h2 className="font-bold">What you can do here</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Ask engineering questions and get clear explanations, from &ldquo;explain like I&apos;m 5&rdquo; to detailed college level.</li>
          <li>Upload a question paper and have it solved step by step, with the original numbering and mark allocation respected.</li>
          <li>Browse, preview and download question papers shared by other students, free and without an account.</li>
          <li>Generate notes, summaries, flashcards, practice tests and revision plans.</li>
        </ul>
      </section>
      <section className="card space-y-2 p-5">
        <h2 className="font-bold">Your privacy</h2>
        <p className="text-sm text-muted">Your chats and uploads are private by default. A paper is only shared publicly when you explicitly choose to publish it. Published papers can be reported and are subject to moderation.</p>
      </section>
      <section className="card space-y-2 p-5">
        <h2 className="font-bold">Use it wisely</h2>
        <p className="text-sm text-muted">Engineer AI is a study aid. It can make mistakes, so always verify specifications, torque values and procedures against your workshop manual or instructor, and follow workshop safety rules.</p>
      </section>
      <div className="flex gap-3">
        <Link href="/" className="btn btn-primary">Start asking</Link>
        <Link href="/library" className="btn btn-ghost">Explore papers</Link>
      </div>
    </div>
  );
}
