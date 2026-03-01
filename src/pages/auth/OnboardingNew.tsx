import OnboardingWizard from '../../components/ui/OnboardingWizard';

/**
 * 3-Step Onboarding Page
 *
 * Uses the OnboardingWizard component which provides:
 * - Step 1: Business info (name, type, address, radius)
 * - Step 2: First scan with live animation
 * - Step 3: WhatsApp setup (morning summary time)
 */
export default function OnboardingNew() {
  return <OnboardingWizard />;
}
