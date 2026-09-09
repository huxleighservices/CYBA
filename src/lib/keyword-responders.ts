export interface KeywordResponder {
  keyword: string; // matched case-insensitively as a substring of the incoming DM text
  reply: string;
}

/** Returns the first responder whose keyword appears in the message text (case-insensitive),
 *  or null if none match. Checked in list order, so admins can put more specific keywords first. */
export function matchKeywordResponder(text: string, responders: KeywordResponder[] | undefined): KeywordResponder | null {
  if (!responders || responders.length === 0) return null;
  const lower = text.toLowerCase();
  for (const r of responders) {
    if (r.keyword.trim() && lower.includes(r.keyword.trim().toLowerCase())) return r;
  }
  return null;
}
