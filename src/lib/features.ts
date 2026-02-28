/**
 * Plan feature flags for Quieteyes
 * Controls what each subscription tier can access
 */

export type PlanTier = 'free' | 'starter' | 'growth' | 'pro';

export interface PlanFeatures {
  leads_per_month: number; // -1 = unlimited
  competitors_limit: number; // -1 = unlimited
  scan_frequency_hours: number;
  whatsapp_alerts: boolean;
  agents: string[];
  reports: false | 'weekly' | 'weekly+monthly' | 'weekly+monthly+quarterly';
  learning: false | true | 'deep';
  priority_support?: boolean;
}

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  free: {
    leads_per_month: 5,
    competitors_limit: 3,
    scan_frequency_hours: 24,
    whatsapp_alerts: false,
    agents: ['eyeni_basic'],
    reports: false,
    learning: false,
  },
  starter: {
    leads_per_month: -1,
    competitors_limit: 15,
    scan_frequency_hours: 6,
    whatsapp_alerts: true,
    agents: ['eyeni_full', 'hamoa_basic'],
    reports: 'weekly',
    learning: false,
  },
  growth: {
    leads_per_month: -1,
    competitors_limit: 30,
    scan_frequency_hours: 2,
    whatsapp_alerts: true,
    agents: ['eyeni_full', 'hamoa_full', 'hakol_full', 'hakis_basic'],
    reports: 'weekly+monthly',
    learning: true,
  },
  pro: {
    leads_per_month: -1,
    competitors_limit: -1,
    scan_frequency_hours: 0.5,
    whatsapp_alerts: true,
    agents: [
      'eyeni_premium', 'hamoa_premium',
      'hakol_premium', 'hakis_full',
      'haozen_full', 'hatavach_full',
    ],
    reports: 'weekly+monthly+quarterly',
    learning: 'deep',
    priority_support: true,
  },
};

export const PLAN_INFO: Record<PlanTier, { name: string; nameEn: string; monthlyPrice: number; annualPrice: number }> = {
  free: { name: 'חינמי', nameEn: 'FREE', monthlyPrice: 0, annualPrice: 0 },
  starter: { name: 'מתחיל', nameEn: 'STARTER', monthlyPrice: 149, annualPrice: 119 },
  growth: { name: 'צומח', nameEn: 'GROWTH', monthlyPrice: 279, annualPrice: 224 },
  pro: { name: 'שולט', nameEn: 'PRO', monthlyPrice: 449, annualPrice: 359 },
};

export const AGENT_INFO: Record<string, { name: string; emoji: string; tagline: string; description: string }> = {
  eyeni: {
    name: 'עיני',
    emoji: '👁️',
    tagline: 'עוקב בשבילך על מה שקורה בחוץ',
    description: 'סורק פייסבוק, גוגל ואינסטגרם. כשמישהו מחפש את השירות שלך — אתה יודע תוך דקות.',
  },
  hamoa: {
    name: 'המוח',
    emoji: '🧠',
    tagline: 'חושב בשבילך כשאתה עסוק',
    description: 'כל בוקר מחכים לך 3 דברים לעשות. לא רשימה ארוכה — רק מה שבאמת יזיז את העסק שלך היום.',
  },
  hakol: {
    name: 'הקול',
    emoji: '📢',
    tagline: 'מדבר ללקוחות שלך כשאין לך זמן',
    description: 'כל שבוע מחכים לך פוסטים מוכנים, מבוססים על מה שהלקוחות שלך מחפשים עכשיו.',
  },
  hakis: {
    name: 'הכיס',
    emoji: '💰',
    tagline: 'שומר שלא תפספס אף שקל',
    description: 'כשמשהו עומד להשפיע על ההכנסות שלך — תדע מראש. לא אחרי שכבר קרה.',
  },
  haozen: {
    name: 'האוזן',
    emoji: '👂',
    tagline: 'מקשיב ללקוחות שלך בשבילך',
    description: 'מה הלקוחות רוצים שעדיין לא קיים? איפה המתחרים כושלים? האוזן מקשיב בשבילך.',
  },
  hatavach: {
    name: 'הטווח',
    emoji: '🔭',
    tagline: 'מסתכל לאן השוק הולך',
    description: 'מגמה חדשה? עסק חדש שעומד לפתוח? שינוי שמגיע לאזורך? תדע חודש לפני שזה קורה.',
  },
};

/**
 * Check if a given plan has access to a specific agent
 */
export function hasAgentAccess(plan: PlanTier, agentKey: string): boolean {
  const features = PLAN_FEATURES[plan];
  return features.agents.some(a => a.startsWith(agentKey));
}

/**
 * Get the minimum plan required for a specific agent
 */
export function getMinPlanForAgent(agentKey: string): PlanTier {
  const tiers: PlanTier[] = ['free', 'starter', 'growth', 'pro'];
  for (const tier of tiers) {
    if (hasAgentAccess(tier, agentKey)) return tier;
  }
  return 'pro';
}

/**
 * Check if plan has access to a feature
 */
export function hasFeatureAccess(plan: PlanTier, feature: keyof PlanFeatures): boolean {
  const f = PLAN_FEATURES[plan];
  const val = f[feature];
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') return true;
  if (Array.isArray(val)) return val.length > 0;
  return false;
}
