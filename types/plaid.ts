// ============================================
// PLAID INTEGRATION TYPES
// ============================================

// Account types
export interface PlaidAccount {
  id: string;
  user_id: string;
  plaid_account_id: string;
  name: string;
  official_name?: string;
  type: 'depository' | 'credit' | 'loan' | 'investment' | 'other';
  subtype?: string;
  mask?: string;
  current_balance?: number;
  available_balance?: number;
  limit_balance?: number;
  iso_currency_code: string;
  institution_id?: string;
  last_updated_at: string;
}

// Transaction types
export interface PlaidTransaction {
  id: string;
  user_id: string;
  plaid_transaction_id: string;
  plaid_account_id: string;
  name: string;
  merchant_name?: string;
  amount: number;
  iso_currency_code: string;
  date: string;
  datetime?: string;
  category?: string[];
  category_id?: string;
  primary_category?: string;
  location_city?: string;
  location_region?: string;
  pending: boolean;
  transaction_type?: string;
}

// Investment holding types
export interface PlaidHolding {
  id: string;
  user_id: string;
  plaid_account_id: string;
  plaid_security_id: string;
  security_name?: string;
  security_ticker?: string;
  security_type?: string;
  quantity: number;
  institution_price?: number;
  institution_value?: number;
  cost_basis?: number;
  iso_currency_code: string;
  last_updated_at: string;
}

// Liability types
export interface PlaidLiability {
  id: string;
  user_id: string;
  plaid_account_id: string;
  liability_type: 'credit' | 'student' | 'mortgage' | 'auto';
  last_statement_balance?: number;
  last_statement_date?: string;
  minimum_payment?: number;
  next_payment_due_date?: string;
  apr_percentage?: number;
  origination_principal?: number;
  outstanding_balance?: number;
  interest_rate?: number;
  loan_term_months?: number;
  last_updated_at: string;
}

// Aggregated financial summary for LLM
export interface FinancialSummary {
  // Account totals
  totalCash: number;
  totalCredit: number;
  totalInvestments: number;
  totalLiabilities: number;
  netWorth: number;

  // Account breakdown
  accounts: PlaidAccount[];

  // Recent spending
  recentTransactions: PlaidTransaction[];
  spendingByCategory: Record<string, number>;
  totalSpending30Days: number;
  totalIncome30Days: number;

  // Investments
  holdings: PlaidHolding[];
  investmentValue: number;

  // Liabilities
  liabilities: PlaidLiability[];
  upcomingPayments: Array<{
    accountName: string;
    amount: number;
    dueDate: string;
  }>;

  // Metadata
  lastSyncAt: string;
  institutionName?: string;
}

// Integration settings
export interface PlaidSettings {
  plaid_sync_enabled: boolean;
  plaid_share_account_names: boolean;
  plaid_share_transaction_details: boolean;
  plaid_share_balances: boolean;
}

// Plaid integration data from user_integrations table
export interface PlaidIntegrationData {
  user_id: string;
  plaid_connected: boolean;
  plaid_access_token?: string;
  plaid_item_id?: string;
  plaid_institution_id?: string;
  plaid_institution_name?: string;
  plaid_last_sync_at?: string;
  plaid_sync_enabled: boolean;
  plaid_share_account_names: boolean;
  plaid_share_transaction_details: boolean;
  plaid_share_balances: boolean;
}

// API response types
export interface PlaidStatusResponse {
  connected: boolean;
  institutionName?: string;
  lastSyncAt?: string;
  settings?: PlaidSettings;
}

export interface PlaidLinkTokenResponse {
  link_token: string;
}

export interface PlaidCallbackRequest {
  public_token: string;
  institution?: {
    institution_id: string;
    name: string;
  };
}
