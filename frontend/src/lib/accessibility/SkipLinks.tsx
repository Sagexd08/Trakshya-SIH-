export function SkipLinks() {
  return (
    <div className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 z-50">
      <a
        href="#main-content"
        className="bg-blue-600 text-white px-4 py-2 rounded-br-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Skip to main content
      </a>
      <a
        href="#main-navigation"
        className="bg-blue-600 text-white px-4 py-2 rounded-br-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ml-2"
      >
        Skip to navigation
      </a>
    </div>
  );
}

