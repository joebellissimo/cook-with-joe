export const metadata = {
  title: "Pricing — Cook With Joe",
};

const FREE_FEATURES = [
  "Full access to all free recipes",
  "Step-by-step chapters, loop mode, and replay",
  "Voice control (\"next step\", \"repeat\", ...)",
  "Category browsing",
];

const PREMIUM_FEATURES = [
  "Everything in Free",
  "Access to premium/subscriber-only recipes",
  "New recipes as soon as they're published",
  "Support the channel directly",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="heading-rule inline-block text-2xl font-medium text-ink sm:text-3xl">
          Pricing
        </h1>
        <p className="mt-4 text-muted">
          Cook With Joe is completely free for now. This page is a placeholder
          for the subscription tier we&apos;ll turn on later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-ink">Free</h2>
          <p className="mt-1 text-3xl font-bold text-ink">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-brand">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-lg bg-cream px-3 py-2 text-center text-sm font-medium text-muted">
            Current plan
          </div>
        </div>

        <div className="rounded-2xl border-2 border-brand bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">Premium</h2>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-3xl font-bold text-ink">
            TBD<span className="text-base font-normal text-muted">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-brand">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            disabled
            className="mt-6 w-full rounded-lg bg-brand/50 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Not available yet
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        When you&apos;re ready to launch subscriptions, this page wires up to
        Stripe Checkout/Billing — recipes already carry a{" "}
        <code className="rounded bg-cream px-1">premium</code> flag in
        the data model so gating access is a small change, not a rebuild.
      </p>
    </div>
  );
}
