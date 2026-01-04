import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { createClient } from '@/lib/supabase/server';
import type {
  PlaidAccount,
  PlaidTransaction,
  PlaidHolding,
  PlaidLiability,
  FinancialSummary,
  PlaidIntegrationData,
} from '@/types/plaid';

// ============================================
// PLAID CLIENT CONFIGURATION
// ============================================

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID!;
const PLAID_SECRET = process.env.PLAID_SECRET!;
const PLAID_ENV = (process.env.PLAID_ENV || 'sandbox') as keyof typeof PlaidEnvironments;

const configuration = new Configuration({
  basePath: PlaidEnvironments[PLAID_ENV],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

// ============================================
// INTEGRATION DATA RETRIEVAL
// ============================================

async function getIntegration(userId: string): Promise<PlaidIntegrationData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('plaid_connected', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as PlaidIntegrationData;
}

// ============================================
// LINK TOKEN CREATION (for Plaid Link widget)
// ============================================

export async function createLinkToken(userId: string): Promise<string> {
  const productsStr = process.env.PLAID_PRODUCTS || 'transactions';
  const products = productsStr.split(',') as Products[];
  const countryCodesStr = process.env.PLAID_COUNTRY_CODES || 'US';
  const countryCodes = countryCodesStr.split(',') as CountryCode[];

  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'GoalSeek',
    products,
    country_codes: countryCodes,
    language: 'en',
  });

  return response.data.link_token;
}

// ============================================
// ACCESS TOKEN EXCHANGE
// ============================================

export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
}> {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

// ============================================
// INSTITUTION INFO
// ============================================

export async function getInstitutionInfo(institutionId: string): Promise<{
  name: string;
  logo?: string;
} | null> {
  try {
    const response = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    });

    return {
      name: response.data.institution.name,
      logo: response.data.institution.logo || undefined,
    };
  } catch (error) {
    console.error('[Plaid] Error getting institution:', error);
    return null;
  }
}

// ============================================
// ACCOUNT DATA FETCHING
// ============================================

export async function syncAccounts(userId: string): Promise<PlaidAccount[]> {
  const integration = await getIntegration(userId);
  if (!integration || !integration.plaid_access_token) return [];

  try {
    const response = await plaidClient.accountsGet({
      access_token: integration.plaid_access_token,
    });

    const supabase = await createClient();
    const accounts: PlaidAccount[] = [];

    for (const account of response.data.accounts) {
      const accountData = {
        user_id: userId,
        plaid_account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        current_balance: account.balances.current,
        available_balance: account.balances.available,
        limit_balance: account.balances.limit,
        iso_currency_code: account.balances.iso_currency_code || 'USD',
        institution_id: response.data.item.institution_id,
        last_updated_at: new Date().toISOString(),
      };

      await supabase
        .from('plaid_accounts')
        .upsert(accountData, { onConflict: 'user_id,plaid_account_id' });

      accounts.push(accountData as PlaidAccount);
    }

    return accounts;
  } catch (error) {
    console.error('[Plaid] Error syncing accounts:', error);
    return [];
  }
}

// ============================================
// TRANSACTION DATA FETCHING
// ============================================

export async function syncTransactions(userId: string, days: number = 30): Promise<PlaidTransaction[]> {
  const integration = await getIntegration(userId);
  if (!integration || !integration.plaid_access_token) return [];

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await plaidClient.transactionsGet({
      access_token: integration.plaid_access_token,
      start_date: startDate.toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      options: { count: 500 },
    });

    const supabase = await createClient();
    const transactions: PlaidTransaction[] = [];

    for (const txn of response.data.transactions) {
      const txnData = {
        user_id: userId,
        plaid_transaction_id: txn.transaction_id,
        plaid_account_id: txn.account_id,
        name: txn.name,
        merchant_name: txn.merchant_name,
        amount: txn.amount,
        iso_currency_code: txn.iso_currency_code || 'USD',
        date: txn.date,
        datetime: txn.datetime,
        category: txn.category,
        category_id: txn.category_id,
        primary_category: txn.category?.[0],
        location_city: txn.location?.city,
        location_region: txn.location?.region,
        pending: txn.pending,
        transaction_type: txn.transaction_type,
      };

      await supabase
        .from('plaid_transactions')
        .upsert(txnData, { onConflict: 'user_id,plaid_transaction_id' });

      transactions.push(txnData as PlaidTransaction);
    }

    return transactions;
  } catch (error) {
    console.error('[Plaid] Error syncing transactions:', error);
    return [];
  }
}

