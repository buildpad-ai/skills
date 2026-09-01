# Module Access Checklist

Use this checklist whenever a feature has role-gated behavior.

## Pre-Implementation

- [ ] Capability keys are defined using `<domain>:<capability>` naming
- [ ] Keys are registered in `daas_module_access_keys`
- [ ] Keys are granted in policy `module_access` maps
- [ ] Capability matrix is prepared (key, policies, UI guards, API guards)

## Implementation

- [ ] React gating uses `usePermissions().hasModuleAccess(key)`
- [ ] API routes enforce module access server-side (policy OR-merge)
- [ ] Workflow commands use `module_access_keys` where applicable
- [ ] No raw role-name checks for capability gating

## Anti-Pattern Scan

Run both commands:

```bash
grep -rn "role === \|roleName\|user\.role\|is_manager\|is_admin\|isManager\b\|currentUser\.role" app/ components/ 2>/dev/null
grep -rn "detectAdminFromMe\|checkAdmin\|roleObj\.name === 'Administrator'\|admin_access\s*===\s*true\|\bisAdmin\b" app/ components/ 2>/dev/null
```

- [ ] Any match used as a capability gate is replaced with module-access checks

## Verification Tests

- [ ] Granted user path passes
- [ ] Ungranted UI path blocked
- [ ] Ungranted API path blocked with `403`
- [ ] Admin bypass path passes
