'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export function CybaRadio() {
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const randomIndexRef = useRef(0);
  const { firestore } = useFirebase();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: settingsData } = useDoc<{ playlistId: string; playlistLength?: number }>(settingsDocRef);

  const playlistId = settingsData?.playlistId || 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
  const playlistLength = settingsData?.playlistLength || 50;

  const getEmbedUrl = (index: number) => {
    const params = new URLSearchParams({
      list: playlistId,
      autoplay: '1',
      mute: '1', // Always start muted and control via API
      loop: '1',
      index: index.toString(),
      controls: '0',
      disablekb: '1',
      fs: '0',
      modestbranding: '1',
      rel: '0',
      enablejsapi: '1',
    });
    if (typeof window !== 'undefined') {
      params.set('origin', window.location.origin);
    }
    return `https://www.youtube.com/embed/videoseries?${params.toString()}`;
  };

  const handleClick = () => {
    if (isMuted) {
      // Unmute
      const newIndex = Math.floor(Math.random() * playlistLength);
      randomIndexRef.current = newIndex;
      setIframeKey(prev => prev + 1); // Force re-render with new index to start a new video
      setIsPlaying(true);
      setIsMuted(false);
    } else {
      // Mute
      setIsMuted(true);
      setIsPlaying(false);
    }
  };

  // The actual URL passed to the iframe. It changes only when the key changes.
  const embedUrl = getEmbedUrl(randomIndexRef.current);

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

      {/* Hidden YouTube iframe - only render on client and when playing */}
      {isClient && isPlaying && (
        <iframe
          key={iframeKey}
          src={getEmbedUrl(randomIndexRef.current)} // Use the new index here
          allow="autoplay; encrypted-media"
          className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none"
          style={{ top: '-9999px', left: '-9999px' }}
          title="CYBAZONE RADIO"
        />
      )}
    </div>
  );
}
