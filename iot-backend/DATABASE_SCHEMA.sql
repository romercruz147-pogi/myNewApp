// Database initialization guide
// This file documents the Supabase PostgreSQL schema for Romers Vendo

// ============================================
// TABLE: devices
// Purpose: Store IoT device information and authentication
// ============================================
CREATE TABLE devices (
  -- System ID (UUID primary key)
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Device Identification
  device_id TEXT UNIQUE NOT NULL,           -- Unique identifier (e.g., "romers_001")
  device_secret_hash TEXT NOT NULL,         -- Bcrypt hash of device secret
  
  -- Ownership
  owner TEXT,                               -- Email or user identifier
  status TEXT DEFAULT 'active',             -- 'active', 'disabled', 'revoked'
  
  -- Device Information
  name TEXT,                                -- Custom display name
  device_name TEXT,                        -- Alternative name field
  
  -- Connection Tracking
  last_ip TEXT,                             -- Last known IP address
  last_seen TIMESTAMP,                      -- Last connection timestamp
  
  -- Flexible Metadata
  metadata JSONB,                           -- JSON data: timer, money, status, etc.
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_owner ON devices(owner);
CREATE INDEX idx_devices_status ON devices(status);

// ============================================
// TABLE: transactions
// Purpose: Log all coin/credit transactions
// ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  transaction_id TEXT UNIQUE,               -- Unique transaction identifier
  
  credits_added NUMERIC DEFAULT 0,          -- Credit amount
  pulse_count INTEGER DEFAULT 0,            -- Coin pulses received
  amount NUMERIC DEFAULT 0,                 -- Monetary amount
  source TEXT DEFAULT 'coin',               -- 'coin', 'mobile', 'manual'
  
  metadata JSONB,                           -- Additional transaction data
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_transactions_device_id ON transactions(device_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);

// ============================================
// TABLE: timer_logs
// Purpose: Track timer usage and events
// ============================================
CREATE TABLE timer_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  event_type TEXT,                         -- 'start', 'stop', 'pause', 'resume', 'heartbeat'
  
  remaining_time INTEGER DEFAULT 0,        -- Seconds remaining
  total_time_used INTEGER DEFAULT 0,       -- Total seconds used
  
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_timer_logs_device_id ON timer_logs(device_id);

// ============================================
// TABLE: sales_logs
// Purpose: Track daily sales and earnings
// ============================================
CREATE TABLE sales_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  sales_today INTEGER DEFAULT 0,            -- Number of transactions today
  total_earnings NUMERIC DEFAULT 0,         -- Total money earned
  
  metadata JSONB,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_sales_logs_device_id ON sales_logs(device_id);

// ============================================
// TABLE: device_events
// Purpose: Queue commands and events for devices
// ============================================
CREATE TABLE device_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  device_id TEXT NOT NULL REFERENCES devices(device_id),
  event_type TEXT NOT NULL,                -- 'command:relay_on', 'command:reset', etc.
  
  payload JSONB,                            -- Command parameters
  processed BOOLEAN DEFAULT FALSE,          -- Has device processed this?
  
  created_at TIMESTAMP DEFAULT now(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_device_events_device_id ON device_events(device_id);
CREATE INDEX idx_device_events_processed ON device_events(processed);

// ============================================
// SETUP INSTRUCTIONS
// ============================================

// 1. Go to https://supabase.com and create a project
// 2. In Project Dashboard, go to SQL Editor
// 3. Create a new query and run each CREATE TABLE statement
// 4. Verify tables are created in the Database Browser
// 5. Get SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Settings → API
// 6. Add to .env file
