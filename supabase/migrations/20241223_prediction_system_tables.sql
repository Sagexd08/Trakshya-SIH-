-- Migration: Create tables for three-layer prediction system
-- Created: 2024-12-23
-- Description: Sets up train_delay_history and prediction_accuracy tables with proper indexes

-- Create train_delay_history table (if not already exists)
-- This table stores historical delay data for LSTM training and real-time persistence
CREATE TABLE IF NOT EXISTS train_delay_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  train_id TEXT NOT NULL,
  delay_minutes NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  station_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create prediction_accuracy table for tracking ML model performance
-- This table stores prediction records and their accuracy scores after evaluation
CREATE TABLE IF NOT EXISTS prediction_accuracy (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  train_id TEXT NOT NULL,
  predicted_delay NUMERIC NOT NULL,
  actual_delay NUMERIC,
  horizon_minutes INTEGER NOT NULL,
  prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accuracy_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for optimal query performance
-- train_delay_history indexes
CREATE INDEX IF NOT EXISTS idx_tdh_train_timestamp 
  ON train_delay_history(train_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tdh_timestamp 
  ON train_delay_history(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tdh_station_timestamp 
  ON train_delay_history(station_code, timestamp DESC) 
  WHERE station_code IS NOT NULL;

-- prediction_accuracy indexes
CREATE INDEX IF NOT EXISTS idx_pa_horizon_timestamp 
  ON prediction_accuracy(horizon_minutes, prediction_timestamp);

CREATE INDEX IF NOT EXISTS idx_pa_train_timestamp 
  ON prediction_accuracy(train_id, prediction_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_pa_evaluation_pending 
  ON prediction_accuracy(horizon_minutes, prediction_timestamp) 
  WHERE actual_delay IS NULL;

CREATE INDEX IF NOT EXISTS idx_pa_accuracy_stats 
  ON prediction_accuracy(horizon_minutes, prediction_timestamp DESC) 
  WHERE accuracy_score IS NOT NULL;

-- Add RLS (Row Level Security) policies if needed
-- Enable RLS on both tables
ALTER TABLE train_delay_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_accuracy ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users (adjust based on your auth setup)
CREATE POLICY IF NOT EXISTS "Allow authenticated read access" 
  ON train_delay_history FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated write access" 
  ON train_delay_history FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated read access" 
  ON prediction_accuracy FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated write access" 
  ON prediction_accuracy FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow authenticated update access" 
  ON prediction_accuracy FOR UPDATE 
  TO authenticated 
  USING (true);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER IF NOT EXISTS update_train_delay_history_updated_at 
  BEFORE UPDATE ON train_delay_history 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_prediction_accuracy_updated_at 
  BEFORE UPDATE ON prediction_accuracy 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE train_delay_history IS 'Historical train delay data for LSTM training and real-time tracking';
COMMENT ON TABLE prediction_accuracy IS 'ML prediction accuracy tracking and evaluation data';

COMMENT ON COLUMN train_delay_history.train_id IS 'Unique identifier for the train';
COMMENT ON COLUMN train_delay_history.delay_minutes IS 'Delay in minutes (positive for delays, negative for early)';
COMMENT ON COLUMN train_delay_history.station_code IS 'IRCTC station code where delay was recorded';

COMMENT ON COLUMN prediction_accuracy.train_id IS 'Unique identifier for the train';
COMMENT ON COLUMN prediction_accuracy.predicted_delay IS 'ML model predicted delay in minutes';
COMMENT ON COLUMN prediction_accuracy.actual_delay IS 'Actual delay observed (filled after horizon elapsed)';
COMMENT ON COLUMN prediction_accuracy.horizon_minutes IS 'Prediction horizon in minutes (5, 15, 30)';
COMMENT ON COLUMN prediction_accuracy.accuracy_score IS 'Computed accuracy score (0-1, higher is better)';
