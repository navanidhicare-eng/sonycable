import EditBusinessClient from "./Client";

export function generateStaticParams() {
  return [{ businessId: "placeholder" }];
}

export default function EditBusinessPage() {
  return <EditBusinessClient />;
}
