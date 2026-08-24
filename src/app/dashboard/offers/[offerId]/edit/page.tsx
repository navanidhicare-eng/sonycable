import EditOfferClient from "./Client";

export function generateStaticParams() {
  return [{ offerId: "placeholder" }];
}

export default function EditOfferPage() {
  return <EditOfferClient />;
}
