import { storageService } from '@/lib/storage';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; backupfile: string }> },
) {
  const { name, backupfile } = await params;

  try {
    await storageService.deleteBackup(name, backupfile);
    return NextResponse.json({ message: 'Backup deleted' }, { status: 200 });
  } catch (error) {
    console.error('Delete backup error:', error);
    return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
  }
}
