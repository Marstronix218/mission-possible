import { ClassDashboard } from "@/components/results/ClassroomUI";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClassDashboard id={id} />;
}
