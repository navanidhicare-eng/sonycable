import CustomerHistoryClient from "./Client";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function CustomerHistoryPage() {
  return <CustomerHistoryClient />;
}
