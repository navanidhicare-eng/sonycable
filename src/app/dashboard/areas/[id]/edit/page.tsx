import EditAreaClient from "./Client";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function EditAreaPage() {
  return <EditAreaClient />;
}
