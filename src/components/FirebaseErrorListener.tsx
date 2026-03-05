
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: any) => {
      // In development, we want Next.js to show the error overlay
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
      
      // In production, show a toast
      toast({
        variant: "destructive",
        title: "Erro de Permissão",
        description: "Você não tem autorização para realizar esta ação ou visualizar estes dados.",
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
