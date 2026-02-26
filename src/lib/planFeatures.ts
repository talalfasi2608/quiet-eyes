/**
 * Frontend feature metadata — Hebrew labels, categories, and plan comparison data.
 * Mirrors backend/config/plans.py for UI display.
 */

export const FEATURE_LABELS_HE: Record<string, string> = {
  leads_scans_per_month: 'סריקות לידים לחודש',
  leads_per_scan: 'לידים לסריקה',
  leads_total_stored: 'לידים שמורים',
  leads_export_csv: 'ייצוא CSV',
  competitors_tracked: 'מתחרים עקובים',
  competitor_deep_analysis: 'ניתוח מתחרים מעמיק',
  competitor_price_tracking: 'מעקב מחירים',
  competitor_job_alerts: 'התראות משרות מתחרים',
  intelligence_scan_per_month: 'סריקות מודיעין לחודש',
  intelligence_history_days: 'היסטוריית מודיעין',
  market_alerts: 'התראות שוק',
  ai_chat_messages_per_month: 'הודעות AI לחודש',
  ai_advisor_templates: 'תבניות יועץ',
  ai_campaign_generator: 'מחולל קמפיינים AI',
  ai_response_generator: 'מחולל תשובות AI',
  weekly_report: 'דוח שבועי',
  custom_reports: 'דוחות מותאמים אישית',
  reports_history: 'היסטוריית דוחות',
  whatsapp_alerts: 'התראות WhatsApp',
  auto_review_response: 'מענה אוטומטי לביקורות',
  morning_briefing: 'תדריך יומי',
  competitor_alerts_realtime: 'התראות מתחרים בזמן אמת',
  cities: 'ערים',
  branches: 'סניפים',
  team_members: 'חברי צוות',
  support_level: 'רמת תמיכה',
  api_access: 'גישת API',
  dedicated_account_manager: 'מנהל לקוח ייעודי',
};

export const FEATURE_CATEGORIES: { category: string; features: string[] }[] = [
  {
    category: 'לידים',
    features: [
      'leads_scans_per_month',
      'leads_per_scan',
      'leads_total_stored',
      'leads_export_csv',
    ],
  },
  {
    category: 'מתחרים',
    features: [
      'competitors_tracked',
      'competitor_deep_analysis',
      'competitor_price_tracking',
      'competitor_job_alerts',
    ],
  },
  {
    category: 'AI ואוטומציה',
    features: [
      'ai_chat_messages_per_month',
      'ai_campaign_generator',
      'ai_response_generator',
      'morning_briefing',
      'auto_review_response',
      'whatsapp_alerts',
      'competitor_alerts_realtime',
    ],
  },
  {
    category: 'דוחות',
    features: [
      'weekly_report',
      'custom_reports',
      'intelligence_history_days',
    ],
  },
  {
    category: 'תמיכה',
    features: [
      'cities',
      'team_members',
      'api_access',
      'dedicated_account_manager',
    ],
  },
];

/** Categorized features table for pricing page comparison (matches backend FEATURES_TABLE) */
export interface ComparisonFeature {
  key: string;
  name: string;
  free: string | boolean;
  starter: string | boolean;
  pro: string | boolean;
  business: string | boolean;
}

export interface ComparisonCategory {
  category: string;
  features: ComparisonFeature[];
}

export const FEATURES_TABLE: ComparisonCategory[] = [
  {
    category: 'לידים',
    features: [
      { key: 'leads_scans_per_month', name: 'סריקות לידים לחודש', free: '3', starter: '30', pro: '200', business: 'ללא הגבלה' },
      { key: 'leads_per_scan', name: 'לידים לסריקה', free: '5', starter: '15', pro: '30', business: 'ללא הגבלה' },
      { key: 'leads_total_stored', name: 'לידים שמורים', free: '50', starter: '500', pro: '5,000', business: 'ללא הגבלה' },
      { key: 'leads_export_csv', name: 'ייצוא CSV', free: false, starter: true, pro: true, business: true },
    ],
  },
  {
    category: 'מתחרים',
    features: [
      { key: 'competitors_tracked', name: 'מתחרים עקובים', free: '1', starter: '3', pro: '10', business: 'ללא הגבלה' },
      { key: 'competitor_deep_analysis', name: 'ניתוח מתחרים מעמיק', free: false, starter: true, pro: true, business: true },
      { key: 'competitor_price_tracking', name: 'מעקב מחירים', free: false, starter: false, pro: true, business: true },
      { key: 'competitor_job_alerts', name: 'התראות משרות מתחרים', free: false, starter: false, pro: true, business: true },
    ],
  },
  {
    category: 'AI ואוטומציה',
    features: [
      { key: 'ai_chat_messages_per_month', name: 'הודעות AI לחודש', free: '10', starter: '100', pro: '500', business: 'ללא הגבלה' },
      { key: 'ai_campaign_generator', name: 'מחולל קמפיינים AI', free: false, starter: false, pro: true, business: true },
      { key: 'ai_response_generator', name: 'מחולל תשובות AI', free: false, starter: false, pro: true, business: true },
      { key: 'morning_briefing', name: 'תדריך יומי', free: false, starter: true, pro: true, business: true },
      { key: 'auto_review_response', name: 'מענה אוטומטי לביקורות', free: false, starter: false, pro: true, business: true },
      { key: 'whatsapp_alerts', name: 'התראות WhatsApp', free: false, starter: false, pro: true, business: true },
      { key: 'competitor_alerts_realtime', name: 'התראות מתחרים בזמן אמת', free: false, starter: false, pro: true, business: true },
    ],
  },
  {
    category: 'דוחות',
    features: [
      { key: 'weekly_report', name: 'דוח שבועי', free: false, starter: true, pro: true, business: true },
      { key: 'custom_reports', name: 'דוחות מותאמים אישית', free: false, starter: false, pro: true, business: true },
      { key: 'intelligence_history_days', name: 'היסטוריית מודיעין', free: '7 ימים', starter: '30 ימים', pro: '90 ימים', business: 'ללא הגבלה' },
    ],
  },
  {
    category: 'תמיכה',
    features: [
      { key: 'cities', name: 'ערים', free: '1', starter: '1', pro: '3', business: 'ללא הגבלה' },
      { key: 'team_members', name: 'חברי צוות', free: '1', starter: '1', pro: '3', business: 'ללא הגבלה' },
      { key: 'api_access', name: 'גישת API', free: false, starter: false, pro: false, business: true },
      { key: 'dedicated_account_manager', name: 'מנהל לקוח ייעודי', free: false, starter: false, pro: false, business: true },
    ],
  },
];
