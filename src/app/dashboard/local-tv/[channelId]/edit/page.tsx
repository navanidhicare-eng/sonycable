import EditLocalTvChannelClient from "./Client";

export function generateStaticParams() {
  return [{ channelId: "placeholder" }];
}

export default function EditLocalTvChannelPage() {
  return <EditLocalTvChannelClient />;
}
