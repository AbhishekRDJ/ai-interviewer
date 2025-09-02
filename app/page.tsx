export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <main className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold">AI Interview</h1>
        <p className="text-gray-600 text-center max-w-md">Join a secure call and complete a short, AI-led screening.</p>
        <a href="/interview" className="px-5 py-3 rounded-md bg-black text-white dark:bg-white dark:text-black hover:opacity-90">
          Start Interview
        </a>
      </main>
    </div>
  );
}
