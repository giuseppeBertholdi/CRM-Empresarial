import { AppShell } from "@/components/layout/app-shell";
import { requireCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();

  return (
    <AppShell
      user={{
        name: user.name,
        role: user.role,
        department: user.department,
      }}
    >
      {children}
    </AppShell>
  );
}
