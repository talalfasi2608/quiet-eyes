import { type ReactNode } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Lock } from 'lucide-react';

type Role = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

interface RoleGateProps {
  /** Minimum role required to see the content */
  minRole: Role;
  /** Content to show when user has sufficient role */
  children: ReactNode;
  /** What to show when user lacks permission (default: locked message) */
  fallback?: ReactNode;
  /** If true, hides the component entirely instead of showing fallback */
  hideCompletely?: boolean;
}

/**
 * Role-based component gating.
 * Wraps content that should only be visible to users with a minimum role level.
 *
 * Usage:
 *   <RoleGate minRole="admin">
 *     <DeleteButton />
 *   </RoleGate>
 *
 *   <RoleGate minRole="owner" hideCompletely>
 *     <BillingSettings />
 *   </RoleGate>
 */
export default function RoleGate({ minRole, children, fallback, hideCompletely = false }: RoleGateProps) {
  const { role } = useWorkspace();

  const userLevel = role ? ROLE_HIERARCHY[role] || 0 : 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

  if (userLevel >= requiredLevel) {
    return <>{children}</>;
  }

  if (hideCompletely) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Default locked state
  return (
    <div className="rounded-xl bg-gray-800/30 border border-gray-700/30 p-6 text-center opacity-60">
      <Lock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
      <p className="text-gray-400 text-sm">
        תוכן זה זמין רק עבור {minRole === 'owner' ? 'בעלים' : minRole === 'admin' ? 'מנהלים' : 'חברי צוות'}
      </p>
    </div>
  );
}

/**
 * Hook to check if the current user has a minimum role.
 */
export function useHasRole(minRole: Role): boolean {
  const { role } = useWorkspace();
  const userLevel = role ? ROLE_HIERARCHY[role] || 0 : 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
  return userLevel >= requiredLevel;
}
