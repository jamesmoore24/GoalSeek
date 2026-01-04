import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { exchangePublicToken, getInstitutionInfo, syncAllPlaidData } from '@/lib/plaid';
import { z } from 'zod';

const callbackSchema = z.object({
  public_token: z.string(),
  institution: z.object({
    institution_id: z.string(),
    name: z.string(),
  }).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request
  let body: z.infer<typeof callbackSchema>;
  try {
    body = callbackSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    // Exchange public token for access token
    const { accessToken, itemId } = await exchangePublicToken(body.public_token);

    // Get institution info
    let institutionName = body.institution?.name;
    if (body.institution?.institution_id && !institutionName) {
      const info = await getInstitutionInfo(body.institution.institution_id);
      institutionName = info?.name;
    }

    // Store in database
    const { error: dbError } = await supabase
      .from('user_integrations')
      .upsert({
        user_id: user.id,
        plaid_connected: true,
        plaid_access_token: accessToken,
        plaid_item_id: itemId,
        plaid_institution_id: body.institution?.institution_id,
        plaid_institution_name: institutionName,
        plaid_last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (dbError) {
      console.error('[Plaid] Database error:', dbError);
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }

    // Trigger initial sync (don't await - let it run in background)
    syncAllPlaidData(user.id).catch(err => {
      console.error('[Plaid] Initial sync error:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Plaid] Token exchange failed:', error);
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 500 });
  }
}
