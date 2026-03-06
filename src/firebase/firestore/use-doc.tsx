'use client';

import { useState, useEffect } from 'react';
import { 
  DocumentReference, 
  onSnapshot, 
  DocumentSnapshot, 
  DocumentData 
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [exists, setExists] = useState<boolean>(false);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<T>) => {
        if (snapshot.exists()) {
          setData({ ...snapshot.data(), id: snapshot.id } as any);
          setExists(true);
        } else {
          setData(null);
          setExists(false);
        }
        setLoading(false);
        setError(null);
      },
      async (err: any) => {
        // Only emit permission error if it's actually a permission issue
        if (err.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
        }

        console.error("Firestore useDoc Error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading, error, exists };
}