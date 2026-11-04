// buildpad-backend-file: supabase
import { RuleFormPage } from '@/components/role-assignment/rule-form-page';

export default async function RoleAssignmentRulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  return <RuleFormPage ruleId={ruleId} />;
}
