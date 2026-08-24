import EditCustomerClient from "./Client";

export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function EditCustomerPage() {
  return <EditCustomerClient />;
}
