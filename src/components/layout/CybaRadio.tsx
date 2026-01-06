'use client';

import { useState, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function CybaRadio() {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { firestore } = useFirebase();

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: settingsData } = useDoc<{ playlistId: string }>(settingsDocRef);

  const playlistId = settingsData?.playlistId || 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';

  // Build the embed URL - only add autoplay when user clicks
  const getEmbedUrl = (muted: boolean, autoplay: boolean) => {
    const params = new URLSearchParams({
      list: playlistId,
      autoplay: autoplay ? '1' : '0',
      mute: muted ? '1' : '0',
      loop: '1',
      controls: '0',
      disablekb: '1',
      fs: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '0',
      shuffle: '1',
    });
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  };

  const handleClick = () => {
    if (isMuted) {
      // User wants to hear audio - reload iframe with audio enabled
      setIsPlaying(true);
      setIsMuted(false);
    } else {
      // User wants to mute - reload iframe muted
      setIsMuted(true);
    }
  };

  return (
    <div className="sticky top-[64px] z-10 w-full bg-black/50 backdrop-blur-md overflow-hidden">
      <div className="container mx-auto flex h-10 items-center justify-between text-sm text-primary">
        <div className="flex-shrink-0 font-bold mr-4">CYBAZONE RADIO</div>

        <div className="flex-1 relative overflow-hidden h-full flex items-center">
          <div className="absolute ticker-track whitespace-nowrap">
            <span className="mx-4">NOW PLAYING FROM THE CYBAZONE... SHUFFLING THE BEST IN NEW MUSIC...</span>
            <span className="mx-4">NOW PLAYING FROM THE CYBAZONE... SHUFFLING THE BEST IN NEW MUSIC...</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className="flex-shrink-0 ml-4 hover:bg-primary/20"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </Button>
      </div>

      {/* Hidden YouTube iframe - reloads with new params on toggle */}
      <iframe
        ref={iframeRef}
        key={`${isMuted}-${isPlaying}`}
        src={getEmbedUrl(isMuted, isPlaying)}
        allow="autoplay; encrypted-media"
        className="fixed w-[300px] h-[200px] pointer-events-none"
        style={{ top: '-9999px', left: '-9999px' }}
        title="CybaRadio"
      />
    </div>
  );
}
