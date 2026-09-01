'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, startAt, endAt, getDocs, limit } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface MentionUser {
  id: string;
  username: string;
  username_lowercase: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minHeight?: number;
}

/** Extracts @mention token being typed at the cursor position */
function getMentionQuery(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/@([\w]*)$/);
  if (!match) return null;
  return { query: match[1], start: cursor - match[0].length };
}

export function MentionTextarea({ value, onChange, placeholder, className, disabled, minHeight = 120 }: Props) {
  const { firestore } = useFirebase();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [mentionAnchor, setMentionAnchor] = useState<{ start: number; query: string } | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q && q !== '') { setSuggestions([]); return; }
    try {
      const lower = q.toLowerCase();
      const snap = await getDocs(query(
        collection(firestore, 'users'),
        orderBy('username_lowercase'),
        startAt(lower),
        endAt(lower + '\uf8ff'),
        limit(6),
      ));
      setSuggestions(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch {
      setSuggestions([]);
    }
  }, [firestore]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const cursor = e.target.selectionStart ?? 0;
    const mention = getMentionQuery(e.target.value, cursor);
    if (mention) {
      setMentionAnchor(mention);
      setActiveIdx(0);
      // Determine if dropdown should open upward
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setDropUp(spaceBelow < 220);
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(mention.query), 200);
    } else {
      setMentionAnchor(null);
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions[activeIdx]) { e.preventDefault(); insertMention(suggestions[activeIdx].username); }
    } else if (e.key === 'Escape') { setSuggestions([]); setMentionAnchor(null); }
  };

  const insertMention = (username: string) => {
    if (!mentionAnchor || !ref.current) return;
    const before = value.slice(0, mentionAnchor.start);
    const after = value.slice(ref.current.selectionStart);
    const newVal = `${before}@${username} ${after}`;
    onChange(newVal);
    setSuggestions([]);
    setMentionAnchor(null);
    // Restore cursor after the inserted mention
    setTimeout(() => {
      const pos = before.length + username.length + 2;
      ref.current?.setSelectionRange(pos, pos);
      ref.current?.focus();
    }, 0);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setSuggestions([]);
        setMentionAnchor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
          className,
        )}
        style={{ minHeight }}
      />

      {suggestions.length > 0 && (
        <div className={cn(
          "absolute z-50 left-0 w-64 bg-popover border border-border rounded-lg shadow-xl overflow-hidden",
          dropUp ? "bottom-full mb-1" : "top-full mt-1"
        )}>
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(u.username); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors',
                i === activeIdx ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              <span className="text-base leading-none">@</span>
              <span className="font-medium">{u.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Extract all @username strings from post/comment content */
export function extractMentions(content: string): string[] {
  return [...new Set((content.match(/@([\w]+)/g) ?? []).map(m => m.slice(1).toLowerCase()))];
}
