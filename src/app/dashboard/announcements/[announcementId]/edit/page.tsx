import EditAnnouncementClient from "./Client";

export function generateStaticParams() {
  return [{ announcementId: "placeholder" }];
}

export default function EditAnnouncementPage() {
  return <EditAnnouncementClient />;
}
