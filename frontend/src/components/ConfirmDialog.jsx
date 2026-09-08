import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

/** Confirm-before-delete dialog. Usage: const [confirm, node] = useConfirm(); await confirm({...}) */
export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));

  const close = (ok) => {
    state?.resolve(ok);
    setState(null);
  };

  const node = (
    <AlertDialog open={!!state} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent data-testid="confirm-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="confirm-title">{state?.title || 'Are you sure?'}</AlertDialogTitle>
          <AlertDialogDescription data-testid="confirm-description">
            {state?.description || 'Are you sure you want to delete this entry? This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)} data-testid="confirm-cancel-btn">Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => close(true)} data-testid="confirm-delete-btn">
            {state?.actionLabel || 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [confirm, node];
}
