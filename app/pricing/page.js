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
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          Pricing
        </h1>
        <p className="mt-2 text-neutral-600">
          Cook With Joe is completely free for now. This page is a placeholder
          for the subscription tier we&apos;ll turn on later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Free</h2>
          <p className="mt-1 text-3xl font-bold text-neutral-900">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-neutral-600">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-orange-600">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-lg bg-neutral-100 px-3 py-2 text-center text-sm font-medium text-neutral-500">
            Current plan
          </div>
        </div>

        <div className="rounded-2xl border-2 border-orange-500 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Premium</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-3xl font-bold text-neutral-900">
            TBD<span className="text-base font-normal text-neutral-500">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-neutral-600">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-orange-600">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <button
            disabled
            className="mt-6 w-full rounded-lg bg-orange-600/50 px-3 py-2 text-center text-sm font-medium text-white"
          >
            Not available yet
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-neutral-400">
        When you&apos;re ready to launch subscriptions, this page wires up to
        Stripe Checkout/Billing — recipes already carry a{" "}
        <code className="rounded bg-neutral-100 px-1">premium</code> flag in
        the data model so gating access is a small change, not a rebuild.
      </p>
    </div>
  );
}
