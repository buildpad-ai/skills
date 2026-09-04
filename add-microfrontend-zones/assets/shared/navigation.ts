/**
 * @buildpad-origin @buildpad/cli/design-system/navigation
 * @buildpad-version 1.11.1
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add design-system/navigation --overwrite
 *
 * Docs: https://buildpad.dev/components/design-system/navigation
 */
// ⚠️ LOCAL MODIFICATION (add-microfrontend-zones Rule 7): this file is IDENTICAL in the
// Main App and in every zone — regenerate it in all apps together. Every href is a
// PUBLIC path (zone prefix included). AuthenticatedShell renders them through ZoneLink,
// which picks <Link> for the zone that owns the current page and <a> for every other one.
//
// AGENT: keep the CLI header above (it is the CLI's own file, and the CLI merges
// route-module entries into it by href). One entry per PAGE, generated from each
// zone's installed modules (their registry `navItems`), with the zone prefix prepended.
// The example below is the field-trial layout: files-management at /storage,
// users-management at /iam.

import { IconFiles, IconHome, IconKey, IconShieldLock, IconUsers, IconUsersGroup } from "@tabler/icons-react";
import type { NavItem } from "./AuthenticatedShell";

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: IconHome },
  // Zone: files-management (prefix /storage)
  { label: "Files", href: "/storage/files", icon: IconFiles },
  // Zone: users-management (prefix /iam)
  { label: "Users", href: "/iam/users", icon: IconUsers, section: "Administration" },
  { label: "Roles", href: "/iam/roles", icon: IconUsersGroup, section: "Administration" },
  { label: "Policies", href: "/iam/policies", icon: IconShieldLock, section: "Administration" },
  { label: "Module Access Keys", href: "/iam/module-access-keys", icon: IconKey, section: "Administration" },
  // buildpad:nav-insert — installed route modules add entries above this line. Do not remove.
];
