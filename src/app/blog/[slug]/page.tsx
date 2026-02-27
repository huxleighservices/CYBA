'use client';
import { redirect } from 'next/navigation';

export default function OldBlogPostPage({ params }: { params: { slug: string } }) {
  redirect(`/post/${params.slug}`);
  return null;
}
