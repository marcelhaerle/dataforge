import { deleteDatabase, getDatabaseDetails } from '@/lib/k8s/manager';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const name = (await params).name;
    const db = await getDatabaseDetails(name);
    return NextResponse.json(db);
  } catch (error) {
    console.error('Error fetching database details:', error);
    return NextResponse.json({ error: 'Database not found' }, { status: 404 });
  }
}

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
