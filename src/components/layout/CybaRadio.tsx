'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function CybaRadio() {
  const [isMuted, setIsMuted] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { firestore } = useFirebase();

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: settingsData } = useDoc<{ playlistUrl: string }>(settingsDocRef);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = true;
    }
  }, []);

  const toggleMute = () => {
    if (audioRef.current) {
      const currentlyMuted = audioRef.current.muted;
      audioRef.current.muted = !currentlyMuted;
      setIsMuted(!currentlyMuted);
      if (currentlyMuted) {
        audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
    }
  };

  const audioSrc = settingsData?.playlistUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

  return (
    <div className="sticky top-[64px] z-10 w-full bg-black/50 backdrop-blur-md overflow-hidden">
      <div className="container mx-auto flex h-10 items-center justify-between text-sm text-primary">
        <div className="flex-shrink-0 font-bold mr-4">CYBARADIO</div>
        <div className="flex-1 relative overflow-hidden h-full flex items-center">
            <div className="absolute ticker-track whitespace-nowrap">
                <span className="mx-4">NOW PLAYING FROM THE CYBAZONE... SHUFFLING THE BEST IN NEW MUSIC...</span>
                <span className="mx-4">NOW PLAYING FROM THE CYBAZONE... SHUFFLING THE BEST IN NEW MUSIC...</span>
            </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="flex-shrink-0 ml-4 hover:bg-primary/20"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          <span className="sr-only">{isMuted ? 'Unmute' : 'Mute'}</span>
        </Button>
      </div>
      {audioSrc && <audio ref={audioRef} src={audioSrc} loop playsInline key={audioSrc} />}
    </div>
  );
}
