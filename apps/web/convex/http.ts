import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// ============================================
// SEO-OPTIMIZED PUBLIC NOTE ROUTE
// ============================================

// List of known crawler user agents
const CRAWLER_USER_AGENTS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "slackbot",
  "applebot",
];

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((crawler) => ua.includes(crawler));
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractPlainText(description: string | undefined): string {
  if (!description) return "";
  try {
    const parsed = JSON.parse(description);
    const extractText = (node: unknown): string => {
      if (typeof node === "string") return node;
      if (node && typeof node === "object" && "text" in node) {
        return (node as { text: string }).text;
      }
      if (Array.isArray(node)) {
        return node.map(extractText).filter(Boolean).join(" ");
      }
      if (node && typeof node === "object" && "content" in node) {
        const content = (node as { content: unknown }).content;
        if (Array.isArray(content)) {
          return content.map(extractText).join(" ");
        }
      }
      return "";
    };
    return extractText(parsed);
  } catch {
    return description;
  }
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    todo: "Tarea",
    followup: "Seguimiento",
    notes: "Nota",
    meeting: "Reunión",
    event: "Evento",
    reminder: "Recordatorio",
  };
  return labels[category] || category;
}

// HTTP action to serve SEO-optimized HTML for public notes
http.route({
  path: "/note/{slug}",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const slug = url.pathname.split("/note/")[1];

    if (!slug || slug.length < 8 || slug.length > 24) {
      return new Response("Not Found", { status: 404 });
    }

    // Fetch the public note
    const note = await ctx.runQuery(api.notes.getPublic, { slug });

    if (!note) {
      return new Response("Not Found", { status: 404 });
    }

    // Fetch labels for this note
    const noteLabels = await ctx.runQuery(api.labels.getForNote, {
      noteId: note._id,
    });

    // Fetch assignees for this note
    const noteAssignees = await ctx.runQuery(
      api.contacts.getPublicAssigneesForNote,
      {
        noteId: note._id,
      }
    );

    const userAgent = request.headers.get("user-agent");
    const baseUrl = url.origin;
    const canonicalUrl = `${baseUrl}/p/${slug}`;

    // Extract plain text description for meta tags
    const plainDescription = extractPlainText(note.description);
    const metaDescription = plainDescription
      ? plainDescription.substring(0, 160)
      : `${getCategoryLabel(note.category)}: ${note.content}`;

    // Format dates for Schema.org
    const datePublished = note.createdAt;
    const dateModified = note.updatedAt;

    // Build assignees string
    const assigneesText = noteAssignees
      .map((a) => `${a.name}${a.lastname ? " " + a.lastname : ""}`)
      .join(", ");

    // JSON-LD structured data (Schema.org)
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: note.content,
      description: metaDescription,
      datePublished: datePublished,
      dateModified: dateModified,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      publisher: {
        "@type": "Organization",
        name: "Triple-A",
        url: baseUrl,
      },
      ...(note.deadline && {
        expires: note.deadline,
      }),
      ...(noteLabels.length > 0 && {
        keywords: noteLabels.map((l) => l.name).join(", "),
      }),
    };

    // Check if this is a crawler request
    if (isCrawler(userAgent)) {
      // Serve fully rendered HTML for crawlers
      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(note.content)} | Triple-A</title>
  <meta name="description" content="${escapeHtml(metaDescription)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(note.content)}">
  <meta property="og:description" content="${escapeHtml(metaDescription)}">
  <meta property="og:site_name" content="Triple-A">
  <meta property="article:published_time" content="${datePublished}">
  <meta property="article:modified_time" content="${dateModified}">
  ${noteLabels.map((l) => `<meta property="article:tag" content="${escapeHtml(l.name)}">`).join("\n  ")}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(note.content)}">
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 768px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    .category { display: inline-block; padding: 0.25rem 0.75rem; background: #f3f4f6; border-radius: 9999px; font-size: 0.875rem; margin-bottom: 1rem; }
    .labels { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .label { padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; color: white; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .description { color: #374151; white-space: pre-wrap; }
    footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 0.75rem; }
  </style>
</head>
<body>
  <article>
    <header>
      <span class="category">${escapeHtml(getCategoryLabel(note.category))}</span>
      ${noteLabels.length > 0 ? `<div class="labels">${noteLabels.map((l) => `<span class="label" style="background-color: ${l.color}">${escapeHtml(l.name)}</span>`).join("")}</div>` : ""}
      <h1>${escapeHtml(note.content)}</h1>
      <div class="meta">
        <time datetime="${datePublished}">Creado: ${new Date(datePublished).toLocaleDateString("es")}</time>
        ${note.deadline ? `<span> · Fecha límite: <time datetime="${note.deadline}">${new Date(note.deadline).toLocaleDateString("es")}</time></span>` : ""}
        ${assigneesText ? `<span> · Asignado a: ${escapeHtml(assigneesText)}</span>` : ""}
      </div>
    </header>
    ${plainDescription ? `<section class="description">${escapeHtml(plainDescription)}</section>` : ""}
  </article>
  <footer>Powered by Triple-A</footer>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }

    // For regular users, redirect to the SPA
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/p/${slug}`,
      },
    });
  }),
});

export default http;
