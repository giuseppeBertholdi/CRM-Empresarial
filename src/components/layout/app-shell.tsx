import { Sidebar } from "@/components/layout/sidebar";

type AppShellProps = {
  children: React.ReactNode;
  user: {
    name: string;
    role: "ATTENDANT" | "MANAGER" | "ADMIN";
    department?: { name: string } | null;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        role={user.role}
        userName={user.name}
        departmentName={user.department?.name}
      />
      <main className="min-w-0 flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}
