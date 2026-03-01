import { ContactForm } from "@/app/contact/ContactForm";

export const metadata = {
  title: "Contact | RAGline",
  description: "Get in touch with the RAGline team.",
};

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-16">
      <h1 className="text-4xl font-bold text-foreground tracking-tight">Contact</h1>
      <p className="mt-3 text-muted text-lg">
        Send us a message and we’ll get back to you.
      </p>
      <div className="mt-10 rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur p-8 shadow-card">
        <ContactForm />
      </div>
    </div>
  );
}
