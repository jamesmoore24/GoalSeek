import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('plaid_connected, plaid_institution_name, plaid_last_sync_at, plaid_sync_enabled, plaid_share_account_names, plaid_share_transaction_details, plaid_share_balances')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({
    connected: integration?.plaid_connected || false,
    institutionName: integration?.plaid_institution_name,
    lastSyncAt: integration?.plaid_last_sync_at,
    settings: integration ? {
      plaid_sync_enabled: integration.plaid_sync_enabled ?? true,
      plaid_share_account_names: integration.plaid_share_account_names ?? true,
      plaid_share_transaction_details: integration.plaid_share_transaction_details ?? true,
      plaid_share_balances: integration.plaid_share_balances ?? true,
    } : null,
  });
}
