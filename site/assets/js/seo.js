(function () {
  var SITE_ORIGIN = "https://vijayptiwari.github.io";
  var SITE_PATH = "/LangStitch";
  var SITE_URL = SITE_ORIGIN + SITE_PATH;
  var SITE_NAME = "LangStitch";
  var TWITTER = "@vijayptiwari";
  var AUTHOR = "Vijay Prakash Tiwari";
  var DEFAULT_IMAGE = SITE_ORIGIN + "/assets/photos/hero.png";

  var PAGES = {
    "index.html": {
      title: "LangStitch — Visual LangGraph IDE | Design, Export & Deploy Agents",
      description:
        "Visual LangGraph IDE — design agent workflows on a canvas with skills, guardrails, RAG pipelines, and multi-intent routing. Export Python 3.13 projects, try live in browser, deploy with Docker and Helm.",
      keywords:
        "LangStitch, LangGraph IDE, visual agent builder, LangGraph canvas, RAG pipeline designer, Python export, LangSmith, MCP Studio, agent guardrails, multi-intent classifier",
      type: "website",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL + "/",
          description:
            "Visual drag-and-drop IDE for LangGraph — skills, guardrails, RAG, and production Python export.",
          inLanguage: "en-US",
          publisher: {
            "@type": "Person",
            name: AUTHOR,
            url: SITE_ORIGIN + "/"
          },
          potentialAction: {
            "@type": "SearchAction",
            target: SITE_URL + "/docs/",
            "query-input": "required name=search_term_string"
          }
        },
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Windows, macOS, Linux",
          description:
            "Browser-based LangGraph designer with asset designers, RAG pipelines, Python 3.13 multi-module export, and GitHub Pages live try.",
          url: SITE_URL + "/",
          downloadUrl: "https://github.com/vijayptiwari/LangStitch",
          softwareVersion: "0.1.0",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          author: { "@type": "Person", name: AUTHOR },
          license: "https://opensource.org/licenses/MIT"
        }
      ]
    },
    "try.html": {
      title: "Try LangStitch live — Visual LangGraph IDE in your browser",
      description:
        "Try LangStitch free in your browser — drag-and-drop LangGraph canvas with no install. Open full IDE for export, Git sync, and platform features.",
      keywords: "LangStitch live demo, LangGraph online, try agent IDE, browser LangGraph builder",
      type: "website"
    }
  };

  function fileName() {
    var segs = location.pathname.split("/").filter(Boolean);
    var last = segs[segs.length - 1] || "";
    if (!last || !/\.html$/i.test(last)) return "index.html";
    return last;
  }

  function upsertMeta(name, content, property) {
    if (!content) return;
    var sel = property ? 'meta[property="' + name + '"]' : 'meta[name="' + name + '"]';
    var node = document.head.querySelector(sel);
    if (!node) {
      node = document.createElement("meta");
      if (property) node.setAttribute("property", name);
      else node.setAttribute("name", name);
      document.head.appendChild(node);
    }
    node.setAttribute("content", content);
  }

  function upsertLink(rel, href, attrs) {
    if (!href) return;
    var node = document.head.querySelector('link[rel="' + rel + '"]');
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", rel);
      document.head.appendChild(node);
    }
    node.setAttribute("href", href);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
  }

  function injectJsonLd(blocks) {
    if (!blocks || !blocks.length) return;
    var existing = document.getElementById("langstitch-jsonld");
    if (existing) existing.remove();
    var script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "langstitch-jsonld";
    script.textContent = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
    document.head.appendChild(script);
  }

  var fn = fileName();
  var page = PAGES[fn];
  if (!page) return;

  var canonical =
    fn === "index.html" ? SITE_URL + "/" : SITE_URL + "/" + fn;

  document.title = page.title;
  upsertMeta("description", page.description);
  upsertMeta("keywords", page.keywords);
  upsertMeta("author", AUTHOR);
  upsertMeta("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  upsertMeta("googlebot", "index, follow, max-image-preview:large");
  upsertMeta("bingbot", "index, follow");
  upsertMeta("theme-color", "#6366f1");
  upsertLink("canonical", canonical);
  upsertLink("sitemap", SITE_URL + "/sitemap.xml", {
    type: "application/xml",
    title: "Sitemap"
  });
  upsertMeta("og:site_name", SITE_NAME, true);
  upsertMeta("og:type", page.type || "website", true);
  upsertMeta("og:url", canonical, true);
  upsertMeta("og:title", page.title, true);
  upsertMeta("og:description", page.description, true);
  upsertMeta("og:image", DEFAULT_IMAGE, true);
  upsertMeta("og:locale", "en_US", true);
  upsertMeta("twitter:card", "summary_large_image");
  upsertMeta("twitter:site", TWITTER);
  upsertMeta("twitter:title", page.title);
  upsertMeta("twitter:description", page.description);
  upsertMeta("twitter:image", DEFAULT_IMAGE);
  if (page.jsonLd) injectJsonLd(page.jsonLd);
})();
