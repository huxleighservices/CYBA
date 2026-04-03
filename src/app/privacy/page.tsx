export default function PrivacyPolicyPage() {
  return (
    <main className="container mx-auto max-w-2xl py-16 px-4">
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-muted-foreground mb-10">Last updated: April 2026</p>
      <div className="prose prose-invert max-w-none space-y-6 text-foreground/80">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">Information We Collect</h2>
          <p>We collect information you provide when creating an account, posting content, or interacting with the platform, including your email address, username, and any profile information you choose to share.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">How We Use Your Information</h2>
          <p>Your information is used to operate and improve CYBAZONE, personalize your experience, and communicate with you about platform activity. We do not sell your personal data to third parties.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">Cookies</h2>
          <p>We use cookies and similar technologies to maintain your session and understand how you use CYBAZONE.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">Data Security</h2>
          <p>We take reasonable measures to protect your information. However, no internet transmission is completely secure and we cannot guarantee absolute security.</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-2">Contact</h2>
          <p>If you have questions about this Privacy Policy, please visit our <a href="/contact" className="text-primary underline">Contact Us</a> page.</p>
        </section>
      </div>
    </main>
  );
}
