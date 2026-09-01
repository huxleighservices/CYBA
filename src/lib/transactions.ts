import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

export type TransactionType =
  | 'quest_reward'
  | 'wheel_spin'
  | 'reward_purchase'
  | 'boost_purchase'
  | 'merch_purchase'
  | 'support_bonus'
  | 'post_bonus'
  | 'admin_adjustment'
  | 'post_reward'
  | 'engagement_reward'
  | 'quest_media_payout'
  | 'market_purchase'
  | 'boost_subscription'
  | 'ad_skip'
  | 'ad_watch_reward'
  | 'promo_renewal_bonus';

export type CashTransactionType =
  | 'quest_payout'
  | 'cashout_request'
  | 'cashout_fulfilled'
  | 'admin_adjustment'
  | 'market_purchase'
  | 'promo_blast_purchase';

export interface CoinTransaction {
  type: TransactionType;
  amount: number; // positive = earned, negative = spent
  description: string;
}

export interface CashTransaction {
  type: CashTransactionType;
  amount: number; // positive = earned, negative = withdrawn
  description: string;
}

export async function logTransaction(
  firestore: Firestore,
  userId: string,
  tx: CoinTransaction
): Promise<void> {
  try {
    await addDoc(
      collection(firestore, 'users', userId, 'coinTransactions'),
      { ...tx, timestamp: serverTimestamp() }
    );
  } catch {
    // Non-critical — never throw
  }
}

export async function logCashTransaction(
  firestore: Firestore,
  userId: string,
  tx: CashTransaction
): Promise<void> {
  try {
    await addDoc(
      collection(firestore, 'users', userId, 'cashTransactions'),
      { ...tx, timestamp: serverTimestamp() }
    );
  } catch {
    // Non-critical — never throw
  }
}
