// buildpad-backend-file: supabase
import { RoleAssignmentList } from '@/components/role-assignment/role-assignment-list';

/**
 * Automation > Role assignment: the active tenant's rules for who gets which role.
 *
 * Access is decided by the API (`lib/org-rules/access.ts`): a Tenant Admin of the active
 * tenant, or a global Administrator. The sidebar entry is gated on the
 * `role-assignment:manage` module key, which only decides visibility.
 */
export default function RoleAssignmentPage() {
  return <RoleAssignmentList />;
}
