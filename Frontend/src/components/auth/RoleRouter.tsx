/**
 * Role router utility.
 *
 * The backend returns `dashboard_path` as the authoritative landing route. This
 * small helper keeps redirects consistent after login and during invalid route
 * recovery without scattering role-to-path maps across the frontend.
 */

import type { AuthUser } from '../../services/api';

export function routeUserToDashboard(user: AuthUser): void {
  window.history.pushState({}, '', user.dashboard_path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
