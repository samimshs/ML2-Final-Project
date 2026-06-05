import React, { useEffect, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { AnimatePresence, LayoutGroup, motion } from "https://esm.sh/framer-motion@11.18.2?external=react,react-dom";
import {
  ArrowRight,
  Blocks,
  BookOpenCheck,
  BrainCircuit,
  Database,
  ExternalLink,
  Eye,
  GraduationCap,
  LoaderCircle,
  PackageCheck,
  Sparkles,
  WalletCards,
  X
} from "https://esm.sh/lucide-react@0.468.0?external=react";

const h = React.createElement;

const categories = [
  {
    id: "ml",
    className: "product-card-ml",
    title: "Machine Learning & AI",
    status: "Prototype",
    tag: "Models",
    statusClass: "product-status-primary",
    icon: "brain-circuit",
    description: "Applied models, experiments, and intelligent systems.",
    stat: "OCUSTATE · COMPUTER VISION · DEMOS",
    pageHref: "machine-learning.html"
  },
  {
    id: "education",
    className: "product-card-education",
    title: "Education",
    status: "Live",
    tag: "Education",
    statusClass: "product-status-green",
    tagClass: "product-status-purple",
    icon: "graduation-cap",
    description: "KabulLearn delivers trilingual courses, guided quizzes, and verified certificates.",
    stat: "KABULLEARN · COURSES · CERTIFICATES",
    pageHref: "education.html"
  },
  {
    id: "software",
    className: "product-card-software",
    title: "Software",
    status: "Available",
    tag: "Apps",
    statusClass: "product-status-primary",
    icon: "blocks",
    description: "Practical applications, systems, and product prototypes.",
    stat: "TOOLS · SYSTEMS · PROTOTYPES",
    pageHref: "softwares.html"
  },
  {
    id: "data",
    className: "product-card-data",
    title: "Data",
    status: "Live",
    tag: "Analytics",
    statusClass: "product-status-green",
    icon: "database",
    description: "Dashboards, data products, and analytical frameworks.",
    stat: "DASHBOARDS · DATA · INSIGHTS",
    pageHref: "data.html"
  },
  {
    id: "labs",
    className: "product-card-labs",
    title: "Labs",
    status: "Research",
    tag: "Ideas",
    statusClass: "product-status-warm",
    icon: "sparkles",
    description: "Research ideas and experiments beyond the main categories.",
    stat: "EXPERIMENTS · NOTES · CONCEPTS",
    pageHref: "others.html"
  }
];

const localFallbackProducts = {
  ml: [
    {
      id: "ocustate",
      name: "OcuState Computer Vision",
      status: "Prototype",
      description: "Real-time drowsiness detection with TensorFlow.js and MediaPipe FaceMesh.",
      detail: "A browser-based machine learning demo that tracks eye and face signals to estimate alertness in real time.",
      href: "ocustate.html",
      action: "Open demo",
      icon: "eye",
      external: true
    }
  ],
  education: [
    {
      id: "kabullearn",
      name: "KabulLearn",
      status: "Live",
      description: "A trilingual Afghan learning platform with structured course pathways, quizzes, and certificates.",
      detail: "KabulLearn supports accessible learning in English, Dari, and Pashto with guided lessons, required checkpoints, and verified certificates.",
      href: "https://www.kabullearn.com",
      action: "Open website",
      icon: "book-open-check",
      external: true
    }
  ],
  software: [
    {
      id: "daftarcha",
      name: "Daftarcha",
      status: "Available",
      description: "Offline-first business management app for inventory, sales, debts, reports, and AI assistance.",
      detail: "Designed for small businesses that need local-first operations, practical reporting, and simple inventory workflows.",
      href: "softwares.html",
      action: "View details",
      icon: "package-check",
      external: false
    },
    {
      id: "moneymate",
      name: "MoneyMate",
      status: "Available",
      description: "Personal finance desktop app for assets, expenses, ledgers, zakat tracking, and protected local accounts.",
      detail: "A local desktop finance tool for tracking net worth, accounts, expenses, asset allocation, and financial records.",
      href: "softwares.html",
      action: "View details",
      icon: "wallet-cards",
      external: false
    }
  ],
  data: [
    {
      id: "datahub",
      name: "DataHub",
      status: "Live",
      description: "Global data explorer connected to World Bank, FAO, and WHO data sources.",
      detail: "DataHub brings indicators, charts, comparisons, and downloads into a single dashboard-style research tool.",
      href: "datahub/",
      action: "Open explorer",
      icon: "database",
      external: true
    }
  ],
  labs: [
    {
      id: "future-labs",
      name: "Future Experiments",
      status: "Research",
      description: "A place for experimental projects, prototypes, and research directions.",
      detail: "Labs will collect emerging experiments that do not yet belong to one of the main product categories.",
      href: "others.html",
      action: "View labs",
      icon: "sparkles",
      external: false
    }
  ]
};

const transition = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 };
const iconMap = {
  "arrow-right": ArrowRight,
  blocks: Blocks,
  "book-open-check": BookOpenCheck,
  "brain-circuit": BrainCircuit,
  database: Database,
  "external-link": ExternalLink,
  eye: Eye,
  "graduation-cap": GraduationCap,
  "loader-circle": LoaderCircle,
  "package-check": PackageCheck,
  sparkles: Sparkles,
  "wallet-cards": WalletCards,
  x: X
};

