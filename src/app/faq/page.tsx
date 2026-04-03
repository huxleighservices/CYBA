export default function FAQPage() {
  const faqs = [
    {
      q: 'What is CYBAZONE?',
      a: 'CYBAZONE is a music marketing community where artists and fans connect, share, and support each other.',
    },
    {
      q: 'What are CYBACoins?',
      a: 'CYBACoins are the in-platform currency you earn by engaging with the community. Use them in the Shop or to Boost content.',
    },
    {
      q: 'How do I earn CYBACoins?',
      a: 'You earn CYBACoins by posting content, supporting other artists, and completing CYBAQuests.',
    },
    {
      q: 'How do Boosts work?',
      a: 'Boosts increase the visibility of a post in the feed, helping artists reach a wider audience.',
    },
    {
      q: 'How do I contact support?',
      a: 'Visit our Contact Us page or reach out through our social media channels.',
    },
  ];

  return (
    <main className="container mx-auto max-w-2xl py-16 px-4">
      <h1 className="text-4xl font-bold mb-2">FAQ</h1>
      <p className="text-muted-foreground mb-10">Frequently asked questions about CYBAZONE.</p>
      <div className="space-y-6">
        {faqs.map((item, i) => (
          <div key={i} className="border border-border rounded-lg p-5">
            <h2 className="font-semibold text-lg mb-2">{item.q}</h2>
            <p className="text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
