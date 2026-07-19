const PAGE_SIZE = 10;

let indexPages = [];
let filteredPages = [];
let currentPage = 1;

const home = document.getElementById("home");
const results = document.getElementById("results");
const homeForm = document.getElementById("homeForm");
const homeInput = document.getElementById("homeInput");
const resultsForm = document.getElementById("resultsForm");
const resultsInput = document.getElementById("resultsInput");
const homeStatus = document.getElementById("homeStatus");
const resultCount = document.getElementById("resultCount");
const resultList = document.getElementById("resultList");
const pagination = document.getElementById("pagination");

function normalise(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function calculateScore(page, terms) {
  const title = normalise(page.title);
  const description = normalise(page.description);
  const text = normalise(page.text);
  const domain = normalise(page.domain);

  let score = 0;

  for (const term of terms) {
    if (title === term) score += 100;
    if (title.includes(term)) score += 30;
    if (description.includes(term)) score += 12;
    if (domain.includes(term)) score += 10;
    if (text.includes(term)) score += 2;
  }

  return score;
}

function search(query) {
  const terms = normalise(query).split(" ").filter(Boolean);

  if (!terms.length) {
    filteredPages = [...indexPages].sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""))
    );
  } else {
    filteredPages = indexPages
      .map(page => ({ page, score: calculateScore(page, terms) }))
      .filter(item => item.score > 0)
      .sort((a, b) =>
        b.score - a.score ||
        String(a.page.title || "").localeCompare(String(b.page.title || ""))
      )
      .map(item => item.page);
  }

  currentPage = 1;
  showResults(query);
}

function showResults(query) {
  home.classList.add("hidden");
  results.classList.remove("hidden");
  resultsInput.value = query;
  renderResults();
}

function renderResults() {
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageResults = filteredPages.slice(start, start + PAGE_SIZE);

  resultCount.textContent =
    `${filteredPages.length.toLocaleString()} result${filteredPages.length === 1 ? "" : "s"}`;

  resultList.innerHTML = "";

  if (!pageResults.length) {
    resultList.innerHTML =
      '<p class="empty">No indexed pages match that search.</p>';
  } else {
    for (const page of pageResults) {
      const article = document.createElement("article");
      article.className = "result-item";

      const shownUrl = document.createElement("div");
      shownUrl.className = "result-url";
      shownUrl.textContent = page.url;

      const heading = document.createElement("h2");
      const link = document.createElement("a");
      link.href = page.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = page.title || page.url;
      heading.appendChild(link);

      const snippet = document.createElement("p");
      snippet.textContent = normalise(page.description || page.text).slice(0, 280);

      article.append(shownUrl, heading, snippet);
      resultList.appendChild(article);
    }
  }

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  pagination.innerHTML = "";

  if (totalPages <= 1) return;

  for (let page = 1; page <= totalPages; page += 1) {
    if (
      totalPages > 14 &&
      page > 3 &&
      page < currentPage - 2
    ) continue;

    if (
      totalPages > 14 &&
      page > currentPage + 2 &&
      page < totalPages - 1
    ) continue;

    const button = document.createElement("button");
    button.textContent = String(page);

    if (page === currentPage) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      currentPage = page;
      renderResults();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    pagination.appendChild(button);
  }
}

homeForm.addEventListener("submit", event => {
  event.preventDefault();
  search(homeInput.value);
});

resultsForm.addEventListener("submit", event => {
  event.preventDefault();
  search(resultsInput.value);
});

resultsInput.addEventListener("input", () => {
  search(resultsInput.value);
});

document.getElementById("browseAll").addEventListener("click", () => {
  search("");
});

document.getElementById("backHome").addEventListener("click", () => {
  results.classList.add("hidden");
  home.classList.remove("hidden");
});

fetch("data/index.json", { cache: "no-store" })
  .then(response => {
    if (!response.ok) throw new Error("Index not found");
    return response.json();
  })
  .then(data => {
    indexPages = Array.isArray(data) ? data : [];
    homeStatus.textContent =
      `${indexPages.length.toLocaleString()} indexed page${indexPages.length === 1 ? "" : "s"}`;
  })
  .catch(() => {
    homeStatus.textContent = "Index unavailable. Run the crawler workflow.";
  });
