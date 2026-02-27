'use client';
import { redirect } from 'next/navigation';

export default function OldMerchPage() {
  redirect('/shop');
  return null;
}
