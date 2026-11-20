"use client";

import { SidebarFrame, SidebarNav, SignOutButton } from "@/modules/shared";

import { TEACHER_ADMIN_NAV, TEACHER_ADMIN_WORKSPACE } from "./index";

export function TeacherAdminSidebar({ email }) {
  return (
    <SidebarFrame
      workspace={TEACHER_ADMIN_WORKSPACE}
      email={email}
      homeHref="/teacher/dashboard"
      renderNav={(onNavigate) => (
        <>
          <SidebarNav groups={TEACHER_ADMIN_NAV} onNavigate={onNavigate} />
          <div className="px-4 pt-4">
            <SignOutButton />
          </div>
        </>
      )}
    />
  );
}
