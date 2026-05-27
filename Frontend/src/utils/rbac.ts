import type { AuthUser, Role } from '../services/api';

type CapabilityUser = Partial<AuthUser> & {
  role?: Role | string;
  capabilities?: string[] | null;
  initiator_enabled?: boolean | null;
};

export function canInitiatePSSR(user: CapabilityUser | null | undefined): boolean {
  if (!user || user.role !== 'TEAM_MEMBER') return false;
  return Boolean(
    user.initiator_enabled === true ||
      user.capabilities?.includes('INITIATE_PSSR')
  );
}
