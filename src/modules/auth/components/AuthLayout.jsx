import { Wordmark } from "@/modules/shared";

import { GapPlot } from "./GapPlot";

export function AuthLayout({ title, description, children }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <main className="grid-paper-light flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <Wordmark className="text-foreground" markClassName="text-primary" />

          <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

          <div className="mt-8 flex flex-col gap-5">{children}</div>
        </div>
      </main>

      <div aria-hidden="true" data-testid="login-panel" className="on-shell relative hidden bg-shell lg:block">
        <GapPlot>
          <p className="mt-6 max-w-[15rem] pl-5 font-display text-2xl leading-snug font-medium text-white">
            Plot the gap. Close the gap.
          </p>
        </GapPlot>
      </div>
    </div>
  );
}
