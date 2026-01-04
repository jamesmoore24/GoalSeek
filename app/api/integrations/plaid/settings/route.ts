import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const settingsSchema = z.object({
  plaid_sync_enabled: z.boolean().optional(),
  plaid_share_account_names: z.boolean().optional(),
  plaid_share_transaction_details: z.boolean().optional(),
  plaid_share_balances: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof settingsSchema>;
  try {
    body = settingsSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const updates: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No settings to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('user_integrations')
    .update(updates)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
