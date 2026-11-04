// buildpad-backend-file: supabase
// Backend: before using this file, establish the backend as "Establish the backend first" in this skill's SKILL.md says, keep only the parts for that backend, and copy no marker line into the application.
import { RuleFormPage } from '@/components/role-assignment/rule-form-page';

export default async function RoleAssignmentRulePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  return <RuleFormPage ruleId={ruleId} />;
}
