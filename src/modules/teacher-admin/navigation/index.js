import { TriangleAlert, Users } from "lucide-react";

import { ROLES } from "@/lib/auth/roles";

/** Sidebar identity for the combined Teacher/Administrator workspace. */
export const TEACHER_ADMIN_WORKSPACE = Object.freeze({
  role: ROLES.TEACHER_ADMIN,
  name: "Teacher/Administrator workspace",
  detail: "Grade 6 mathematics",
});

/**
 * Every destination in the Teacher/Administrator sidebar, grouped so the list
 * stays readable. Grouping is visual only: all destinations stay visible.
 */
export const TEACHER_ADMIN_NAV = Object.freeze([Object.freeze({
  items: Object.freeze([
    { href: "/teacher/students", label: "Students", icon: Users },
    { href: "/teacher/interventions", label: "Interventions", icon: TriangleAlert },
  ]),
})]);
