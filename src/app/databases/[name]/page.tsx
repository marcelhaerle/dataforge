'use client';

import { useCallback, useEffect, useState } from 'react';
import { redirect, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { DatabaseInstance } from '@/lib/k8s/manager';
import StatusBadge from '@/components/StatusBadge';
import DBIcon from '@/components/DBIcon';
import { BackupFile } from '@/lib/storage';
import OverviewTab from '@/components/details/OverviewTab';
import BackupsTab from '@/components/details/BackupsTab';
import LogsTab from '@/components/details/LogsTab';
import SettingsTab from '@/components/details/SettingsTab';

export default function DatabaseDetailPage() {
  const params = useParams();

  const dbName = params.name as string;

  const [db, setDb] = useState<DatabaseInstance | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dbRes, backupsRes] = await Promise.all([
        fetch(`/api/databases/${dbName}`),
        fetch(`/api/databases/${dbName}/backups`),
      ]);

      if (!dbRes.ok) throw new Error('DB not found');

      setDb(await dbRes.json());

      if (backupsRes.ok) {
        setBackups(await backupsRes.json());
      }
    } catch (error) {
      console.error(error);
      redirect('/');
    } finally {
      setLoading(false);
    }
  }, [dbName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteBackup = async (backupFile: string) => {
    if (!db) return;

    try {
      const res = await fetch(`/api/databases/${db.name}/backups/${backupFile}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to delete backup');
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      alert('An error occurred while deleting the backup');
    }
  }

  if (loading)
    return (
      <div className="h-screen bg-slate-50 p-10 flex justify-center">
        <div className="m-auto">
          <RefreshCw className="animate-spin text-slate-400" />
        </div>
      </div>
    );
  if (!db) return <div className="p-10 text-center">Database not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-4 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>

          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <DBIcon type={db.type} />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{db.name}</h1>
                <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
                  <span className="capitalize">{db.type}</span>
                  <span>•</span>
                  <span className="font-mono bg-slate-100 px-1.5 rounded text-slate-600">
                    {db.internalDbName}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={db.status} />
              <button
                onClick={fetchData}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-6 mt-8 border-b border-slate-100 -mb-1px">
            {['overview', 'backups', 'logs', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as string)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize
                  ${activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-8">
        {activeTab === 'overview' && <OverviewTab db={db} />}
        {activeTab === 'backups' && <BackupsTab db={db} backups={backups} onDeleteBackup={handleDeleteBackup} />}
        {activeTab === 'logs' && <LogsTab db={db} />}
        {activeTab === 'settings' && <SettingsTab db={db} />}
      </div>
    </div>
  );
}