// ============================================
// INVESTMENT DATA FETCHING
// ============================================

export async function syncInvestments(userId: string): Promise<PlaidHolding[]> {
  const integration = await getIntegration(userId);
  if (!integration || !integration.plaid_access_token) return [];

  try {
    const response = await plaidClient.investmentsHoldingsGet({
      access_token: integration.plaid_access_token,
    });

    const supabase = await createClient();
    const holdings: PlaidHolding[] = [];

    // Create security lookup map
    const securities = new Map(
      response.data.securities.map(s => [s.security_id, s])
    );

    for (const holding of response.data.holdings) {
      const security = securities.get(holding.security_id);

      const holdingData = {
        user_id: userId,
        plaid_account_id: holding.account_id,
        plaid_security_id: holding.security_id,
        security_name: security?.name,
        security_ticker: security?.ticker_symbol,
        security_type: security?.type,
        quantity: holding.quantity,
        institution_price: holding.institution_price,
        institution_value: holding.institution_value,
        cost_basis: holding.cost_basis,
        iso_currency_code: holding.iso_currency_code || 'USD',
        last_updated_at: new Date().toISOString(),
      };

      await supabase
        .from('plaid_holdings')
        .upsert(holdingData, { onConflict: 'user_id,plaid_account_id,plaid_security_id' });

      holdings.push(holdingData as PlaidHolding);
    }

    return holdings;
  } catch (error) {
    console.error('[Plaid] Error syncing investments:', error);
    return [];
  }
}

// ============================================
// LIABILITIES DATA FETCHING
// ============================================

export async function syncLiabilities(userId: string): Promise<PlaidLiability[]> {
  const integration = await getIntegration(userId);
  if (!integration || !integration.plaid_access_token) return [];

  try {
    const response = await plaidClient.liabilitiesGet({
      access_token: integration.plaid_access_token,
    });

    const supabase = await createClient();
    const liabilities: PlaidLiability[] = [];

    // Process credit liabilities
    for (const credit of response.data.liabilities.credit || []) {
      const liabilityData = {
        user_id: userId,
        plaid_account_id: credit.account_id!,
        liability_type: 'credit' as const,
        last_statement_balance: credit.last_statement_balance,
        last_statement_date: credit.last_statement_issue_date,
        minimum_payment: credit.minimum_payment_amount,
        next_payment_due_date: credit.next_payment_due_date,
        apr_percentage: credit.aprs?.[0]?.apr_percentage,
        last_updated_at: new Date().toISOString(),
      };

      await supabase
        .from('plaid_liabilities')
        .upsert(liabilityData, { onConflict: 'user_id,plaid_account_id' });

      liabilities.push(liabilityData as PlaidLiability);
    }

    // Process student loans
    for (const student of response.data.liabilities.student || []) {
      const liabilityData = {
        user_id: userId,
        plaid_account_id: student.account_id!,
        liability_type: 'student' as const,
        origination_principal: student.origination_principal_amount,
        outstanding_balance: student.outstanding_interest_amount,
        interest_rate: student.interest_rate_percentage,
        next_payment_due_date: student.next_payment_due_date,
        minimum_payment: student.minimum_payment_amount,
        last_updated_at: new Date().toISOString(),
      };

      await supabase
        .from('plaid_liabilities')
        .upsert(liabilityData, { onConflict: 'user_id,plaid_account_id' });

      liabilities.push(liabilityData as PlaidLiability);
    }

    // Process mortgages
    for (const mortgage of response.data.liabilities.mortgage || []) {
      const liabilityData = {
        user_id: userId,
        plaid_account_id: mortgage.account_id!,
        liability_type: 'mortgage' as const,
        origination_principal: mortgage.origination_principal_amount,
        outstanding_balance: mortgage.current_late_fee,
        interest_rate: mortgage.interest_rate?.percentage,
        loan_term_months: mortgage.loan_term ? parseInt(mortgage.loan_term) : undefined,
        next_payment_due_date: mortgage.next_payment_due_date,
        last_updated_at: new Date().toISOString(),
      };

      await supabase
        .from('plaid_liabilities')
        .upsert(liabilityData, { onConflict: 'user_id,plaid_account_id' });

      liabilities.push(liabilityData as PlaidLiability);
    }

    return liabilities;
  } catch (error) {
    console.error('[Plaid] Error syncing liabilities:', error);
    return [];
  }
}

