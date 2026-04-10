import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-semibold tracking-tight text-slate-900">
              PAH
            </span>
            <span className="hidden sm:inline text-xs font-medium text-slate-500 border-l border-slate-200 pl-2">
              finally, in ASL
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        {/* Decorative gradient blob */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-br from-blue-100 via-indigo-100 to-transparent rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium px-3 py-1 rounded-full mb-6">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-shimmer" />
            Built for the Deaf community
          </div>
          <h1 className="text-5xl sm:text-6xl font-semibold text-slate-900 leading-[1.05] tracking-tight">
            Finally,
            <br />
            interpreting on your terms.
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 mt-6 max-w-2xl mx-auto leading-relaxed">
            <span className="font-medium text-slate-900">PAH</span> — the ASL mouth morpheme for{' '}
            <em>&ldquo;finally!&rdquo;</em> — connects Deaf individuals with qualified ASL
            interpreters instantly. No agency middlemen. Lower costs. Real-time availability.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
            <Link
              href="/signup"
              className="bg-slate-900 hover:bg-slate-800 text-white px-7 py-3.5 rounded-xl font-medium text-base shadow-sm transition-colors"
            >
              Find an Interpreter
            </Link>
            <Link
              href="/signup"
              className="bg-white hover:bg-slate-50 text-slate-900 px-7 py-3.5 rounded-xl font-medium text-base border border-slate-300 transition-colors"
            >
              Join as Interpreter
            </Link>
          </div>
          <p className="text-sm text-slate-500 mt-6">
            Deaf-first. ADA-compliant. Transparent pricing.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-24 border-y border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
              How PAH works
            </h2>
            <p className="text-slate-600 mt-3">Three steps. No middlemen.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <HowItWorksCard
              step="1"
              title="Book an interpreter"
              description="Schedule in advance or request one right now. Choose your specialization — medical, legal, educational, or general."
            />
            <HowItWorksCard
              step="2"
              title="Get matched instantly"
              description="Our system finds the closest available, qualified interpreter. Track their ETA in real-time."
            />
            <HowItWorksCard
              step="3"
              title="Simple billing"
              description="The business pays — as required by ADA. Transparent pricing, no hidden fees, lower than traditional agencies."
            />
          </div>
        </div>
      </section>

      {/* For each audience */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
              A platform for everyone in the room
            </h2>
            <p className="text-slate-600 mt-3">
              Three sides, one marketplace. Each with what they actually need.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <AudienceCard
              title="For Deaf individuals"
              accent="from-blue-500 to-indigo-500"
              items={[
                'Book interpreters for appointments or personal events',
                'See real-time availability and ETA',
                'Rate your interpreter experience',
                'Request urgent interpreters when you need one now',
                'See when a business has already booked one for you',
              ]}
              cta="Sign up free"
              href="/signup"
            />
            <AudienceCard
              title="For interpreters"
              accent="from-emerald-500 to-teal-500"
              items={[
                'Set your own availability and service area',
                'Get paid based on experience and certifications',
                'Accept jobs that fit your schedule',
                'Fair job distribution — everyone gets opportunities',
                'Direct deposit via Stripe',
              ]}
              cta="Join as interpreter"
              href="/signup"
            />
            <AudienceCard
              title="For businesses"
              accent="from-amber-500 to-orange-500"
              items={[
                'ADA-compliant interpreter booking',
                'Lower cost than traditional agencies',
                'Simple billing — pay per booking',
                'Track all interpreter requests in one place',
                'Avoid double-booking interpreters',
              ]}
              cta="Register your business"
              href="/signup"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-slate-50 py-24 border-t border-slate-200/70">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-600 mt-3 mb-12">
            Lower than traditional agencies. No surprise fees.
          </p>
          <div className="grid sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-left shadow-sm">
              <div className="text-xs font-semibold tracking-wider uppercase text-blue-600">
                In-person
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-slate-900">$85</span>
                <span className="text-slate-500">/hr</span>
              </div>
              <p className="text-sm text-slate-600 mt-3">2-hour minimum</p>
              <p className="text-xs text-slate-500 mt-1">Agencies charge $100–125/hr</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-left shadow-sm">
              <div className="text-xs font-semibold tracking-wider uppercase text-blue-600">
                Video Remote (VRI)
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold text-slate-900">$55</span>
                <span className="text-slate-500">/hr</span>
              </div>
              <p className="text-sm text-slate-600 mt-3">1-hour minimum</p>
              <p className="text-xs text-slate-500 mt-1">Agencies charge $60–100/hr</p>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-8 max-w-xl mx-auto">
            Rush fee (under 24hr notice): 1.5×. Businesses pay — Deaf individuals are never
            charged for ADA-required services.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <span className="text-xl font-semibold tracking-tight text-slate-900">PAH</span>
              <p className="text-sm text-slate-500 mt-1">
                Finally, interpreting on your terms.
              </p>
            </div>
            <div className="flex gap-6 text-sm text-slate-600">
              <Link href="/signup" className="hover:text-slate-900 transition-colors">
                For Deaf users
              </Link>
              <Link href="/signup" className="hover:text-slate-900 transition-colors">
                For Interpreters
              </Link>
              <Link href="/signup" className="hover:text-slate-900 transition-colors">
                For Businesses
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HowItWorksCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center text-base font-semibold mb-5 shadow-sm">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 leading-relaxed text-sm">{description}</p>
    </div>
  );
}

function AudienceCard({
  title,
  items,
  cta,
  href,
  accent,
}: {
  title: string;
  items: string[];
  cta: string;
  href: string;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col">
      <div className={`h-1 w-10 bg-gradient-to-r ${accent} rounded-full mb-5`} />
      <h3 className="text-xl font-semibold text-slate-900 mb-5">{title}</h3>
      <ul className="space-y-3 mb-7 flex-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
            <svg
              className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.42l-8 8a1 1 0 01-1.42 0l-4-4a1 1 0 111.42-1.42L8 12.585l7.29-7.295a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="leading-snug">{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="block text-center bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
      >
        {cta}
      </Link>
    </div>
  );
}
