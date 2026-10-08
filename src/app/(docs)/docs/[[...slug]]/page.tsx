import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { oracleLive } from "@/config/contracts";
import { DocsToc } from "@/components/docs/DocsChrome";
import { MarkHero } from "@/components/landing/MarkHero";
import { ApiKeyPanel, CreditsPanel } from "@/components/app/DevPanels";
import { ContractsTable } from "@/components/docs/Contracts";
import { JsonLd } from "@/components/JsonLd";
import { Faq } from "@/components/kit";
import { DOCS, docBySlug, type DocPage } from "@/content/docs";
import { FAQ } from "@/content/faq";
import { breadcrumbLd, faqLd, pageMeta } from "@/lib/seo";

type Props = { params: Promise<{ slug?: string[] }> };

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug ? d.slug.split("/") : [] }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props) {
  const { slug = [] } = await params;
  const d = docBySlug(slug.join("/"));
  if (!d) return {};
  return pageMeta({
    path: d.slug ? `/docs/${d.slug}` : "/docs",
    title: d.slug ? `${d.title} | ${BRAND.name} docs` : `${BRAND.name} docs`,
    description: `${BRAND.name} docs: ${d.summary}`.slice(0, 160),
  });
}

const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Outline entries for the "On this page" column. */
function outline(d: DocPage) {
  return d.body.filter((b) => b.startsWith("## ")).map((b) => ({ id: slugify(b.slice(3)), text: b.slice(3), depth: 2 }));
}

function Block({ b }: { b: string }) {
  if (b === "{{apikey}}") return <div className="not-prose my-6"><ApiKeyPanel /></div>;
  if (b === "{{credits}}") return <div className="not-prose my-6"><CreditsPanel /></div>;
  if (b === "{{contracts}}") return <ContractsTable />;
  if (b === "{{faq}}") return <div className="my-6"><Faq items={FAQ} /></div>;
  if (b.startsWith("## ")) return <h2 id={slugify(b.slice(3))} className="scroll-mt-[120px]">{b.slice(3)}</h2>;
  if (b.startsWith("```"))
    return (
      <pre className="num my-6 overflow-x-auto rounded-[6px] border border-line bg-card p-4 text-[13px] leading-6 text-ink">
        {b.replace(/^```\n?/, "").replace(/```$/, "")}
      </pre>
    );
  return <p>{b}</p>;
}

/** "Lead: rest" list items get a bold lead-in and a numbered gutter; plain items get square bullets. */
function List({ items }: { items: string[] }) {
  const lead = items.every((x) => /^[^:]{2,48}: /.test(x));
  if (lead)
    return (
      <ol className="docs-ol">
        {items.map((x, i) => {
          const k = x.indexOf(": ");
          return (
            <li key={i}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <strong className="font-medium text-ink">{x.slice(0, k)}.</strong> {x.charAt(k + 2).toUpperCase() + x.slice(k + 3)}
              </span>
            </li>
          );
        })}
      </ol>
    );
  return (
    <ul className="docs-ul">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function Body({ d }: { d: DocPage }) {
  // Group consecutive "- " items into lists.
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length) out.push(<List key={`l${k}`} items={list} />);
    list = [];
  };
  d.body.forEach((b, i) => {
    if (b.startsWith("- ")) list.push(b.slice(2));
    else {
      flush(i);
      out.push(<Block key={i} b={b} />);
    }
  });
  flush(d.body.length);
  return <div className="prose-f docs-prose">{out}</div>;
}

function Callout({ label, children, dim = false }: { label: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`rounded-[4px] border px-4 py-3.5 ${dim ? "border-line bg-card" : "border-line-2 bg-paper-2"}`}>
      <p className={`kicker flex items-center gap-2 ${dim ? "" : "!text-ink"}`}>
        <span className={`size-1.5 rounded-full ${dim ? "bg-ink-3" : "bg-ink"}`} /> {label}
      </p>
      <p className={`mt-2 text-[15px] leading-[1.6] ${dim ? "text-ink-2" : "text-ink"}`}>{children}</p>
    </div>
  );
}

export default async function DocsPage({ params }: Props) {
  const { slug = [] } = await params;
  const d = docBySlug(slug.join("/"));
  if (!d) notFound();
  const i = DOCS.indexOf(d);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  const href = (x: DocPage) => (x.slug ? `/docs/${x.slug}` : "/docs");
  const live = oracleLive();
  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "Docs", path: "/docs" }, ...(d.slug ? [{ name: d.title, path: `/docs/${d.slug}` }] : [])]), ...(d.slug === "reference/faq" ? [faqLd(FAQ)] : [])]} />
      <div className="flex gap-10">
        <article className="min-w-0 max-w-[720px] flex-1 pt-4 lg:pl-8">
          {d.slug === "" ? <MarkHero size={70} box={76} className="!mx-0 mb-6" /> : null}
          <p className="kicker">{d.section}</p>
          <h1 className="mt-4 font-display text-[clamp(40px,4vw,56px)] leading-[1.05] tracking-[-0.045em] text-ink">{d.title}</h1>
          <p className="mt-6 text-[19px] leading-[1.55] text-ink-3">{d.summary}</p>
          <hr className="my-9 border-0 border-t border-dashed border-line-2" />
          {i === 0 || d.section === "Start here" ? (
            <div className="mb-10">
              <Callout label="Status">
                {live
                  ? "The ForecastOracle contract is deployed: forecasts committed through the site are recorded and scored on chain."
                  : "Practice mode. Prices and the house baselines are live; the ForecastOracle contract is written and tested but not deployed, so forecasts are signed and scored by this site until its address is set."}
              </Callout>
            </div>
          ) : null}
          <Body d={d} />
          <div className="mt-10">
            <Callout label="Note" dim>
              Every range on this site is a model's estimate, not a trading instruction. A strong record so far says nothing certain about the next call.
            </Callout>
          </div>
          <nav aria-label="Previous and next" className="mt-16 grid grid-cols-2 gap-3">
            {prev ? (
              <Link href={href(prev)} className="rounded-[6px] border border-line bg-card p-5 transition-colors hover:border-line-2">
                <span className="kicker flex items-center gap-1.5">← Previous</span>
                <span className="mt-2 block text-[16px] text-ink">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={href(next)} className="rounded-[6px] border border-line bg-card p-5 text-right transition-colors hover:border-line-2">
                <span className="kicker flex items-center justify-end gap-1.5">Next →</span>
                <span className="mt-2 block text-[16px] text-ink">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        </article>
        <aside className="hidden w-[200px] shrink-0 pt-8 xl:block" aria-label="On this page">
          <DocsToc items={outline(d)} />
        </aside>
      </div>
    </>
  );
}
