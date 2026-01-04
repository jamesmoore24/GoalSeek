-- ============================================
-- PLAID FINANCIAL INTEGRATION
-- Adds columns to user_integrations + caching tables
-- ============================================

-- Add Plaid columns to user_integrations
ALTER TABLE user_integrations
ADD COLUMN IF NOT EXISTS plaid_connected BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plaid_access_token TEXT,
ADD COLUMN IF NOT EXISTS plaid_item_id TEXT,
ADD COLUMN IF NOT EXISTS plaid_institution_id TEXT,
ADD COLUMN IF NOT EXISTS plaid_institution_name TEXT,
ADD COLUMN IF NOT EXISTS plaid_last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plaid_sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS plaid_share_account_names BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS plaid_share_transaction_details BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS plaid_share_balances BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================
-- PLAID ACCOUNTS CACHE
-- Stores linked account information
-- ============================================
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plaid_account_id TEXT NOT NULL,

  -- Account info
  name TEXT NOT NULL,
  official_name TEXT,
  type TEXT NOT NULL, -- depository, credit, loan, investment, other
  subtype TEXT, -- checking, savings, credit card, mortgage, etc.
  mask TEXT, -- last 4 digits

  -- Current balance
  current_balance DECIMAL(15, 2),
  available_balance DECIMAL(15, 2),
  limit_balance DECIMAL(15, 2), -- for credit cards
  iso_currency_code TEXT DEFAULT 'USD',

  -- Metadata
  institution_id TEXT,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, plaid_account_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user ON plaid_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_type ON plaid_accounts(user_id, type);

-- ============================================
-- PLAID TRANSACTIONS CACHE
-- Stores recent transactions (rolling 30 days)
-- ============================================
CREATE TABLE IF NOT EXISTS plaid_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT NOT NULL,
  plaid_account_id TEXT NOT NULL,

  -- Transaction details
  name TEXT NOT NULL,
  merchant_name TEXT,
  amount DECIMAL(15, 2) NOT NULL, -- positive = debit, negative = credit
  iso_currency_code TEXT DEFAULT 'USD',
  date DATE NOT NULL,
  datetime TIMESTAMPTZ,

  -- Categorization
  category TEXT[], -- Plaid category hierarchy
  category_id TEXT,
  primary_category TEXT,

  -- Location (optional)
  location_city TEXT,
  location_region TEXT,

  -- Metadata
  pending BOOLEAN NOT NULL DEFAULT FALSE,
  transaction_type TEXT, -- place, digital, special, unresolved

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, plaid_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_transactions_user_date ON plaid_transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_account ON plaid_transactions(user_id, plaid_account_id);
CREATE INDEX IF NOT EXISTS idx_plaid_transactions_category ON plaid_transactions(user_id, primary_category);

-- ============================================
-- PLAID INVESTMENTS CACHE
-- Stores investment holdings
-- ============================================
CREATE TABLE IF NOT EXISTS plaid_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plaid_account_id TEXT NOT NULL,
  plaid_security_id TEXT NOT NULL,

  -- Security info
  security_name TEXT,
  security_ticker TEXT,
  security_type TEXT, -- equity, etf, mutual fund, cash, etc.

  -- Holding details
  quantity DECIMAL(20, 8) NOT NULL,
  institution_price DECIMAL(15, 4),
  institution_value DECIMAL(15, 2),
  cost_basis DECIMAL(15, 2),
  iso_currency_code TEXT DEFAULT 'USD',

  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, plaid_account_id, plaid_security_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_holdings_user ON plaid_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_holdings_account ON plaid_holdings(user_id, plaid_account_id);

-- ============================================
-- PLAID LIABILITIES CACHE
-- Stores credit, loan, and mortgage details
-- ============================================
CREATE TABLE IF NOT EXISTS plaid_liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plaid_account_id TEXT NOT NULL,

  -- Liability type
  liability_type TEXT NOT NULL, -- credit, student, mortgage, auto

  -- Credit card specific
  last_statement_balance DECIMAL(15, 2),
  last_statement_date DATE,
  minimum_payment DECIMAL(15, 2),
  next_payment_due_date DATE,
  apr_percentage DECIMAL(5, 2),

  -- Loan specific
  origination_principal DECIMAL(15, 2),
  outstanding_balance DECIMAL(15, 2),
  interest_rate DECIMAL(5, 4),
  loan_term_months INTEGER,

  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, plaid_account_id)
);

CREATE INDEX IF NOT EXISTS idx_plaid_liabilities_user ON plaid_liabilities(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_liabilities ENABLE ROW LEVEL SECURITY;

-- Accounts policies
CREATE POLICY "Users can view own plaid accounts" ON plaid_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plaid accounts" ON plaid_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plaid accounts" ON plaid_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plaid accounts" ON plaid_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own plaid transactions" ON plaid_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plaid transactions" ON plaid_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plaid transactions" ON plaid_transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plaid transactions" ON plaid_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Holdings policies
CREATE POLICY "Users can view own plaid holdings" ON plaid_holdings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plaid holdings" ON plaid_holdings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plaid holdings" ON plaid_holdings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plaid holdings" ON plaid_holdings
  FOR DELETE USING (auth.uid() = user_id);

-- Liabilities policies
CREATE POLICY "Users can view own plaid liabilities" ON plaid_liabilities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plaid liabilities" ON plaid_liabilities
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plaid liabilities" ON plaid_liabilities
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plaid liabilities" ON plaid_liabilities
  FOR DELETE USING (auth.uid() = user_id);