// ============================================
// FULL SYNC (all data types)
// ============================================

export async function syncAllPlaidData(userId: string): Promise<void> {
  const integration = await getIntegration(userId);
  if (!integration || !integration.plaid_sync_enabled) return;

  await Promise.all([
    syncAccounts(userId),
    syncTransactions(userId, 30),
    syncInvestments(userId),
    syncLiabilities(userId),
  ]);

  // Update last sync time
  const supabase = await createClient();
  await supabase
    .from('user_integrations')
    .update({ plaid_last_sync_at: new Date().toISOString() })
    .eq('user_id', userId);
}

// ============================================
// GET CACHED DATA (from database)
// ============================================

export async function getPlaidAccounts(userId: string): Promise<PlaidAccount[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('plaid_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('type', { ascending: true });

  if (error) {
    console.error('[Plaid] Error getting accounts:', error);
    return [];
  }

  return data || [];
}

export async function getPlaidTransactions(
  userId: string,
  days: number = 30
): Promise<PlaidTransaction[]> {
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('plaid_transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) {
    console.error('[Plaid] Error getting transactions:', error);
    return [];
  }

  return data || [];
}

export async function getPlaidHoldings(userId: string): Promise<PlaidHolding[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('plaid_holdings')
    .select('*')
    .eq('user_id', userId)
    .order('institution_value', { ascending: false });

  if (error) {
    console.error('[Plaid] Error getting holdings:', error);
    return [];
  }

  return data || [];
}

export async function getPlaidLiabilities(userId: string): Promise<PlaidLiability[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('plaid_liabilities')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[Plaid] Error getting liabilities:', error);
    return [];
  }

  return data || [];
}

// ============================================
// FINANCIAL SUMMARY (for LLM context)
// ============================================

