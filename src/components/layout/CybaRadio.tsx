'use client';

import { useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function CybaRadio() {
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { firestore } = useFirebase();

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: settingsData } = useDoc<{ playlistId: string }>(settingsDocRef);

  // Default YouTube playlist ID
  const playlistId = settingsData?.playlistId || 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';

  const toggleMute = () => {
    if (iframeRef.current?.contentWindow) {
      if (isMuted) {
        // Unmute
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'unMute' }),
          '*'
        );
      } else {
        // Mute
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'mute' }),
          '*'
        );
      }
      setIsMuted(!isMuted);
    }
  };

  const embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&mute=1&loop=1&shuffle=1&controls=0&enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`;

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

      {/* Hidden YouTube Player */}
      <iframe
        ref={iframeRef}
        src={embedUrl}
        allow="autoplay; encrypted-media"
        className="absolute w-[1px] h-[1px] -top-96 -left-96 opacity-0 pointer-events-none"
        title="CybaRadio Player"
        key={playlistId}
      />
    </div>
  );
}
