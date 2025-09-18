'use client';
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">管理页面发生错误</h1>
      <pre className="bg-red-50 text-red-800 p-3 rounded text-xs overflow-auto">
        {String(error?.message || error)}
      </pre>
      <button onClick={reset} className="mt-4 px-3 py-1 rounded border">
        重试
      </button>
    </main>
  );
}
