import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const topics = [
  {
    title: 'Synthwave recommendations for a long night drive?',
    category: 'Music',
    author: 'NeonRider',
    replies: 28,
    lastPost: '5 minutes ago',
  },
  {
    title: 'Marketing my first EP - where to start?',
    category: 'Artist Help',
    author: 'StarSeeker',
    replies: 15,
    lastPost: '45 minutes ago',
  },
  {
    title: "Showcase: My new retro-inspired track 'Grid Runner'",
    category: 'Showcase',
    author: 'GlitchWave',
    replies: 42,
    lastPost: '1 hour ago',
  },
  {
    title: "What's your favorite 80s movie soundtrack?",
    category: 'Discussion',
    author: 'VHS_King',
    replies: 112,
    lastPost: '3 hours ago',
  },
  {
    title: 'Looking for a vocalist for a darksynth project',
    category: 'Collaboration',
    author: 'CyberDreamer',
    replies: 5,
    lastPost: '1 day ago',
  },
];

export default function CybaboardPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          Cybaboard
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          The central hub for the CYBA Galaxy. Connect, collaborate, and create.
        </p>
      </div>

      <div className="border border-primary/20 rounded-lg bg-card/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b-primary/20 hover:bg-card/50">
              <TableHead className="w-[60%]">Topic</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Replies</TableHead>
              <TableHead className="text-right">Last Post</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((topic) => (
              <TableRow
                key={topic.title}
                className="border-b-primary/10"
              >
                <TableCell>
                  <Link
                    href="#"
                    className="font-medium text-base hover:text-primary transition-colors"
                  >
                    {topic.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className="text-xs border-accent/50 text-accent"
                    >
                      {topic.category}
                    </Badge>
                    <span className="text-xs text-foreground/60">
                      by {topic.author}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-foreground/80 hidden sm:table-cell">
                  {topic.replies}
                </TableCell>
                <TableCell className="text-right text-foreground/60 text-xs">
                  {topic.lastPost}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
