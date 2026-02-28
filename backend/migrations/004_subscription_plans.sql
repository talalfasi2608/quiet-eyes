-- Migration: Add subscription plan fields to users/businesses
-- Quieteyes plan system: free, starter, growth, pro

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS
  subscription_plan VARCHAR(20) DEFAULT 'free';

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS
  billing_cycle VARCHAR(10) DEFAULT 'monthly';

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS
  plan_started_at TIMESTAMP;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS
  plan_ends_at TIMESTAMP;

-- Agent runs tracking table
CREATE TABLE IF NOT EXISTS agent_runs (
  id BIGSERIAL PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  agent_key VARCHAR(30) NOT NULL,
  agent_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'running',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  results_summary TEXT,
  items_found INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_business ON agent_runs(business_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_key);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started ON agent_runs(started_at DESC);

-- WhatsApp message templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id SERIAL PRIMARY KEY,
  template_key VARCHAR(50) UNIQUE NOT NULL,
  template_text TEXT NOT NULL,
  variables TEXT[], -- list of variable names like {name}, {count}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default templates
INSERT INTO whatsapp_templates (template_key, template_text, variables) VALUES
('morning_brief', E'בוקר טוב {name} ☀️\n\nהנה מה שקרה בלילה:\n\n{body}\n\nדבר אחד שכדאי לעשות היום:\n→ {action}\n\nיום נהדר 🙂\n👉 {link}', ARRAY['name', 'body', 'action', 'link']),
('hot_lead', E'{name}, שמתי לב 🎯\n\nמישהו כתב עכשיו שהוא מחפש {what}.\n\nכדאי לפנות בשעה הקרובה —\nהכנתי לך תגובה מוכנה:\n\n---\n{reply_text}\n---\n\n👉 ראה את הפוסט: {link}', ARRAY['name', 'what', 'reply_text', 'link']),
('competitor_change', E'{name}, קרה משהו 👀\n\n{competitor} {change}.\n\nמה זה אומר בשבילך?\n{explanation}\n\nמה שאני ממליץ:\n→ {recommendation}\n\n👉 {link}', ARRAY['name', 'competitor', 'change', 'explanation', 'recommendation', 'link']),
('new_competitor', E'{name}, שמתי לב למשהו חדש 🆕\n\nעסק בשם \u0027{competitor_name}\u0027 נפתח לאחרונה {distance} ממך.\n\nמה אני יודע עליהם:\n{details}\n\n💡 {recommendation}\n\n👉 {link}', ARRAY['name', 'competitor_name', 'distance', 'details', 'recommendation', 'link']),
('weekly_report', E'{name}, הדוח השבועי שלך מוכן 📊\n\nשבוע {dates}:\n✅ {leads} לידים נמצאו\n👀 {changes} שינויים אצל מתחרים\n💡 {insights} תובנות חדשות\n❤️ ציון בריאות: {score}/100\n\n{trend_msg}\n\n👉 דוח מלא: {link}', ARRAY['name', 'dates', 'leads', 'changes', 'insights', 'score', 'trend_msg', 'link']),
('trial_expiring', E'{name}, עוד 2 ימים 👋\n\n6 העוזרים שלך ב-12 הימים האחרונים:\n🎯 {leads} לידים נמצאו בשבילך\n👀 {changes} שינויים אצל מתחרים זוהו\n💡 {insights} תובנות שוק\n\nאם לא תשדרג — הם יעצרו.\nלא רוצים שתפספס את זה.\n\n👉 שדרג עכשיו: {link}\n(קוד הנחה: UPGRADE99)', ARRAY['name', 'leads', 'changes', 'insights', 'link'])
ON CONFLICT (template_key) DO NOTHING;
