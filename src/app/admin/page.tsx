'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Shield,
  PlusCircle,
  Trash2,
  Edit,
  Loader2,
  Link2,
  Database,
  Settings as SettingsIcon,
  Palette,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirebase,
  useCollection,
  useDoc,
  useMemoFirebase,
  setDocumentNonBlocking,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where, orderBy, writeBatch, getDocs } from 'firebase/firestore';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { debounce } from 'lodash';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { avatarOptions } from '@/lib/avatar-assets';
import Image from 'next/image';

// Schemas
const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

const settingsSchema = z.object({
  playlistId: z.string().min(1, { message: "Please enter a valid YouTube Playlist ID." }),
  playlistLength: z.coerce.number().min(1, { message: "Enter the number of videos in the playlist." }),
});

const blogPostSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  content: z.string().min(1, 'Content is required.'),
  category: z.string().min(1, 'Category is required.'),
  excerpt: z.string().min(1, 'Excerpt is required.'),
  imageUrl: z.string().url('Must be a valid URL.').or(z.literal('')),
});

const merchandiseSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().min(1, 'Description is required.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  cybaCoinPrice: z.coerce.number().min(0, 'Price must be a positive number.').optional(),
  imageUrl: z.string().url('Must be a valid URL.').or(z.literal('')),
  buyNowUrl: z.string().url('Must be a valid URL.').or(z.literal('')),
  stockQuantity: z.coerce
    .number()
    .int()
    .min(0, 'Stock must be a positive integer.'),
});

const membershipSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().min(1, 'Description is required.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  features: z.string().min(1, 'Add at least one feature.'),
  buttonText: z.string().min(1, 'Button text is required.'),
  buttonLink: z.string().min(1, 'Button link is required.'),
});

const extraSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  description: z.string().min(1, 'Description is required.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  features: z.string().min(1, 'Add at least one feature.'),
  buttonText: z.string().min(1, 'Button text is required.'),
  buttonLink: z.string().min(1, 'Button link is required.'),
  type: z.enum(['boost', 'reward']),
  order: z.number().optional(),
});


const ADMIN_PASSWORD = 'VIOLETCYBA';

// --- Reusable Components ---
function PasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });

  function onSubmit(values: z.infer<typeof passwordSchema>) {
    if (values.password === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      toast({
        variant: 'destructive',
        title: 'Incorrect Password',
        description: 'Please try again.',
      });
      form.reset();
    }
  }

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/50">
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-widest mt-4">
          Admin Access
        </CardTitle>
        <CardDescription>This page requires authentication.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...field}
                      autoComplete="current-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Authenticate
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// --- Site Settings Management ---
function SettingsManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const settingsDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'radio'), [firestore]);
  const { data: settingsData, isLoading } = useDoc<{ playlistId: string; playlistLength: number }>(settingsDocRef);

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      playlistId: '',
      playlistLength: 50,
    },
  });

  useEffect(() => {
    if (settingsData) {
      form.reset({
        playlistId: settingsData.playlistId || '',
        playlistLength: settingsData.playlistLength || 50,
      });
    }
  }, [settingsData, form]);

  function onSubmit(values: z.infer<typeof settingsSchema>) {
    setDocumentNonBlocking(settingsDocRef, values, { merge: true });
    toast({
      title: "Settings Saved",
      description: "CYBARADIO settings have been updated.",
    });
  }

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Settings</CardTitle>
        <CardDescription>Manage global settings for the website.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">CYBARADIO Configuration</h3>
              
              <FormField
                control={form.control}
                name="playlistId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>YouTube Playlist ID</FormLabel>
                    <FormControl>
                      <Input placeholder="PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf" {...field} />
                    </FormControl>
                    <FormDescription>
                      The playlist ID from the YouTube URL (after "list=").
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="playlistLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Playlist Length</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} placeholder="50" {...field} />
                    </FormControl>
                    <FormDescription>
                      The number of videos in the playlist. Used to shuffle to a random video when unmuting.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


