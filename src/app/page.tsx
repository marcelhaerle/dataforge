'use client';

import { useEffect, useState } from 'react';
import { Server, RefreshCw, Plus, HardDrive } from 'lucide-react';
import { DatabaseInstance } from '@/lib/k8s/manager';
import DatabasePanel from '@/components/DatabasePanel';
import DBCreateModal from '@/components/DBCreateModal';

export default function Dashboard() {
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const closeModal = () => {
    setIsCreateModalOpen(false);
    fetchDatabases();
  };

  const fetchDatabases = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/databases');
      const data = await res.json();
      setDatabases(data);
    } catch (error) {
      console.error('Failed to fetch', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial Fetch
  useEffect(() => {
    fetchDatabases();

    const interval = setInterval(fetchDatabases, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* --- Navbar --- */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <HardDrive className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            DataForge <span className="text-indigo-600">Console</span>
          </h1>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Database
        </button>
      </nav>

      {/* --- Main Content --- */}
      <main className="max-w-7xl mx-auto p-8">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Your Instances</h2>
            <p className="text-slate-500">Manage your Kubernetes-hosted databases.</p>
          </div>
          <button
            onClick={fetchDatabases}
            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* --- Empty State --- */}
        {!loading && databases.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <Server className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700">No databases found</h3>
            <p className="text-slate-500 mb-6">
              Start by creating your first managed database instance.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-indigo-600 font-medium hover:underline"
            >
              Create Database &rarr;
            </button>
          </div>
        )}

        {/* --- Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {databases.map((db) => (
            <DatabasePanel db={db} key={db.name} />
          ))}
        </div>
      </main>

      {isCreateModalOpen && <DBCreateModal onClose={closeModal} />}
    </div>
  );
}
