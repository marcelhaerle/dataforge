import { DatabaseInstance } from '@/lib/services/database';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsTab({ db }: { db: DatabaseInstance }) {
  const router = useRouter();

  const handleDelete = async () => {
    const confirmName = prompt(`To confirm deletion, type "${db.name}":`);
    if (confirmName !== db.name) return;

    try {
      await fetch(`/api/databases/${db.name}`, { method: 'DELETE' });
      router.push('/');
    } catch (e) {
      console.error(e);
      alert('Delete failed');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm">
      <h3 className="font-semibold text-red-700 mb-2">Danger Zone</h3>
      <p className="text-slate-600 text-sm mb-6">
        Deleting this database will remove all data (PVC) and potentially all backups from S3. This
        action cannot be undone.
      </p>
      <button
        onClick={handleDelete}
        className="border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete Database
      </button>
    </div>
  );
}
