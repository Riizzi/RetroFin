import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  writeBatch,
  query,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { BankAccount, Category, Transaction } from './types';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Support custom named database if present in config, otherwise fallback to default
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Sign in with Google Account so mobile and PC share identical Firestore data!
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error('Erro no login com Google:', error);
    throw error;
  }
}

// Sign out
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro ao sair:', error);
  }
}

// Keep user signed in (persists user session across PC and Phone)
export function initAuth(onUserReady: (user: User | null) => void) {
  try {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        onUserReady(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          onUserReady(cred.user);
        } catch (err) {
          console.warn('Anonymous auth offline/fallback:', err);
          onUserReady(null);
        }
      }
    });
  } catch (err) {
    console.warn('initAuth failed:', err);
    onUserReady(null);
    return () => {};
  }
}

// User-scoped document paths
export const getUserDocRef = (userId: string) => doc(db, 'users', userId);
export const getUserAccountsCollection = (userId: string) => collection(db, 'users', userId, 'accounts');
export const getUserTransactionsCollection = (userId: string) => collection(db, 'users', userId, 'transactions');
export const getUserBudgetGoalsCollection = (userId: string) => collection(db, 'users', userId, 'budgetGoals');

// Sync user accounts with Firestore
export async function syncAccountsToCloud(userId: string, accounts: BankAccount[]) {
  try {
    const batch = writeBatch(db);
    accounts.forEach((acc) => {
      const ref = doc(db, 'users', userId, 'accounts', acc.id);
      batch.set(ref, acc);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Sync accounts to cloud notice:', err);
  }
}

// Sync user transactions with Firestore
export async function syncTransactionsToCloud(userId: string, transactions: Transaction[]) {
  try {
    // Firestore batch supports up to 500 writes
    const chunks: Transaction[][] = [];
    for (let i = 0; i < transactions.length; i += 450) {
      chunks.push(transactions.slice(i, i + 450));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((tx) => {
        const ref = doc(db, 'users', userId, 'transactions', tx.id);
        batch.set(ref, tx);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Sync transactions to cloud notice:', err);
  }
}

// Sync user categories with Firestore
export async function syncCategoriesToCloud(userId: string, categories: Category[]) {
  try {
    const batch = writeBatch(db);
    categories.forEach((cat) => {
      const ref = doc(db, 'users', userId, 'budgetGoals', cat.id);
      batch.set(ref, cat);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Sync categories to cloud notice:', err);
  }
}

// Save global monthly budget limit
export async function saveGlobalMonthlyBudget(userId: string, budget: number, month?: string) {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      userId,
      monthlyBudget: budget,
      activeMonth: month || new Date().toISOString().substring(0, 7),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to save monthly budget:', err);
  }
}

// Delete transaction from Firestore
export async function deleteTransactionFromCloud(userId: string, txId: string) {
  try {
    const ref = doc(db, 'users', userId, 'transactions', txId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Failed to delete transaction from cloud:', err);
  }
}

// Delete account from Firestore
export async function deleteAccountFromCloud(userId: string, accId: string) {
  try {
    const ref = doc(db, 'users', userId, 'accounts', accId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Failed to delete account from cloud:', err);
  }
}

// Delete category from Firestore
export async function deleteCategoryFromCloud(userId: string, catId: string) {
  try {
    const ref = doc(db, 'users', userId, 'budgetGoals', catId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('Failed to delete category from cloud:', err);
  }
}

// Clear all user collections in Firestore (for reset)
export async function clearCloudDatabase(userId: string) {
  try {
    const batch = writeBatch(db);
    
    // Fetch and delete accounts
    const accountsSnap = await getDocs(getUserAccountsCollection(userId));
    accountsSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    // Fetch and delete transactions
    const txSnap = await getDocs(getUserTransactionsCollection(userId));
    txSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    // Fetch and delete budget goals (categories)
    const budgetSnap = await getDocs(getUserBudgetGoalsCollection(userId));
    budgetSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
    console.log('[Firestore] Cloud database cleared for user:', userId);
  } catch (err) {
    console.warn('Failed to clear cloud database:', err);
  }
}
