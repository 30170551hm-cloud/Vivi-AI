import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { signOut, deleteUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { FirestoreEntities } from '@/lib/firebaseEntities';

// Account deletion flow required by Google Play Store policy.
// Wipes user-owned data (memories, chat history) then signs out.
export default function AccountDeletion() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]} */
  const [error, setError] = useState(null);

  /**
   * @param {React.MouseEvent<HTMLButtonElement>} e
   */
  const handleDelete = async (e) => {
    e.preventDefault();
    setDeleting(true);
    setError(null);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await Promise.all([
          // FirestoreEntities has scopedToOwner:true by default, so deleteMany({})
          // automatically adds where('ownerId','==', currentUser.uid) — only this
          // user's documents are deleted.
          FirestoreEntities.Memory.deleteMany({}),
          FirestoreEntities.ChatMessage.deleteMany({}),
        ]);
        await deleteUser(currentUser);
      }
      await signOut(auth);
    } catch {
      setError('No se pudo completar la eliminación. Intenta de nuevo.');
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-red-950/40 border border-red-500/30 hover:bg-red-900/40 text-red-300 text-sm font-medium transition-colors touch-manipulation select-none"
      >
        <Trash2 className="w-4 h-4" /> Eliminar cuenta
      </button>

      <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setDeleting(false); setError(null); } }}>
        <AlertDialogContent className="bg-[#0b0713] border-red-500/30 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" /> Eliminar cuenta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Esta acción es <span className="text-red-300 font-medium">permanente e irreversible</span>. Se eliminarán:
              <ul className="mt-2 ml-4 list-disc space-y-1 text-white/50">
                <li>Tus memorias guardadas</li>
                <li>Tu historial de conversaciones</li>
                <li>Tus preferencias personales de voz e idioma</li>
              </ul>
              <p className="mt-3 text-red-300/80 text-sm font-medium">No podrás recuperar estos datos después de confirmar.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-red-400 text-sm px-1 -mt-2">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="select-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white select-none"
            >
              {deleting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Eliminando...</>
                : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}