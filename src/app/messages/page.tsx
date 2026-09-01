'use client';

export default function MessagesIndexPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="text-6xl select-none">💬</div>
      <h2 className="text-xl font-bold">Your Messages</h2>
      <p className="text-muted-foreground text-sm max-w-xs">
        Select a conversation or hit the compose button to start a new one.
      </p>
    </div>
  );
}
