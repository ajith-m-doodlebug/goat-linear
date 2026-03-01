import Link from "next/link";
import { WaveBackground } from "@/components/WaveBackground";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function HomePage() {
  return (
    <div>
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden">
        <WaveBackground />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="text-primary-dark font-semibold tracking-wide uppercase text-sm mb-6 opacity-90">
            Self-hosted AI infrastructure
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight">
            <span className="text-foreground">Your AI partner for </span>
            <span className="text-gradient">RAG and chat</span>
          </h1>
          <p className="mt-8 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
            Deploy models, build knowledge bases, and chat with your data—all on your own infrastructure.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              href="/register"
              variant="primary"
              className="rounded-2xl px-10 py-4 text-base gap-3"
            >
              Get Started
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
            <Button href="/how-to-use" variant="secondary" className="rounded-2xl px-10 py-4 text-base">
              How it works
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-foreground">Why RAGline</h2>
          <p className="mt-3 text-muted text-lg max-w-xl mx-auto">
            One platform for RAG, models, and chat—with full control.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <Card variant="blue" className="flex flex-col">
            <div className="flex-1">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold mb-6 backdrop-blur">
                +
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                AI-powered RAG and chat
              </h3>
              <p className="text-white/90 text-base leading-relaxed">
                Knowledge bases, model registry, deployments, and chat—all in one self-hosted stack.
              </p>
            </div>
            <Link
              href="/how-to-use"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/20 text-white px-5 py-3 text-sm font-semibold hover:bg-white/30 transition-all backdrop-blur"
            >
              Learn more
              <span className="text-lg">+</span>
            </Link>
          </Card>

          <Card variant="wave" className="flex flex-col justify-center">
            <p className="text-4xl font-bold text-foreground tracking-tight">Self-hosted</p>
            <p className="mt-3 text-muted text-lg">Your data stays on your infrastructure.</p>
          </Card>

          <Card variant="wave" className="flex flex-col">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-foreground text-lg">See how to use</p>
                <p className="text-muted mt-1 leading-relaxed">Step-by-step guides for knowledge bases, models, and chat.</p>
                <Link
                  href="/how-to-use"
                  className="mt-3 inline-flex items-center gap-1 text-primary font-semibold hover:underline"
                >
                  How to use
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
