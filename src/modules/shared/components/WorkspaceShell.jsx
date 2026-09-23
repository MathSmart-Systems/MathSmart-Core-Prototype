/**
 * Authenticated workspace layout: a persistent sidebar and a content region.
 * There is no desktop top navigation bar; below the large breakpoint the
 * sidebar provides its own minimal menu trigger.
 */
export function WorkspaceShell({ sidebar, children }) {
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      {sidebar}
      <main id="workspace-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl 2xl:max-w-screen-2xl">{children}</div>
      </main>
    </div>
  );
}
