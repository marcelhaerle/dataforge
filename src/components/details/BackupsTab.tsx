import { DatabaseInstance } from '@/lib/services/database';
import { BackupFile } from '@/lib/storage';
import { CloudUpload, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface BackupsTabProps {
  db: DatabaseInstance;
  backups: BackupFile[];
}

export default function BackupsTab({ db, backups }: BackupsTabProps) {
  const [isBackupTriggering, setIsBackupTriggering] = useState(false);

  const handleManualBackup = async () => {
    if (!confirm('Start manual backup to S3?')) return;
    setIsBackupTriggering(true);
    try {
      const res = await fetch(`/api/databases/${db.name}/backups`, { method: 'POST' });
      if (res.ok) {
        alert('Backup Job started!');
      } else {
        alert('Failed to start backup');
      }
    } finally {
      setIsBackupTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="text-sm text-slate-500">
          Scheduled:{' '}
          <span className="font-mono bg-slate-200 px-1 rounded">{db.backupSchedule || '-'}</span>
        </div>
        <button
          onClick={handleManualBackup}
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
                    <button className="text-indigo-600 hover:underline text-xs font-medium mr-3">
                      Restore
                    </button>
                    <button className="text-slate-400 hover:text-red-600">
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
  );
}
