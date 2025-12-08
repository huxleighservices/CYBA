'use client';

export function VideoBackground() {
  return (
    <div className="fixed top-0 left-0 w-full h-full z-0 overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        src="/background.mp4"
      />
      <div className="absolute top-0 left-0 w-full h-full bg-primary/50 mix-blend-multiply"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-black/50"></div>
    </div>
  );
}
