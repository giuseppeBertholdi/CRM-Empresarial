import type { Role } from "@prisma/client";

export function isAdmin(role: Role) {
  return role === "ADMIN";
}

export function isManager(role: Role) {
  return role === "MANAGER";
}

export function canManageUsers(role: Role) {
  return isAdmin(role);
}

export function canManageDepartments(role: Role) {
  return isAdmin(role);
}

export function canManageAutomations(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canAccessDepartment(
  role: Role,
  userDepartmentId: string | null,
  targetDepartmentId: string
) {
  if (isAdmin(role)) return true;
  return userDepartmentId === targetDepartmentId;
}