export async function getFinancialSummary(userId: string): Promise<FinancialSummary | null> {
  const supabase = await createClient();

  // Check if plaid is connected and enabled
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('plaid_connected, plaid_sync_enabled, plaid_last_sync_at, plaid_institution_name, plaid_share_account_names, plaid_share_transaction_details, plaid_share_balances')
    .eq('user_id', userId)
    .single();

  if (!integration?.plaid_connected || !integration?.plaid_sync_enabled) return null;

  const [accounts, transactions, holdings, liabilities] = await Promise.all([
    getPlaidAccounts(userId),
    getPlaidTransactions(userId, 30),
    getPlaidHoldings(userId),
    getPlaidLiabilities(userId),
  ]);

  // Calculate totals
  let totalCash = 0;
  let totalCredit = 0;
  let totalInvestments = 0;
  let totalLiabilities = 0;

  for (const account of accounts) {
    const balance = account.current_balance || 0;
    switch (account.type) {
      case 'depository':
        totalCash += balance;
        break;
      case 'credit':
        totalCredit += balance;
        break;
      case 'investment':
        totalInvestments += balance;
        break;
      case 'loan':
        totalLiabilities += balance;
        break;
    }
  }

  // Investment holdings value
  const investmentValue = holdings.reduce((sum, h) => sum + (h.institution_value || 0), 0);

  // Spending by category (last 30 days)
  const spendingByCategory: Record<string, number> = {};
  let totalSpending30Days = 0;
  let totalIncome30Days = 0;

  for (const txn of transactions) {
    if (txn.amount > 0) {
      // Positive = spending
      totalSpending30Days += txn.amount;
      const category = txn.primary_category || 'Uncategorized';
      spendingByCategory[category] = (spendingByCategory[category] || 0) + txn.amount;
    } else {
      // Negative = income
      totalIncome30Days += Math.abs(txn.amount);
    }
  }

  // Upcoming payments
  const upcomingPayments = liabilities
    .filter(l => l.next_payment_due_date && l.minimum_payment)
    .map(l => {
      const account = accounts.find(a => a.plaid_account_id === l.plaid_account_id);
      return {
        accountName: account?.name || 'Unknown',
        amount: l.minimum_payment!,
        dueDate: l.next_payment_due_date!,
      };
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return {
    totalCash,
    totalCredit,
    totalInvestments: investmentValue || totalInvestments,
    totalLiabilities,
    netWorth: totalCash + investmentValue - totalCredit - totalLiabilities,
    accounts: integration.plaid_share_account_names ? accounts : [],
    recentTransactions: integration.plaid_share_transaction_details ? transactions.slice(0, 20) : [],
    spendingByCategory,
    totalSpending30Days,
    totalIncome30Days,
    holdings: integration.plaid_share_balances ? holdings : [],
    investmentValue,
    liabilities,
    upcomingPayments,
    lastSyncAt: integration.plaid_last_sync_at || new Date().toISOString(),
    institutionName: integration.plaid_institution_name || undefined,
  };
}

// ============================================
// LLM CONTEXT FORMATTER
// ============================================

export function formatFinancesForLLM(summary: FinancialSummary): string {
  const formatMoney = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  let output = `## Financial Overview${summary.institutionName ? ` (${summary.institutionName})` : ''}\n\n`;

  // Net Worth Summary
  output += `### Net Worth: ${formatMoney(summary.netWorth)}\n`;
  output += `- Cash & Checking: ${formatMoney(summary.totalCash)}\n`;
  output += `- Investments: ${formatMoney(summary.investmentValue)}\n`;
  output += `- Credit Card Debt: ${formatMoney(summary.totalCredit)}\n`;
  output += `- Loans & Liabilities: ${formatMoney(summary.totalLiabilities)}\n\n`;

  // Accounts Breakdown
  if (summary.accounts.length > 0) {
    output += `### Accounts\n`;
    for (const account of summary.accounts) {
      const balance = account.current_balance || 0;
      output += `- ${account.name} (${account.subtype || account.type}): ${formatMoney(balance)}`;
      if (account.available_balance !== account.current_balance && account.available_balance) {
        output += ` (${formatMoney(account.available_balance)} available)`;
      }
      output += '\n';
    }
    output += '\n';
  }

  // Monthly Cash Flow
  output += `### Monthly Cash Flow (Last 30 Days)\n`;
  output += `- Income: ${formatMoney(summary.totalIncome30Days)}\n`;
  output += `- Spending: ${formatMoney(summary.totalSpending30Days)}\n`;
  output += `- Net: ${formatMoney(summary.totalIncome30Days - summary.totalSpending30Days)}\n\n`;

  // Spending by Category
  if (Object.keys(summary.spendingByCategory).length > 0) {
    output += `### Spending by Category\n`;
    const sortedCategories = Object.entries(summary.spendingByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [category, amount] of sortedCategories) {
      output += `- ${category}: ${formatMoney(amount)}\n`;
    }
    output += '\n';
  }

  // Recent Transactions
  if (summary.recentTransactions.length > 0) {
    output += `### Recent Transactions\n`;
    for (const txn of summary.recentTransactions.slice(0, 10)) {
      const date = new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const name = txn.merchant_name || txn.name;
      output += `- ${date}: ${name} - ${formatMoney(txn.amount)}${txn.pending ? ' (pending)' : ''}\n`;
    }
    output += '\n';
  }

  // Investment Holdings
  if (summary.holdings.length > 0) {
    output += `### Investment Holdings\n`;
    for (const holding of summary.holdings.slice(0, 10)) {
      const ticker = holding.security_ticker ? `(${holding.security_ticker})` : '';
      output += `- ${holding.security_name || 'Unknown'} ${ticker}: ${holding.quantity.toFixed(4)} shares @ ${formatMoney(holding.institution_value || 0)}\n`;
    }
    output += '\n';
  }

  // Upcoming Payments
  if (summary.upcomingPayments.length > 0) {
    output += `### Upcoming Payments\n`;
    for (const payment of summary.upcomingPayments) {
      const dueDate = new Date(payment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      output += `- ${payment.accountName}: ${formatMoney(payment.amount)} due ${dueDate}\n`;
    }
    output += '\n';
  }

  output += `*Last synced: ${new Date(summary.lastSyncAt).toLocaleString()}*`;

  return output;
}