function Icon({ name }) {
  const Component = iconMap[name] || Sparkles;
  return h(Component, { "aria-hidden": "true" });
}

function ProductThumb() {
  return h(
    "div",
    { className: "product-thumb", "aria-hidden": "true" },
    h("span"),
    h("span"),
    h("span"),
    h("span")
  );
}

function ProductCard({ category, isOpening, onOpen }) {
  return h(
    motion.button,
    {
      type: "button",
      className: `product-card ${category.className} spotlight-tile product-card-button is-visible`,
      layout: true,
      layoutId: `product-card-${category.id}`,
      transition,
      "data-reveal": "item",
      "aria-expanded": isOpening,
      onClick: () => onOpen(category.id)
    },
    ProductThumb(),
    h(
      "div",
      { className: "product-card-heading" },
      Icon({ name: category.icon }),
      h("span", null, category.title)
    ),
    h(
      "div",
      { className: "product-tags" },
      h("span", { className: `product-status ${category.statusClass}` }, category.status),
      h("span", { className: `product-status ${category.tagClass || ""}`.trim() }, category.tag)
    ),
    h("p", null, category.description),
    h("small", { className: "product-stat" }, category.stat),
    h(
      "span",
      { className: "product-card-action" },
      h("span", null, isOpening ? "Loading products" : "View products"),
      Icon({ name: "arrow-right" })
    )
  );
}

