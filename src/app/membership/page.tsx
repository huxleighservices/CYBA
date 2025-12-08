import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "STAR",
    price: "$29",
    features: ["Basic promotion tools", "Community access", "Monthly newsletter"],
    cta: "Start Shining",
    primary: false,
  },
  {
    name: "SUPERNOVA",
    price: "$59",
    features: [
      "All STAR features",
      "Advanced marketing suite",
      "Featured on CYBA playlists",
      "Dedicated support",
    ],
    cta: "Go Supernova",
    primary: true,
  },
  {
    name: "GALAXY",
    price: "$99",
    features: [
      "All SUPERNOVA features",
      "Personalized PR campaign",
      "Merch store integration",
      "VIP event access",
    ],
    cta: "Conquer the Galaxy",
    primary: false,
  },
];

export default function MembershipPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          Join The CYBA Galaxy
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Choose your orbit. Our membership plans are designed to rocket your
          music career to new heights.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`flex flex-col border-primary/20 bg-card/50 transition-all duration-300 hover:border-primary ${
              tier.primary
                ? "border-primary border-2 shadow-primary/20 shadow-2xl relative"
                : ""
            }`}
          >
            {tier.primary && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                Most Popular
              </div>
            )}
            <CardHeader className="items-center text-center">
              <CardTitle className="text-2xl font-bold tracking-widest">
                {tier.name}
              </CardTitle>
              <CardDescription>
                <span className="text-4xl font-bold text-foreground">
                  {tier.price}
                </span>
                <span className="text-foreground/70">/month</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={tier.primary ? "default" : "outline"}
              >
                {tier.cta}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
