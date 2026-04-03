import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container max-w-6xl px-4 py-16 md:py-24 mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 mb-8">
          <svg
            width="20"
            height="20"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop
                  offset="0%"
                  style={{ stopColor: "#8b5cf6", stopOpacity: 1 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: "#6d28d9", stopOpacity: 1 }}
                />
              </linearGradient>
            </defs>
            <circle cx="16" cy="16" r="15" fill="url(#grad)" />
            <rect x="6" y="8" width="3.5" height="14" fill="white" rx="0.5" />
            <rect x="6" y="8" width="7" height="2.5" fill="white" rx="0.5" />
            <line
              x1="16.5"
              y1="16"
              x2="24.5"
              y2="16"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <polyline
              points="22,13.5 24.5,16 22,18.5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
            Privacy-first type generation
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-violet-400 dark:from-purple-400 dark:to-violet-200 bg-clip-text text-transparent">
          typed-fetch
        </h1>

        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto leading-relaxed">
          Status-aware{" "}
          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-purple-600 dark:text-purple-400">
            fetch
          </code>{" "}
          wrapper that learns API response shapes and generates TypeScript types
          from real traffic
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link
            href="/docs"
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-violet-500 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-violet-600 transition-all shadow-lg hover:shadow-xl hover:shadow-purple-500/50 hover:scale-105 active:scale-95"
          >
            Get Started →
          </Link>
          <a
            href="https://github.com/PhumudzoSly/typed-fetch"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 border-2 border-gray-300 dark:border-gray-700 rounded-lg font-semibold hover:border-purple-500 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
          >
            View on GitHub
          </a>
        </div>

        {/* Quick Code Preview */}
        <div className="max-w-2xl mx-auto">
          <pre className="text-left bg-gray-900 dark:bg-gray-950 text-gray-100 p-6 rounded-xl overflow-x-auto shadow-2xl border border-purple-900/50">
            <code className="text-sm">{`const result = await typedFetch(
  '/api/user/123',
  { method: 'GET' },
  { endpointKey: 'GET /user/:id' }
);

if (result.status === 200) {
  console.log(result.data); // ✨ fully typed!
}`}</code>
          </pre>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg hover:shadow-purple-500/10">
          <div className="text-3xl mb-4">🔒</div>
          <h3 className="text-xl font-bold mb-2">Privacy First</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Only structure is recorded, never raw values. Strict privacy mode by
            default.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg hover:shadow-purple-500/10">
          <div className="text-3xl mb-4">⚡</div>
          <h3 className="text-xl font-bold mb-2">Auto-Generated Types</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Types emerge from real API calls. No manual definitions needed.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg hover:shadow-purple-500/10">
          <div className="text-3xl mb-4">📊</div>
          <h3 className="text-xl font-bold mb-2">Status-Aware</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Discriminated unions for every HTTP status. Type-safe error
            handling.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg hover:shadow-purple-500/10">
          <div className="text-3xl mb-4">🌐</div>
          <h3 className="text-xl font-bold mb-2">Works Everywhere</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Node.js, browsers, and mixed client/server architectures.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg hover:shadow-purple-500/10">
          <div className="text-3xl mb-4">🚀</div>
          <h3 className="text-xl font-bold mb-2">Never Throws</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Network errors return result objects, never exceptions.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-lg hover:shadow-purple-500/10">
          <div className="text-3xl mb-4">📦</div>
          <h3 className="text-xl font-bold mb-2">Zero Dependencies</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Lightweight core with no external runtime dependencies.
          </p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center py-16 px-8 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-950/30 dark:to-violet-900/20 border border-purple-200 dark:border-purple-800">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Ready to get started?
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
          Install typed-fetch and start generating types from your real API
          traffic in minutes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/docs/installation"
            className="px-8 py-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all shadow-lg hover:shadow-xl hover:shadow-purple-500/50"
          >
            Installation Guide
          </Link>
          <Link
            href="/docs/examples-react"
            className="px-8 py-4 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 rounded-lg font-semibold hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-all"
          >
            View Examples
          </Link>
        </div>
      </div>
    </main>
  );
}
