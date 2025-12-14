import { DatabaseInstance } from '@/lib/services/database';
import LogViewer from './LogViewer';

export default function LogsTab({ db }: { db: DatabaseInstance }) {
  return <LogViewer dbName={db.name} />;
}
