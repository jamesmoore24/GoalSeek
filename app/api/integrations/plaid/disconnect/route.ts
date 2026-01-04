import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';

export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get access token to remove item
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('plaid_access_token')
    .eq('user_id', user.id)
    .single();

  // Remove item from Plaid
  if (integration?.plaid_access_token) {
    try {
      await plaidClient.itemRemove({
        access_token: integration.plaid_access_token,
      });
    } catch (error) {
      console.error('[Plaid] Failed to remove item:', error);
      // Continue anyway - we still want to clear local data
    }
  }

  // Clear Plaid data from database
  await Promise.all([
    supabase.from('user_integrations').update({
      plaid_connected: false,
      plaid_access_token: null,
      plaid_item_id: null,
      plaid_institution_id: null,
      plaid_institution_name: null,
      plaid_last_sync_at: null,
    }).eq('user_id', user.id),
    supabase.from('plaid_accounts').delete().eq('user_id', user.id),
    supabase.from('plaid_transactions').delete().eq('user_id', user.id),
    supabase.from('plaid_holdings').delete().eq('user_id', user.id),
    supabase.from('plaid_liabilities').delete().eq('user_id', user.id),
  ]);

  return NextResponse.json({ success: true });
}
