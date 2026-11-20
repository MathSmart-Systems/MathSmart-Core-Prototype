"use client";

import { LayoutDashboard } from "lucide-react";

import { ROLES, homePathForRole } from "@/lib/auth/roles";
import { SidebarFrame, SidebarNav, SignOutButton } from "@/modules/shared";

const homeHref = homePathForRole(ROLES.STUDENT);
const workspace = { name: "Student workspace", detail: "Grade 6 mathematics" };
const groups = [{ items: [{ href: homeHref, label: "Dashboard", icon: LayoutDashboard }] }];

export function StudentSidebar({ email }) {
  return (
    <SidebarFrame
      workspace={workspace}
      email={email}
      homeHref={homeHref}
      renderNav={(onNavigate) => (
        <>
          <SidebarNav groups={groups} onNavigate={onNavigate} />
          <div className="px-4 pt-4">
            <SignOutButton />
          </div>
        </>
      )}
    />
  );
}
