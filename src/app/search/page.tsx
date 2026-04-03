'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, Users, Hash, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { PostCard, type CybazonePost } from '@/components/cybazone/PostCard';
import Link from 'next/link';
import { AvatarDisplay } from '@/components/AvatarDisplay';
import { Card, CardContent } from '@/components/ui/card';

function SearchResults() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    
    const initialQuery = searchParams.get('q') || '';
    const initialTab = initialQuery.startsWith('#') ? 'tags' : 'profiles';
    
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [activeTab, setActiveTab] = useState<'profiles' | 'tags'>(initialTab);
    
    // Debounce search query to avoid spamming Firestore
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Update URL when debouncedQuery changes
    useEffect(() => {
        if (!debouncedQuery) return;
        const params = new URLSearchParams();
        params.set('q', debouncedQuery);
        window.history.replaceState(null, '', `/search?${params.toString()}`);
    }, [debouncedQuery]);

    const qLower = debouncedQuery.toLowerCase().trim();

    // --- Profiles Query ---
    const profilesQuery = useMemoFirebase(() => {
        if (!firestore || !qLower || activeTab !== 'profiles') return null;
        // Search by username prefix using the standard \uf8ff trick
        // Ensure we strip any leading '#' if they accidentally typed it while searching for a user
        const cleanQuery = qLower.startsWith('#') ? qLower.slice(1) : qLower;
        return query(
            collection(firestore, 'users'),
            where('username_lowercase', '>=', cleanQuery),
            where('username_lowercase', '<=', cleanQuery + '\uf8ff'),
            limit(20)
        );
    }, [firestore, qLower, activeTab]);

    const { data: profiles, isLoading: isLoadingProfiles } = useCollection<any>(profilesQuery);

    // --- Tags Query ---
    const tagsQuery = useMemoFirebase(() => {
        if (!firestore || !qLower || activeTab !== 'tags') return null;

        // Ensure the search query has a # for the array-contains to match properly
        const tagToSearch = qLower.startsWith('#') ? qLower : `#${qLower}`;

        return query(
            collection(firestore, 'cybazone_posts'),
            where('hashtags', 'array-contains', tagToSearch),
            limit(50)
        );
    }, [firestore, qLower, activeTab]);

    const { data: posts, isLoading: isLoadingPosts } = useCollection<CybazonePost>(tagsQuery);


    // --- Render Helpers ---
    const renderProfiles = () => {
        if (!debouncedQuery) {
            return <p className="text-center text-muted-foreground py-8">Type a username to search...</p>;
        }
        if (isLoadingProfiles) {
            return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
        }
        if (!profiles || profiles.length === 0) {
            return <p className="text-center text-muted-foreground py-8">No users found matching "{debouncedQuery}"</p>;
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {profiles.map(profile => (
                    <Link key={profile.id} href={`/u/${profile.username}`}>
                        <Card className="hover:bg-primary/5 transition-colors border-primary/20 bg-card/50 cursor-pointer group">
                            <CardContent className="p-4 flex items-center gap-4">
                                <AvatarDisplay avatarConfig={profile.avatarConfig} profilePictureUrl={profile.profilePictureUrl} size={48} />
                                <div>
                                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{profile.username}</h3>
                                    <p className="text-sm text-muted-foreground">{profile.followers?.length || 0} Followers</p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        );
    };

    const renderPosts = () => {
        if (!debouncedQuery) {
            return <p className="text-center text-muted-foreground py-8">Type a hashtag (e.g. #cyber) to search...</p>;
        }
        if (isLoadingPosts) {
            return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
        }
        if (!posts || posts.length === 0) {
            return <p className="text-center text-muted-foreground py-8">No posts found containing "{debouncedQuery.startsWith('#') ? debouncedQuery : '#' + debouncedQuery}"</p>;
        }

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {posts.map(post => (
                    <PostCard key={post.id} post={post} />
                ))}
            </div>
        );
    };

    return (
        <div className="container mx-auto px-4 py-8 md:py-12 min-h-screen max-w-4xl">
            <div className="text-center mb-10">
                <h1 className="text-3xl md:text-5xl font-headline font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400 drop-shadow-sm mb-4">
                    Discover CYBAZONE
                </h1>
                <p className="text-muted-foreground text-lg">Search for users and trending hashtags across the galaxy.</p>
            </div>

            <div className="relative max-w-2xl mx-auto mb-10 group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <SearchIcon className="h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-4 py-6 text-lg rounded-full bg-card/60 border-2 border-primary/20 focus-visible:ring-primary focus-visible:border-primary shadow-[0_0_15px_rgba(138,43,226,0.1)] focus-visible:shadow-[0_0_25px_rgba(138,43,226,0.3)] transition-all"
                />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'profiles' | 'tags')} className="max-w-3xl mx-auto">
                <TabsList className="grid w-full grid-cols-2 bg-card/50 border border-primary/20 rounded-full p-1 mb-8 shadow-md">
                    <TabsTrigger value="profiles" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold flex items-center gap-2 text-base transition-all">
                        <Users className="w-5 h-5" /> Profiles
                    </TabsTrigger>
                    <TabsTrigger value="tags" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold flex items-center gap-2 text-base transition-all">
                        <Hash className="w-5 h-5" /> Hashtags
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="profiles" className="mt-4">
                    {renderProfiles()}
                </TabsContent>

                <TabsContent value="tags" className="mt-4">
                    {renderPosts()}
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex flex-col items-center justify-center p-12">
                <Loader2 className="animate-spin w-12 h-12 text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">Initializing Search Grid...</p>
            </div>
        }>
            <SearchResults />
        </Suspense>
    );
}