// --- User Management ---
function UserManagement() {
  const { firestore } = useFirebase();
  const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [
    firestore,
  ]);
  const { data: users, isLoading: usersLoading } = useCollection<{
    username: string;
    email: string;
    membershipTier?: string;
  }>(usersRef);

  const membershipsRef = useMemoFirebase(
    () => collection(firestore, 'memberships'),
    [firestore]
  );
  const { data: memberships, isLoading: membershipsLoading } =
    useCollection<{ name: string }>(membershipsRef);

  const handleTierChange = (userId: string, tierName: string) => {
    const userDocRef = doc(firestore, 'users', userId);
    setDocumentNonBlocking(
      userDocRef,
      { membershipTier: tierName },
      { merge: true }
    );
  };

  if (usersLoading || membershipsLoading) return <Loader2 className="animate-spin" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Assign membership tiers to users.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Membership Tier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell className="text-right">
                  <Select
                    value={user.membershipTier || ''}
                    onValueChange={(value) => handleTierChange(user.id, value)}
                  >
                    <SelectTrigger className="w-[180px] float-right">
                      <SelectValue placeholder="Select a tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">None</SelectItem>
                      {memberships?.map((tier) => (
                        <SelectItem key={tier.id} value={tier.name}>
                          {tier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// --- User Verification ---
interface LeaderboardEntry {
    cybaName?: string;
    cybaCoin?: number;
}
function UserVerification() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [isLoadingSheet, setIsLoadingSheet] = useState(true);

    const usersRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<{
        username: string;
        email: string;
        leaderboardCybaName?: string;
    }>(usersRef);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoadingSheet(true);
            try {
                const response = await fetch('/api/sheets');
                const data = await response.json();
                if (response.ok) {
                    setLeaderboardData(data);
                } else {
                    throw new Error(data.error || 'Failed to fetch leaderboard data');
                }
            } catch (error) {
                console.error("Error fetching leaderboard:", error);
                toast({
                    variant: "destructive",
                    title: "Could not load leaderboard",
                    description: error instanceof Error ? error.message : String(error)
                });
            } finally {
                setIsLoadingSheet(false);
            }
        };
        fetchLeaderboard();
    }, [toast]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleLinkUser = useCallback(
        debounce((userId: string, leaderboardName: string) => {
            const userDocRef = doc(firestore, 'users', userId);
            
            if (!leaderboardName) {
                const dataToUpdate = {
                    leaderboardCybaName: '',
                    cybaCoinBalance: 0,
                };
                setDocumentNonBlocking(userDocRef, dataToUpdate, { merge: true });
                toast({
                    title: "User Unlinked!",
                    description: `CYBACOIN balance has been reset.`
                });
                return;
            }

            const selectedEntry = leaderboardData.find(
                (entry) => entry.cybaName?.toLowerCase() === leaderboardName.toLowerCase()
            );

            if (selectedEntry) {
                const cybaCoinBalance = selectedEntry.cybaCoin;
                const dataToUpdate = {
                    leaderboardCybaName: selectedEntry.cybaName,
                    cybaCoinBalance: Number(cybaCoinBalance) || 0,
                };
                setDocumentNonBlocking(userDocRef, dataToUpdate, { merge: true });
                toast({
                    title: "User Linked!",
                    description: `CYBACOIN balance for ${selectedEntry.cybaName} updated to ${dataToUpdate.cybaCoinBalance}.`
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Name Not Found",
                    description: `"${leaderboardName}" was not found in the leaderboard.`,
                });
            }
        }, 500),
        [leaderboardData, firestore, toast]
    );

    if (isLoadingUsers || isLoadingSheet) {
        return (
            <div className="flex justify-center items-center p-8">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Verification</CardTitle>
                <CardDescription>
                    Link website users to their leaderboard records by typing the exact CybaName. The link and CYBACOIN balance will update automatically.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead className="text-right">Leaderboard CybaName</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users?.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell>{user.username}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className="text-right">
                                    <Input
                                        defaultValue={user.leaderboardCybaName || ''}
                                        onChange={(e) => handleLinkUser(user.id, e.target.value)}
                                        placeholder="Type leaderboard name..."
                                        className="w-[250px] float-right"
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// --- Blog Management ---
function BlogManagement() {
  const { firestore, user } = useFirebase();
  const blogPostsRef = useMemoFirebase(
    () => collection(firestore, 'blogPosts'),
    [firestore]
  );
  const { data: blogPosts, isLoading } = useCollection(blogPostsRef);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      deleteDocumentNonBlocking(doc(firestore, 'blogPosts', id));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Blog Management</CardTitle>
          <CardDescription>
            Create, edit, and delete blog posts.
          </CardDescription>
        </div>
        <BlogPostForm user={user} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blogPosts?.map((post) => (
                <TableRow key={post.id}>
                  <TableCell>{post.title}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <BlogPostForm post={post} user={user} />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(post.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BlogPostForm({ post, user }: { post?: any; user: any }) {
  const [open, setOpen] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof blogPostSchema>>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: post
      ? {
          ...post,
          imageUrl: post.imageUrl || '',
        }
      : {
          title: '',
          content: '',
          category: '',
          excerpt: '',
          imageUrl: '',
        },
  });

  useEffect(() => {
    if (post) {
      form.reset({
        ...post,
        imageUrl: post.imageUrl || '',
      });
    } else {
      form.reset({
        title: '',
        content: '',
        category: '',
        excerpt: '',
        imageUrl: '',
      });
    }
  }, [post, form, open]);

  const onSubmit = (values: z.infer<typeof blogPostSchema>) => {
    if (post) {
      setDocumentNonBlocking(doc(firestore, 'blogPosts', post.id), values, {
        merge: true,
      });
      toast({ title: 'Blog post updated!' });
    } else {
      addDocumentNonBlocking(collection(firestore, 'blogPosts'), {
        ...values,
        author: user.uid,
        publicationDate: serverTimestamp(),
      });
      toast({ title: 'Blog post created!' });
    }
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {post ? (
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> New Post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{post ? 'Edit' : 'Create'} Blog Post</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content (HTML supported)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="excerpt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Excerpt</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://example.com/image.png"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Merch Management ---
function MerchManagement() {
  const { firestore } = useFirebase();
  const merchRef = useMemoFirebase(
    () => collection(firestore, 'merchandise'),
    [firestore]
  );
  const { data: merchandise, isLoading } = useCollection(merchRef);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteDocumentNonBlocking(doc(firestore, 'merchandise', id));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Merchandise Management</CardTitle>
          <CardDescription>
            Create, edit, and delete merchandise.
          </CardDescription>
        </div>
        <MerchForm />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>CYBACOIN Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchandise?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>${item.price.toFixed(2)}</TableCell>
                  <TableCell>{item.cybaCoinPrice ?? 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <MerchForm item={item} />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MerchForm({ item }: { item?: any }) {
  const [open, setOpen] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof merchandiseSchema>>({
    resolver: zodResolver(merchandiseSchema),
    defaultValues: item
      ? {
          ...item,
          imageUrl: item.imageUrl || '',
          buyNowUrl: item.buyNowUrl || '',
          cybaCoinPrice: item.cybaCoinPrice ?? undefined,
        }
      : {
          name: '',
          description: '',
          price: 0,
          cybaCoinPrice: undefined,
          imageUrl: '',
          buyNowUrl: '',
          stockQuantity: 0,
        },
  });

  useEffect(() => {
    if (open) {
      if (item) {
        form.reset({
          ...item,
          imageUrl: item.imageUrl || '',
          buyNowUrl: item.buyNowUrl || '',
          cybaCoinPrice: item.cybaCoinPrice ?? undefined,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          price: 0,
          cybaCoinPrice: undefined,
          imageUrl: '',
          buyNowUrl: '',
          stockQuantity: 0,
        });
      }
    }
  }, [item, form, open]);

  const onSubmit = (values: z.infer<typeof merchandiseSchema>) => {
    const dataToSave = {
        ...values,
        cybaCoinPrice: values.cybaCoinPrice || null,
    };

    if (item) {
      setDocumentNonBlocking(doc(firestore, 'merchandise', item.id), dataToSave, {
        merge: true,
      });
      toast({ title: 'Merchandise updated!' });
    } else {
      addDocumentNonBlocking(collection(firestore, 'merchandise'), dataToSave);
      toast({ title: 'Merchandise created!' });
    }
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> New Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit' : 'Create'} Merchandise</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="cybaCoinPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CYBACOIN Price (Optional)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stockQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buyNowUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buy Now URL</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Membership Management ---
function MembershipManagement() {
  const { firestore } = useFirebase();
  const membershipsRef = useMemoFirebase(
    () => collection(firestore, 'memberships'),
    [firestore]
  );
  const { data: memberships, isLoading } = useCollection(membershipsRef);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this membership tier?')) {
      deleteDocumentNonBlocking(doc(firestore, 'memberships', id));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Membership Management</CardTitle>
          <CardDescription>
            Create, edit, and delete membership tiers.
          </CardDescription>
        </div>
        <MembershipForm />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>${item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <MembershipForm item={item} />
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function MembershipForm({ item }: { item?: any }) {
  const [open, setOpen] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const defaultValues = useMemo(() => (item
    ? {
        ...item,
        features: Array.isArray(item.features) ? item.features.join('\n') : '',
      }
    : {
        name: '',
        description: '',
        price: 0,
        features: '',
        buttonText: '',
        buttonLink: '',
      }), [item]);

  const form = useForm<z.infer<typeof membershipSchema>>({
    resolver: zodResolver(membershipSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [form, open, defaultValues]);

  const onSubmit = (values: z.infer<typeof membershipSchema>) => {
    const featuresArray = values.features.split('\n').filter(f => f.trim() !== '');
    const dataToSave = { ...values, features: featuresArray };

    if (item) {
      setDocumentNonBlocking(doc(firestore, 'memberships', item.id), dataToSave, {
        merge: true,
      });
      toast({ title: 'Membership tier updated!' });
    } else {
      addDocumentNonBlocking(collection(firestore, 'memberships'), dataToSave);
      toast({ title: 'Membership tier created!' });
    }
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> New Tier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit' : 'Create'} Membership Tier</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Features (one per line)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={5} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buttonText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button Text</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="buttonLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Button Link</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Extras Management ---
function ExtrasManagement() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const extrasQuery = useMemoFirebase(
    () => query(collection(firestore, 'extras'), orderBy('order')),
    [firestore]
  );
  const { data: extras, isLoading } = useCollection(extrasQuery);

  const boosts = useMemo(() => extras?.filter(e => e.type === 'boost') || [], [extras]);
  const rewards = useMemo(() => extras?.filter(e => e.type === 'reward') || [], [extras]);
  
  const handleDelete = (id: string, name: string) => {
    deleteDocumentNonBlocking(doc(firestore, 'extras', id));
    toast({ title: 'Extra Deleted', description: `"${name}" has been removed.` });
  };

  const handleOrderChange = async (
    item: { id: string; order?: number },
    newOrder: number,
    list: any[]
  ) => {
    const oldOrder = item.order;

    if (oldOrder === newOrder) return;

    const batch = writeBatch(firestore);

    const itemToSwap = list.find(i => i.order === newOrder);

    const currentItemRef = doc(firestore, 'extras', item.id);
    batch.update(currentItemRef, { order: newOrder });

    if (itemToSwap && typeof oldOrder !== 'undefined') {
      const itemToSwapRef = doc(firestore, 'extras', itemToSwap.id);
      batch.update(itemToSwapRef, { order: oldOrder });
    }

    try {
      await batch.commit();
      toast({ title: "Order updated successfully."});
    } catch (e) {
      console.error("Failed to update order:", e);
      toast({ variant: "destructive", title: "Failed to update order."});
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle>Extras Management</CardTitle>
          <CardDescription>
            Create, edit, and manage sort order for boosts and rewards.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <ExtraForm boosts={boosts} rewards={rewards} onDelete={handleDelete} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-2">Boosts</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Sort</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boosts?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>${item.price.toFixed(2)}</TableCell>
                      <TableCell>
                         <Select
                          value={item.order?.toString()}
                          onValueChange={(value) => handleOrderChange(item, parseInt(value), boosts)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue placeholder="Sort" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: boosts.length }, (_, i) => i + 1).map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <ExtraForm item={item} boosts={boosts} rewards={rewards} onDelete={handleDelete} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />
            
             <div>
              <h3 className="text-lg font-medium mb-2">Rewards</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Price (CC)</TableHead>
                    <TableHead>Sort</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.price}</TableCell>
                       <TableCell>
                         <Select
                          value={item.order?.toString()}
                          onValueChange={(value) => handleOrderChange(item, parseInt(value), rewards)}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue placeholder="Sort" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: rewards.length }, (_, i) => i + 1).map(num => (
                              <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <ExtraForm item={item} boosts={boosts} rewards={rewards} onDelete={handleDelete} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExtraForm({ item, boosts = [], rewards = [], onDelete }: { item?: any; boosts?: any[]; rewards?: any[]; onDelete: (id: string, name: string) => void; }) {
  const [open, setOpen] = useState(false);
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const defaultValues = useMemo(() => (item
    ? {
        ...item,
        features: Array.isArray(item.features) ? item.features.join('\n') : '',
      }
    : {
        name: '',
        description: '',
        price: 0,
        features: '',
        buttonText: '',
        buttonLink: '',
        type: 'boost' as 'boost' | 'reward',
      }), [item]);

  const form = useForm<z.infer<typeof extraSchema>>({
    resolver: zodResolver(extraSchema),
    defaultValues,
  });
  
  const type = form.watch('type');

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [form, open, defaultValues]);

  const onSubmit = (values: z.infer<typeof extraSchema>) => {
    const featuresArray = values.features.split('\n').filter(f => f.trim() !== '');
    
    const isNew = !item;
    const typeChanged = !isNew && item.type !== values.type;

    let order;
    if (isNew) {
      order = (values.type === 'boost' ? boosts.length : rewards.length) + 1;
    } else if (typeChanged) {
      order = (values.type === 'boost' ? boosts.length : rewards.length) + 1;
    } else {
      order = item.order;
    }
    
    const dataToSave = { ...values, features: featuresArray, order };

    if (item) {
      setDocumentNonBlocking(doc(firestore, 'extras', item.id), dataToSave, {
        merge: true,
      });
      toast({ title: 'Extra updated!' });
    } else {
      addDocumentNonBlocking(collection(firestore, 'extras'), dataToSave);
      toast({ title: 'Extra created!' });
    }
    setOpen(false);
  };
  
  const handleDeleteClick = () => {
    if (item && onDelete) {
        if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
            onDelete(item.id, item.name);
            setOpen(false);
        }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button variant="outline" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> New Extra
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit' : 'Create'} Extra</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>Primary Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Type</FormLabel>
                            <FormDescription>
                               Is this a paid Boost or a CYBACOIN Reward?
                            </FormDescription>
                          </div>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                                <span className={cn("font-medium", field.value === 'reward' && "text-muted-foreground")}>Boost</span>
                                <Switch
                                    checked={field.value === 'reward'}
                                    onCheckedChange={(checked) => field.onChange(checked ? 'reward' : 'boost')}
                                />
                                 <span className={cn("font-medium", field.value === 'boost' && "text-muted-foreground")}>Reward</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Price (in {type === 'boost' ? 'USD' : 'CYBACOIN'})
                          </FormLabel>
                          <FormControl>
                            <Input type="number" step={type === 'boost' ? '0.01' : '1'} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </CardContent>
            </Card>

            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>Features & Action</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <FormField
                      control={form.control}
                      name="features"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Features (one per line)</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={8} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="buttonText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Text</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="buttonLink"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Button Link</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </CardContent>
            </Card>
            
            <DialogFooter className="col-span-1 md:col-span-2 flex justify-between w-full">
              <div>
                {item && (
                 <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteClick}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </Button>
               )}
              </div>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit">Save</Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Avatar Management ---
function AvatarManagement() {
    const { toast } = useToast();

    // In a real application, you would have forms to upload new assets
    // and modify the `avatar-assets.ts` file or a database.
    // For now, this just displays the current assets.

    return (
        <Card>
            <CardHeader>
                <CardTitle>Avatar Asset Management</CardTitle>
                <CardDescription>
                    Review the current avatar assets. Adding and removing assets requires code changes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {Object.entries(avatarOptions).map(([category, options]) => (
                    <div key={category}>
                        <h3 className="text-lg font-medium capitalize mb-2">{category}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {options.map(option => (
                                <div key={option.name} className="flex flex-col items-center gap-2">
                                    <Image
                                        src={option.url}
                                        alt={option.name}
                                        width={80}
                                        height={80}
                                        className="rounded-md bg-muted/20 border"
                                        data-ai-hint={option.hint}
                                    />
                                    <span className="text-xs text-center">{option.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                 <div className="mt-6 p-4 border-l-4 border-blue-500 bg-blue-500/10 rounded-r-lg">
                    <h4 className="font-semibold text-blue-300">Developer Note</h4>
                    <p className="text-sm text-blue-400/80">
                        To add, remove, or change avatar assets, you must edit the <code className="bg-black/50 px-1 py-0.5 rounded">src/lib/avatar-assets.ts</code> file.
                        This panel is currently for display purposes only.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

// --- Main Admin Panel ---
function AdminPanel() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          Admin Panel
        </h1>
        <p className="text-lg text-foreground/80">
          Welcome to the admin dashboard.
        </p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-4 gap-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="merch">Merchandise</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
          <TabsTrigger value="extras">Extras</TabsTrigger>
          <TabsTrigger value="avatars">Avatars</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>
        <TabsContent value="verification" className="mt-6">
          <UserVerification />
        </TabsContent>
        <TabsContent value="blog" className="mt-6">
          <BlogManagement />
        </TabsContent>
        <TabsContent value="merch" className="mt-6">
          <MerchManagement />
        </TabsContent>
        <TabsContent value="memberships" className="mt-6">
          <MembershipManagement />
        </TabsContent>
        <TabsContent value="extras" className="mt-6">
          <ExtrasManagement />
        </TabsContent>
        <TabsContent value="avatars" className="mt-6">
            <AvatarManagement />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <SettingsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <PasswordForm onSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return <AdminPanel />;
}
