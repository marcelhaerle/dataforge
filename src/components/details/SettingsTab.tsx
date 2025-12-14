'use client';

import { useToast } from '@/app/context/ToastContext';
import { DatabaseInstance } from '@/lib/services/database';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ConfirmModal from '../ConfirmModal';

export default function SettingsTab({ db }: { db: DatabaseInstance }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const router = useRouter();
  const { addToast } = useToast();

  const handleDelete = async () => {
    setShowDeleteConfirm(false);

    try {
      await fetch(`/api/databases/${db.name}`, { method: 'DELETE' });
      addToast({ type: 'success', title: 'Deleted', message: 'Database deleted successfully' });
      router.push('/');
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Delete Failed', message: 'Error deleting database' });
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Database?"
        message={`Do you really want to delete the database "${db.name}"? This action cannot be undone.`}
        confirmText="Yes, delete database"
        variant="danger"
      />

      <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
        <h3 className="font-semibold text-red-700 mb-2">Danger Zone</h3>
        <p className="text-slate-600 text-sm mb-6">
          Deleting this database will remove all data (PVC) and potentially all backups from S3.
          This action cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete Database
        </button>
      </div>
    </>
  );
}
