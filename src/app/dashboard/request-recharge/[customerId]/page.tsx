import RequestRechargeForCustomerClient from "./Client";

export function generateStaticParams() {
  return [{ customerId: "placeholder" }];
}

export default function RequestRechargeForCustomerPage() {
  return <RequestRechargeForCustomerClient />;
}
