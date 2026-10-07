import { Btn, PageHead } from "@/components/kit";

export default function NotFound() {
  return (
    <PageHead kicker={<span className="kicker">404</span>} title="Nothing resolves at this address" lede="The page you followed does not exist on this site.">
      <Btn href="/" small>
        Back to the home page
      </Btn>
      <Btn href="/forecasts" tone="ghost" small>
        Open the forecast feed
      </Btn>
    </PageHead>
  );
}
