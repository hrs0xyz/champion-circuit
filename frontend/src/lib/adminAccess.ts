import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';

/**
 * Admin access is controlled by Firestore document existence:
 * admins/{uid} => { role: "admin", enabled: true, ... }
 */
export async function isFirestoreAdmin(user: User | null): Promise<boolean> {
  if (!user || !db) return false;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    if (!snap.exists()) return false;
    const data = snap.data() as { enabled?: boolean; role?: string } | undefined;
    if (!data) return true;
    if (data.enabled === false) return false;
    return data.role ? data.role === 'admin' : true;
  } catch {
    return false;
  }
}

