import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return <DashboardShell businessId={businessId}>{children}</DashboardShell>;
}