function ExpandedProductView({
  category,
  loading,
  products,
  onClose
}) {
  return h(
    motion.section,
    {
      className: `product-expanded-card ${category.className}`,
      layout: true,
      layoutId: `product-card-${category.id}`,
      transition,
      role: "region",
      "aria-labelledby": "product-expanded-title"
    },
    h(
      "div",
      { className: "product-expanded-hero" },
      ProductThumb(),
      h(
        "button",
        {
          type: "button",
          className: "product-expanded-close",
          "aria-label": "Close product view",
          onClick: onClose
        },
        Icon({ name: "x" })
      )
    ),
    h(
      "div",
      { className: "product-expanded-body" },
      h(
        "header",
        { className: "product-expanded-header" },
        h(
          "div",
          { className: "product-card-heading" },
          Icon({ name: category.icon }),
          h("span", null, category.title)
        ),
        h(
          "div",
          { className: "product-tags" },
          h("span", { className: `product-status ${category.statusClass}` }, category.status),
          h("span", { className: `product-status ${category.tagClass || ""}`.trim() }, category.tag)
        ),
        h("h3", { id: "product-expanded-title" }, category.title),
        h("p", null, category.description)
      ),
      loading
        ? h(
            "div",
            { className: "product-expanded-loading", "aria-live": "polite" },
            Icon({ name: "loader-circle" }),
            h("span", null, "Loading product list")
          )
        : products.length > 0
          ? h(
              "div",
              { className: "product-expanded-list", "aria-label": `${category.title} products` },
              products.map((product) =>
                h(
                  motion.article,
                  {
                    key: product.id,
                    className: "product-expanded-item",
                    initial: { opacity: 0, y: 8 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.18 }
                  },
                  h(
                    "div",
                    { className: "product-detail-icon", "aria-hidden": "true" },
                    Icon({ name: product.icon || category.icon })
                  ),
                  h(
                    "div",
                    { className: "product-expanded-item-copy" },
                    h(
                      "div",
                      { className: "product-expanded-item-title" },
                      h("h4", null, product.name),
                      h("span", { className: `product-status ${category.statusClass}` }, product.status || category.status)
                    ),
                    h("p", null, product.detail || product.description)
                  ),
                  h(
                    "a",
                    {
                      className: "product-detail-link",
                      href: product.href,
                      target: product.external ? "_blank" : undefined,
                      rel: product.external ? "noopener noreferrer" : undefined
                    },
                    h("span", null, product.action || "Open product"),
                    Icon({ name: product.external ? "external-link" : "arrow-right" })
                  )
                )
              )
            )
          : h("p", { className: "product-empty-state" }, "Products can be added here later.")
    )
  );
}

function ProductExpander() {
  const [openId, setOpenId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [productLists, setProductLists] = useState({});

  const openCategory = async (categoryId) => {
    setOpenId(categoryId);
    setLoadingId(categoryId);

    try {
      let nextLists = productLists;

      if (!productLists[categoryId]) {
        const response = await fetch("products-data.json");

        if (!response.ok) {
          throw new Error("Could not load product catalog.");
        }

        const catalog = await response.json();
        nextLists = { ...productLists, ...catalog };
        setProductLists(nextLists);
      }

    } catch (error) {
      const nextLists = { ...productLists, ...localFallbackProducts };
      setProductLists(nextLists);
    } finally {
      setLoadingId(null);
    }
  };

  const closeCategory = () => {
    setOpenId(null);
  };

  useEffect(() => {
    document.body.classList.toggle("product-expanded-open", Boolean(openId));

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeCategory();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("product-expanded-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openId]);

  const openCategoryMeta = categories.find((category) => category.id === openId);
  const openProducts = openId ? productLists[openId] || [] : [];

  return h(
    LayoutGroup,
    null,
    h(
      "div",
      { className: "product-grid", "data-spotlight-grid": true },
      categories.map((category) => {
        if (openId === category.id) {
          return h(motion.div, {
            key: `${category.id}-placeholder`,
            className: `product-card ${category.className} product-card-placeholder`,
            layout: true,
            "aria-hidden": "true"
          });
        }

        return h(ProductCard, {
          key: category.id,
          category,
          isOpening: loadingId === category.id,
          onOpen: openCategory
        });
      })
    ),
    h(
      AnimatePresence,
      null,
      openCategoryMeta
        ? h(motion.div, {
            key: "product-expanded-backdrop",
            className: "product-expanded-backdrop",
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            transition: { duration: 0.22, ease: "easeOut" },
            onClick: closeCategory
          })
        : null
    ),
    h(
      AnimatePresence,
      null,
      openCategoryMeta
        ? h(ExpandedProductView, {
            key: openCategoryMeta.id,
            category: openCategoryMeta,
            loading: loadingId === openCategoryMeta.id,
            products: openProducts,
            onClose: closeCategory
          })
        : null
    )
  );
}

const rootElement = document.getElementById("product-expander-root");

if (rootElement) {
  createRoot(rootElement).render(h(ProductExpander));
}
