import Link from "next/link";
import { WaveBackground } from "@/components/WaveBackground";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export default function HomePage() {
  return (
    <div>
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden">
        <WaveBackground />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight">
            Your AI partner for self-hosted RAG and chat
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto">
            Deploy models, build knowledge bases, and chat with your data—all on your own infrastructure.
          </p>
          <div className="mt-10">
            <Button href="/register" variant="primary" className="rounded-xl px-8 py-3 text-base">
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <Card variant="blue" className="flex flex-col">
            <div className="flex-1">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold mb-4">
                +
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                AI-powered platform for RAG and chat
              </h3>
              <p className="text-white/90 text-sm">
                Knowledge bases, model registry, deployments, and chat—all in one self-hosted stack.
              </p>
            </div>
            <Link
              href="/how-to-use"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/20 text-white px-4 py-2 text-sm font-medium hover:bg-white/30 transition-colors"
            >
              Learn more
              <span className="text-lg">+</span>
            </Link>
          </Card>

          <Card variant="wave" className="flex flex-col justify-center">
            <p className="text-4xl font-bold text-foreground">Self-hosted</p>
            <p className="mt-2 text-muted">Your data stays on your infrastructure.</p>
          </Card>

          <Card variant="wave" className="flex flex-col">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-foreground">See how to use</p>
                <p className="text-sm text-muted mt-1">Step-by-step guides for knowledge bases, models, and chat.</p>
                <Link href="/how-to-use" className="mt-2 inline-block text-primary text-sm font-medium hover:underline">
                  How to use →
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
