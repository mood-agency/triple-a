import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, AlertTriangle, User } from "lucide-react";

// ============================================
// SEO HELPER FUNCTIONS
// ============================================

function getCategoryLabel(
  category: string,
  t: (key: string) => string
): string {
  const categoryMap: Record<string, string> = {
    todo: t("categoryTodo"),
    followup: t("categoryFollowUp"),
    notes: t("categoryNote"),
    meeting: t("categoryMeeting"),
    event: t("categoryEvent"),
    reminder: t("categoryReminder"),
  };
  return categoryMap[category] || category;
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

// Helper to render description (could be BlockNote JSON, TipTap JSON, or plain text)
function renderDescription(description: string) {
  try {
    const parsed = JSON.parse(description);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractText = (node: any): string => {
      if (typeof node === "string") return node;
      if (node.text) return node.text;

      // Handle BlockNote format: array of blocks with content arrays
      if (Array.isArray(node)) {
        return node.map(extractText).filter(Boolean).join("\n");
      }

      // BlockNote block: { type: "paragraph", content: [{ type: "text", text: "..." }] }
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join("");
      }

      return "";
    };

    const text = extractText(parsed);
    return <p className="whitespace-pre-wrap">{text}</p>;
  } catch {
    return <p className="whitespace-pre-wrap">{description}</p>;
  }
}

// ============================================
// SEO META TAGS HOOK
// ============================================

interface SEOData {
  title: string;
  description: string;
  canonicalUrl: string;
  datePublished: string;
  dateModified: string;
  keywords: string[];
  category: string;
  deadline?: string;
}

function useSEO(data: SEOData | null) {
  useEffect(() => {
    if (!data) return;

    const { title, description, canonicalUrl, datePublished, dateModified, keywords, category, deadline } = data;

    // Store original values for cleanup
    const originalTitle = document.title;
    const addedElements: HTMLElement[] = [];

    // Helper to create and track meta tags
    const setMeta = (name: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
        addedElements.push(meta);
      }
      meta.content = content;
    };

    // Update document title
    document.title = `${title} | Triple-A`;

    // Basic meta tags
    setMeta("description", description);
    setMeta("robots", "index, follow");

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
      addedElements.push(canonical);
    }
    canonical.href = canonicalUrl;

    // Open Graph tags
    setMeta("og:type", "article", true);
    setMeta("og:url", canonicalUrl, true);
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:site_name", "Triple-A", true);
    setMeta("article:published_time", datePublished, true);
    setMeta("article:modified_time", dateModified, true);

    // Add article tags for keywords
    keywords.forEach((keyword) => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "article:tag");
      meta.content = keyword;
      document.head.appendChild(meta);
      addedElements.push(meta);
    });

    // Twitter Card tags
    setMeta("twitter:card", "summary");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    // JSON-LD Structured Data (Schema.org)
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description: description,
      datePublished: datePublished,
      dateModified: dateModified,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      publisher: {
        "@type": "Organization",
        name: "Triple-A",
        url: window.location.origin,
      },
      articleSection: category,
      ...(deadline && { expires: deadline }),
      ...(keywords.length > 0 && { keywords: keywords.join(", ") }),
    };

    let script = document.querySelector('script[type="application/ld+json"]') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      document.head.appendChild(script);
      addedElements.push(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    // Cleanup function
    return () => {
      document.title = originalTitle;
      addedElements.forEach((el) => el.remove());
    };
  }, [data]);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function PublicNote() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();

  // Fetch note using Convex directly
  const note = useQuery(api.notes.getPublic, slug ? { slug } : "skip");
  const labels = useQuery(
    api.labels.getForNote,
    note?._id ? { noteId: note._id } : "skip"
  );
  const assignees = useQuery(
    api.contacts.getPublicAssigneesForNote,
    note?._id ? { noteId: note._id } : "skip"
  );

  // Compute SEO data
  const seoData = useMemo<SEOData | null>(() => {
    if (!note) return null;

    const plainDescription = extractPlainText(note.description);
    const metaDescription = plainDescription
      ? plainDescription.substring(0, 160)
      : `${getCategoryLabel(note.category, t)}: ${note.content}`;

    return {
      title: note.content,
      description: metaDescription,
      canonicalUrl: `${window.location.origin}/p/${slug}`,
      datePublished: note.createdAt,
      dateModified: note.updatedAt,
      keywords: labels?.map((l) => l.name) || [],
      category: getCategoryLabel(note.category, t),
      deadline: note.deadline,
    };
  }, [note, labels, slug, t]);

  // Apply SEO meta tags
  useSEO(seoData);

  // Loading state
  if (note === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not found state
  if (note === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-lg font-semibold mb-2">
              {t("sharing.noteNotFound")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("sharing.noteNotFoundDescription")}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Format assignee names
  const assigneeNames = assignees
    ?.map((a) => `${a.name}${a.lastname ? " " + a.lastname : ""}`)
    .join(", ");

  // Render the public note with semantic HTML
  return (
    <main className="min-h-screen bg-background p-4 flex justify-center">
      <Card className="w-full max-w-2xl" role="article">
        <CardHeader>
          <header>
            {/* Category and Labels */}
            <nav aria-label="Categorías" className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="outline" aria-label="Categoría">
                {getCategoryLabel(note.category, t)}
              </Badge>
              {labels?.map((label, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs rounded-full text-white"
                  style={{ backgroundColor: label.color }}
                  aria-label={`Etiqueta: ${label.name}`}
                >
                  {label.name}
                </span>
              ))}
            </nav>

            {/* Title */}
            <CardTitle asChild>
              <h1 className="text-xl">{note.content}</h1>
            </CardTitle>

            {/* Metadata */}
            <div
              className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap"
              role="contentinfo"
            >
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                <time dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleDateString(i18n.language, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </span>

              {note.deadline && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <time dateTime={note.deadline}>
                    {new Date(note.deadline).toLocaleDateString(i18n.language, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </time>
                </span>
              )}

              {assigneeNames && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" aria-hidden="true" />
                  <span>{assigneeNames}</span>
                </span>
              )}
            </div>
          </header>
        </CardHeader>

        {/* Description content */}
        {note.description && (
          <CardContent>
            <section aria-label="Descripción">
              <div className="prose prose-sm max-w-none text-muted-foreground">
                {renderDescription(note.description)}
              </div>
            </section>
          </CardContent>
        )}

        {/* Footer */}
        <footer className="border-t px-6 py-3 text-xs text-muted-foreground text-center">
          <a
            href="https://triple-a.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {t("sharing.poweredBy")}
          </a>
        </footer>
      </Card>
    </main>
  );
}
