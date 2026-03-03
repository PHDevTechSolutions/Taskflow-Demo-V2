import { NextResponse } from "next/server";

interface ShopifyProduct {
  id: number;
  title: string;
  description: string; // Only table converted to text
  images: Array<{ src: string }>;
  skus: string[];
}

interface ShopifyAPIResponse {
  products: Array<{
    id: number;
    title: string;
    body_html: string;
    images: Array<{ src: string }>;
    variants: Array<{ sku: string }>;
  }>;
};

/**
 * Extract first table from HTML and convert to plain text.
 * Ignores all other HTML tags outside the table.
 */
/**
 * Extract first table from HTML and convert to styled HTML output.
 */
const extractTableAsHtml = (html: string): string => {
  if (!html?.trim()) return "";

  // Match first <table> ... </table>
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return "";

  const tableHTML = tableMatch[0];

  // Split rows by <tr>
  const rowMatches = tableHTML.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!rowMatches) return "";

  let specsHtml = "";
  let rawSpecsText = "";

  rowMatches.forEach((tr, index) => {
    const colMatches = tr.match(/<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi);
    if (!colMatches) return;

    if (index === 0) {
      // Get group name from first row, default to "Specification"
      let groupName = colMatches
        .map((c) => c.replace(/<[^>]+>/g, "").trim())
        .join(" ");
      if (!groupName) groupName = "Specification";

      specsHtml += `<div style="background:#121212;color:white;padding:4px 8px;font-weight:900;text-transform:uppercase;font-size:9px;margin-top:8px">
        ${groupName}
      </div>`;

      specsHtml += `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px">`;
    } else {
      const cols = colMatches.map((c) => c.replace(/<[^>]+>/g, "").trim());
      rawSpecsText += ` ${cols.join(" ")}`;

      specsHtml += `
      <tr>
        <td style="border:1px solid #e5e7eb;padding:4px;background:#f9fafb;width:40%">
          <b>${cols[0]}</b>
        </td>
        <td style="border:1px solid #e5e7eb;padding:4px">
          ${cols[1] || ""}
        </td>
      </tr>`;
    }
  });

  specsHtml += `</table>`;
  return specsHtml;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q: string = searchParams.get("q")?.toLowerCase() || "";

    const SHOPIFY_STORE: string = process.env.SHOPIFY_STORE!;
    const SHOPIFY_PRODUCT_TOKEN: string = process.env.SHOPIFY_PRODUCT_TOKEN!;

    let allProducts: ShopifyProduct[] = [];
    let nextPageInfo: string | null = null;
    const limit = 250;

    do {
      const url: string = nextPageInfo
        ? `https://${SHOPIFY_STORE}/admin/api/2024-07/products.json?limit=${limit}&page_info=${nextPageInfo}`
        : `https://${SHOPIFY_STORE}/admin/api/2024-07/products.json?limit=${limit}`;

      const response: Response = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_PRODUCT_TOKEN,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Shopify error:", await response.text());
        return NextResponse.json(
          { error: "Shopify error" },
          { status: response.status }
        );
      }

      const linkHeader: string | null = response.headers.get("link");
      const data: ShopifyAPIResponse = await response.json();

      const mapped: ShopifyProduct[] = data.products.map((p) => ({
        id: p.id,
        title: p.title,
        description: extractTableAsHtml(p.body_html), // Only table text
        images: p.images,
        skus: p.variants.map((v) => v.sku).filter(Boolean),
      }));

      allProducts = [...allProducts, ...mapped];

      // Handle pagination
      const match: RegExpMatchArray | null =
        linkHeader?.match(/<[^>]+page_info=([^>]+)>; rel="next"/) || null;
      nextPageInfo = match ? match[1] : null;
    } while (nextPageInfo);

    // Filter by query
    const filtered: ShopifyProduct[] = q
      ? allProducts.filter((p) => {
        const titleMatch = p.title.toLowerCase().includes(q);
        const skuMatch = p.skus.some((sku) => sku.toLowerCase().includes(q));
        const descMatch = p.description.toLowerCase().includes(q);
        return titleMatch || skuMatch || descMatch;
      })
      : allProducts;

    return NextResponse.json({ products: filtered });
  } catch (error) {
    const err = error as Error;
    console.error("Shopify fetch error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}