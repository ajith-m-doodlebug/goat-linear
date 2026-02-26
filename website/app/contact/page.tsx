import { ContactForm } from "@/app/contact/ContactForm";

export const metadata = {
  title: "Contact | LLM Builder",
  description: "Get in touch with the LLM Builder team.",
};

export default function ContactPage() {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold text-foreground">Contact</h1>
      <p className="mt-2 text-muted">
        Send us a message and we’ll get back to you.
      </p>
      <ContactForm />
    </div>
  );
}
