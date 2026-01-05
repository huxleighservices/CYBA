
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
} from '@/components/ui/card';
import {
  Shield,
  PlusCircle,
  Trash2,
  Edit,
  Loader2,
  Link2,
  Database,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useFirebase,
  useCollection,
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
import { seedInitialExtras } from '@/firebase/seed';

// Schemas
const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
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
                // If the input is cleared, unlink the user
                const dataToUpdate = {
                    leaderboardCybaName: '',
                    cybaCoinBalance: 0,
                };
                setDocumentNonBlocking(userDocRef, dataToUpdate, { merge: true });
                toast({
                    title: "User Unlinked!",
                    description: `Cybacoin balance has been reset.`
                });
                return;
            }

            const selectedEntry = leaderboardData.find(
                (entry) => entry.cybaName?.toLowerCase() === leaderboardName.toLowerCase()
            );

            if (selectedEntry) {
                const cybaCoinBalance = selectedEntry.cybaCoin;
                const dataToUpdate = {
                    leaderboardCybaName: selectedEntry.cybaName, // Use the canonical name
                    cybaCoinBalance: Number(cybaCoinBalance) || 0,
                };
                setDocumentNonBlocking(userDocRef, dataToUpdate, { merge: true });
                toast({
                    title: "User Linked!",
                    description: `Cybacoin balance for ${selectedEntry.cybaName} updated to ${dataToUpdate.cybaCoinBalance}.`
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
                    Link website users to their leaderboard records by typing the exact CybaName. The link and Cybacoin balance will update automatically.
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
      // Update
      setDocumentNonBlocking(doc(firestore, 'blogPosts', post.id), values, {
        merge: true,
      });
      toast({ title: 'Blog post updated!' });
    } else {
      // Create
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
                <TableHead>Cybacoin Price</TableHead>
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
        cybaCoinPrice: values.cybaCoinPrice || null, // Store null if empty
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
                  <FormLabel>Cybacoin Price (Optional)</FormLabel>
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
  const [isSeeding, setIsSeeding] = useState(false);

  const extrasQuery = useMemoFirebase(
    () => query(collection(firestore, 'extras'), orderBy('order')),
    [firestore]
  );
  const { data: extras, isLoading } = useCollection(extrasQuery);

  const boosts = useMemo(() => extras?.filter(e => e.type === 'boost') || [], [extras]);
  const rewards = useMemo(() => extras?.filter(e => e.type === 'reward') || [], [extras]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteDocumentNonBlocking(doc(firestore, 'extras', id));
    }
  };

  const handleSeedData = async () => {
    if (!confirm('Are you sure you want to delete all existing extras and re-seed the database? This action cannot be undone.')) {
      return;
    }
    setIsSeeding(true);
    try {
      await seedInitialExtras(firestore);
      toast({ title: "Database Seeded!", description: "Boosts and Rewards have been reset to their initial state." });
    } catch (e) {
      console.error("Seeding failed:", e);
      toast({ variant: "destructive", title: "Seeding Failed", description: "Could not seed the database. Check the console for errors." });
    } finally {
      setIsSeeding(false);
    }
  }

  const handleOrderChange = async (
    item: { id: string; order?: number },
    newOrder: number,
    list: any[]
  ) => {
    const oldOrder = item.order;

    if (oldOrder === newOrder) return; // No change

    const batch = writeBatch(firestore);

    // Find the item that currently has the newOrder
    const itemToSwap = list.find(i => i.order === newOrder);

    // Update the dragged item
    const currentItemRef = doc(firestore, 'extras', item.id);
    batch.update(currentItemRef, { order: newOrder });

    // Update the item that was in the target position, if it exists
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
           <Button variant="outline" onClick={handleSeedData} disabled={isSeeding}>
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Seed Database
            </Button>
          <ExtraForm boosts={boosts} rewards={rewards} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-8">
            {/* Boosts Table */}
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
                        <ExtraForm item={item} boosts={boosts} rewards={rewards} />
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
            </div>

            <Separator />
            
            {/* Rewards Table */}
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
                        <ExtraForm item={item} boosts={boosts} rewards={rewards} />
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={(e) => {e.stopPropagation(); handleDelete(item.id)}}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

function ExtraForm({ item, boosts = [], rewards = [] }: { item?: any; boosts?: any[]; rewards?: any[]; }) {
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
    const dataToSave = { ...values, features: featuresArray };

    if (item) {
      setDocumentNonBlocking(doc(firestore, 'extras', item.id), dataToSave, {
        merge: true,
      });
      toast({ title: 'Extra updated!' });
    } else {
      // New item gets the last order number
      const newOrder = (dataToSave.type === 'boost' ? boosts.length : rewards.length) + 1;
      dataToSave.order = newOrder;
      
      addDocumentNonBlocking(collection(firestore, 'extras'), dataToSave);
      toast({ title: 'Extra created!' });
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
            {/* Left Card */}
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
                               Is this a paid Boost or a Cybacoin Reward?
                            </FormDescription>
                          </div>
                          <FormControl>
                            <div className="flex items-center space-x-2">
                                <span className={cn("font-medium", field.value === 'reward' && "text-muted-foreground")}>Boost</span>
                                <Switch
                                    checked={field.value === 'reward'}
                                    onCheckedChange={(checked) => field.onChange(checked ? 'reward' : 'boost')}
                                    disabled={!!item} // Cannot change type after creation
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
                            Price (in {type === 'boost' ? 'USD' : 'Cybacoin'})
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

            {/* Right Card */}
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

            {/* Footer remains at the bottom */}
            <DialogFooter className="col-span-1 md:col-span-2">
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="merch">Merchandise</TabsTrigger>
          <TabsTrigger value="memberships">Memberships</TabsTrigger>
          <TabsTrigger value="extras">Extras</TabsTrigger>
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

    