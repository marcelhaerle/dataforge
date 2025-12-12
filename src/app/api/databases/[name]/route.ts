import { deleteDatabase } from '@/lib/k8s/manager';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const name = (await params).name;

    await deleteDatabase(name);

    return NextResponse.json({ message: 'Database deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting database:', error);
    return NextResponse.json({ error: 'Failed to delete database' }, { status: 500 });
  }
}
