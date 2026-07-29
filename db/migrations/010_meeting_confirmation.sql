-- Meeting confirmation gate — never claim booked until confirmed
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;

ALTER TABLE meetings
  ADD CONSTRAINT meetings_status_check
  CHECK (status IN (
    'pending_confirmation',
    'scheduled',
    'confirmed',
    'completed',
    'no_show',
    'cancelled'
  ));

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE meetings
  ALTER COLUMN status SET DEFAULT 'pending_confirmation';
