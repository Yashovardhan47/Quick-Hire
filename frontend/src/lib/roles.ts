import type { UserRole } from "./api";

export type SignupRole = UserRole;

export const ROLE_PERSPECTIVES: Record<UserRole, { label: string; workspace: string; home: string }> = {
  candidate: { label: "Job seeker", workspace: "Job seeker workspace", home: "/candidate/home" },
  recruiter: { label: "Recruiter", workspace: "Recruiter workspace", home: "/recruiter/home" },
  admin: { label: "Platform admin", workspace: "Platform admin workspace", home: "/admin/home" },
};

export function homeForRole(role: UserRole): string {
  return ROLE_PERSPECTIVES[role].home;
}
