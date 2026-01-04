import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createLinkToken } from '@/lib/plaid';

export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const linkToken = await createLinkToken(user.id);
    return NextResponse.json({ link_token: linkToken });
  } catch (error) {
    console.error('[Plaid] Link token creation failed:', error);
    return NextResponse.json({ error: 'Failed to create link token' }, { status: 500 });
  }
}
