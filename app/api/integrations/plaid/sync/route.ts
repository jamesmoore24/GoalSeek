import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { syncAllPlaidData } from '@/lib/plaid';

export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await syncAllPlaidData(user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Plaid] Sync failed:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
