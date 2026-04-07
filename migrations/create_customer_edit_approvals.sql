-- Create customer_edit_approvals table for TSM approval workflow
CREATE TABLE IF NOT EXISTS customer_edit_approvals (
    id SERIAL PRIMARY KEY,
    account_id VARCHAR(255) NOT NULL,
    tsm_reference_id VARCHAR(255) NOT NULL,
    original_data JSONB NOT NULL,
    proposed_changes JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    edited_by VARCHAR(255) NOT NULL,
    edited_by_name VARCHAR(255),
    approved_by VARCHAR(255),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customer_edit_approvals_tsm ON customer_edit_approvals(tsm_reference_id);
CREATE INDEX IF NOT EXISTS idx_customer_edit_approvals_status ON customer_edit_approvals(status);
CREATE INDEX IF NOT EXISTS idx_customer_edit_approvals_account ON customer_edit_approvals(account_id);
