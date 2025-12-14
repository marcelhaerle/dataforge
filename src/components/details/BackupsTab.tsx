import { useToast } from '@/app/context/ToastContext';
import { DatabaseInstance } from '@/lib/services/database';
import { BackupFile } from '@/lib/storage';
import { CloudUpload, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ConfirmModal from '../ConfirmModal';

interface BackupsTabProps {
  db: DatabaseInstance;
  backups: BackupFile[];
  onDeleteBackup: (backupFile: string) => void;
}

export default function BackupsTab({ db, backups, onDeleteBackup }: BackupsTabProps) {
  const [isBackupTriggering, setIsBackupTriggering] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<string | null>(null);

  const { addToast } = useToast();

  const handleManualBackup = async () => {
    setIsBackupTriggering(true);
    setShowBackupConfirm(false);

    try {
      const res = await fetch(`/api/databases/${db.name}/backups`, { method: 'POST' });
      if (res.ok) {
        addToast({ type: 'success', title: 'Backup Started', message: 'Backup Job started!' });
      } else {
        addToast({ type: 'error', title: 'Backup Failed', message: 'Failed to start backup' });
      }
    } finally {
      setIsBackupTriggering(false);
    }
  };

  const handleStartRestore = (backupfile: string) => {
    setSelectedBackupFile(backupfile);
    setShowConfirmRestore(true);
  };

  const handleRestore = async () => {
    setShowConfirmRestore(false);
    try {
      const res = await fetch(`/api/databases/${db.name}/backups/${selectedBackupFile}`, {
        method: 'PUT',
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Restore Started', message: 'Restore Job started!' });
      } else {
        addToast({ type: 'error', title: 'Restore Failed', message: 'Failed to start restore' });
      }
    } catch (error) {
      console.error('Restore error:', error);
      addToast({ type: 'error', title: 'Restore Failed', message: 'Failed to start restore' });
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showBackupConfirm}
        onClose={() => setShowBackupConfirm(false)}
        onConfirm={handleManualBackup}
        title="Start Manual Backup?"
        message={`Do you really want to trigger an immediate backup for "${db.name}" to S3 storage?`}
        confirmText="Yes, start backup"
        variant="info"
      />

      <ConfirmModal
        isOpen={showConfirmRestore}
        onClose={() => setShowConfirmRestore(false)}
        onConfirm={() => handleRestore(/* pass the backupfile here */)}
        title="Start Database Restore?"
        message={`Do you really want to trigger an immediate restore for "${db.name}" from this backup? This will overwrite the current database contents.`}
        confirmText="Yes, start restore"
        variant="info"
      />

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="text-sm text-slate-500">
            Scheduled:{' '}
            <span className="font-mono bg-slate-200 px-1 rounded">{db.backupSchedule || '-'}</span>
          </div>
          <button
            onClick={() => setShowBackupConfirm(true)}
            disabled={isBackupTriggering || db.status !== 'Running'}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isBackupTriggering ? (
              <RefreshCw className="animate-spin w-4 h-4" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            Trigger Backup Now
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Filename</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Created At</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    No backups found yet.
                  </td>
                </tr>
              ) : (
                backups.map((bk) => (
                  <tr key={bk.key} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-mono text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      {bk.filename}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{bk.sizeMb} MB</td>
                    <td className="px-6 py-3 text-slate-600">
                      {new Date(bk.lastModified).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        className="text-indigo-600 hover:underline text-xs font-medium mr-3"
                        onClick={() => handleStartRestore(bk.filename)}
                      >
                        Restore
                      </button>
                      <button
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => onDeleteBackup(bk.filename)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
