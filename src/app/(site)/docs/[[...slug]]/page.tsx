import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/config/brand";
import { ApiKeyPanel, CreditsPanel } from "@/components/app/DevPanels";
import { ContractsTable } from "@/components/docs/Contracts";
import { JsonLd } from "@/components/JsonLd";
import { Faq } from "@/components/kit";
import { DOCS, DOC_SECTIONS, docBySlug, type DocPage } from "@/content/docs";
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

function Block({ b }: { b: string }) {
  if (b === "{{apikey}}") return <div className="my-4"><ApiKeyPanel /></div>;
  if (b === "{{credits}}") return <div className="my-4"><CreditsPanel /></div>;
  if (b === "{{contracts}}") return <ContractsTable />;
  if (b === "{{faq}}") return <div className="my-4"><Faq items={FAQ} /></div>;
  if (b.startsWith("## ")) return <h2>{b.slice(3)}</h2>;
  if (b.startsWith("```")) return <pre className="num my-4 overflow-x-auto rounded-[10px] border border-line bg-paper-2 p-4 text-[13px] leading-6 text-ink">{b.replace(/^```\n?/, "").replace(/```$/, "")}</pre>;
  return <p>{b}</p>;
}

function Body({ d }: { d: DocPage }) {
  // Group consecutive "- " items into lists.
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length) out.push(<ul key={`l${k}`}>{list.map((x, i) => <li key={i}>{x}</li>)}</ul>);
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
  return <div className="prose-f text-[16px] leading-relaxed text-ink-2">{out}</div>;
}

export default async function DocsPage({ params }: Props) {
  const { slug = [] } = await params;
  const d = docBySlug(slug.join("/"));
  if (!d) notFound();
  const i = DOCS.indexOf(d);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  const inSection = DOCS.filter((x) => x.section === d.section);
  const href = (x: DocPage) => (x.slug ? `/docs/${x.slug}` : "/docs");
  return (
    <>
      <JsonLd data={[breadcrumbLd([{ name: "Docs", path: "/docs" }, ...(d.slug ? [{ name: d.title, path: `/docs/${d.slug}` }] : [])]), ...(d.slug === "reference/faq" ? [faqLd(FAQ)] : [])]} />
      {/* Section chips across the top; the section's pages in a column on the right. */}
      <div className="border-b border-line">
        <nav aria-label="Docs sections" className="ctn flex gap-1 overflow-x-auto py-3">
          {DOC_SECTIONS.map((s) => {
            const first = DOCS.find((x) => x.section === s)!;
            return (
              <Link key={s} href={href(first)} aria-current={s === d.section ? "true" : undefined} className={`kicker shrink-0 rounded px-3 py-1.5 ${s === d.section ? "!text-ink bg-paper-3" : "hover:!text-ink"}`}>
                {s}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="ctn grid grid-cols-1 gap-10 py-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0 max-w-[760px]">
          <p className="kicker">{d.section}</p>
          <h1 className="h-hero mt-3 !text-[clamp(34px,4vw,52px)]">{d.title}</h1>
          <p className="lede mt-4">{d.summary}</p>
          <div className="mt-8">
            <Body d={d} />
          </div>
          <nav aria-label="Previous and next" className="mt-14 grid grid-cols-2 gap-3 border-t border-line pt-6 text-[14px]">
            {prev ? (
              <Link href={href(prev)} className="rounded-[10px] border border-line p-3 hover:border-line-2">
                <span className="kicker block">← Earlier</span>
                <span className="text-ink">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={href(next)} className="rounded-[10px] border border-line p-3 text-right hover:border-line-2">
                <span className="kicker block">Later →</span>
                <span className="text-ink">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        </article>
        <aside className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+24px)] lg:self-start" aria-label="In this section">
          <p className="kicker">In {d.section}</p>
          <ul className="mt-3 border-l border-line">
            {inSection.map((x) => (
              <li key={x.slug}>
                <Link href={href(x)} aria-current={x === d ? "page" : undefined} className={`-ml-px block border-l-2 py-1.5 pl-4 text-[14px] ${x === d ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink"}`}>
                  {x.title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-2 text-[13px]">
            <Link href="/forecasts" className="block text-stamp hover:underline">
              Open the app →
            </Link>
            <Link href="/" className="block text-ink-3 hover:text-ink">
              Back to {BRAND.domain}
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
