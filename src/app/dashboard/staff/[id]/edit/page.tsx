import EditStaffClient from "./Client";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function EditStaffPage() {
  return <EditStaffClient />;
}
