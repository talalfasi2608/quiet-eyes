import OnboardingWizard from '../../components/ui/OnboardingWizard';

/**
 * New 3-Step Onboarding Page
 *
 * Uses the OnboardingWizard component which provides:
 * - Step 1: Business Name, Address (with Google Autocomplete), Industry
 * - Step 2: Website URL with AI analysis
 * - Step 3: Strategy questions (Target Audience, Price Tier, Competitor)
 */
export default function OnboardingNew() {
  return <OnboardingWizard />;
}
