CREATE TABLE IF NOT EXISTS partner_enquiries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  organisation varchar(255) NOT NULL,
  role varchar(160),
  country varchar(120) NOT NULL,
  email varchar(255) NOT NULL,
  interest varchar(80) NOT NULL,
  message text NOT NULL,
  stage varchar(40) NOT NULL DEFAULT 'new',
  referrer varchar(500),
  utm_source varchar(120),
  utm_medium varchar(120),
  utm_campaign varchar(120),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_enquiries_stage_created ON partner_enquiries(stage, created_at);
CREATE INDEX IF NOT EXISTS idx_partner_enquiries_email ON partner_enquiries(email);

CREATE TABLE IF NOT EXISTS partner_outreach_events (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_name varchar(80) NOT NULL,
  path varchar(300) NOT NULL,
  interest varchar(80),
  utm_source varchar(120),
  utm_medium varchar(120),
  utm_campaign varchar(120),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_events_name_created ON partner_outreach_events(event_name, created_at);
