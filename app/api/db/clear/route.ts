import { initDb, clearAllData } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    await initDb();
    await clearAllData();
    return Response.json({ success: true, message: 'All data cleared successfully' });
  } catch (err) {
    console.error('[DELETE /api/db/clear]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
