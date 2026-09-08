// script.js
// Busca de receitas usando a Spoonacular API.
// Organização: (1) referências ao DOM, (2) funções de chamada à API (fetch/async-await),
// (3) funções de renderização (DOM), (4) listeners de evento.

// ---------- 1. Referências ao DOM ----------
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const randomBtn = document.getElementById("random-btn");
const statusArea = document.getElementById("status-area");
const resultsEl = document.getElementById("results");

const modalOverlay = document.getElementById("modal-overlay");
const modalBody = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close");

// ---------- 2. Chamadas assíncronas à API ----------

// Monta a URL com os parâmetros da Spoonacular, incluindo a chave do config.js.
function buildUrl(path, params = {}) {
  const url = new URL(CONFIG.BASE_URL + path);
  url.searchParams.set("apiKey", CONFIG.API_KEY);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

// Busca receitas por texto livre (ingrediente, prato, vontade do momento).
async function searchRecipes(query) {
  const url = buildUrl("/recipes/complexSearch", {
    query,
    number: 12,
    addRecipeInformation: true,
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = await response.json();
  return data.results; // array de receitas
}

// Busca uma receita aleatória.
async function fetchRandomRecipe() {
  const url = buildUrl("/recipes/random", { number: 1 });
  const response = await fetch(url);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  const data = await response.json();
  return data.recipes[0];
}

// Busca os detalhes completos de uma receita (ingredientes + modo de preparo).
async function fetchRecipeDetails(id) {
  const url = buildUrl(`/recipes/${id}/information`);
  const response = await fetch(url);

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.json();
}

// Traduz respostas de erro da API (401, 402, 404...) em mensagens legíveis.
async function buildApiError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body.message || "";
  } catch {
    // corpo sem JSON válido — ignora e usa a mensagem genérica abaixo
  }

  if (response.status === 401) {
    return new Error("Chave de API inválida ou ausente. Configure CONFIG.API_KEY em config.js.");
  }
  if (response.status === 402) {
    return new Error("Cota diária da Spoonacular API esgotada. Tente novamente amanhã ou use outra chave.");
  }
  if (response.status === 404) {
    return new Error("Receita não encontrada.");
  }
  return new Error(detail || `Erro na API (código ${response.status}).`);
}

// ---------- 3. Renderização (DOM) ----------

function showStatus(message, type) {
  statusArea.hidden = false;
  statusArea.className = `status-area ${type}`;
  statusArea.textContent = message;
}

function hideStatus() {
  statusArea.hidden = true;
  statusArea.textContent = "";
}

function renderSkeletons(count = 6) {
  resultsEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "skeleton-card";
    resultsEl.appendChild(el);
  }
}

function clearResults() {
  resultsEl.innerHTML = "";
}

function renderRecipeCards(recipes) {
  resultsEl.innerHTML = "";

  recipes.forEach((recipe) => {
    const card = document.createElement("button");
    card.className = "recipe-card";
    card.type = "button";
    card.setAttribute("aria-label", `Ver detalhes de ${recipe.title}`);

    const readyTime = recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : "—";
    const servings = recipe.servings ? `${recipe.servings} porções` : "—";

    card.innerHTML = `
      <img src="${recipe.image || ""}" alt="${recipe.title}" loading="lazy">
      <div class="recipe-card-body">
        <p class="recipe-title">${recipe.title}</p>
        <div class="recipe-meta">
          <span>⏱ ${readyTime}</span>
          <span>🍽 ${servings}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => openRecipeModal(recipe.id));
    resultsEl.appendChild(card);
  });
}

function renderModalContent(recipe) {
  const ingredients = (recipe.extendedIngredients || [])
    .map((ing) => `<li>${ing.original}</li>`)
    .join("");

  const steps = recipe.analyzedInstructions?.[0]?.steps || [];
  const instructions = steps.length
    ? steps.map((step) => `<li>${step.step}</li>`).join("")
    : "<li>Instruções detalhadas não disponíveis para esta receita — consulte a fonte original.</li>";

  modalBody.innerHTML = `
    <img src="${recipe.image || ""}" alt="${recipe.title}">
    <h2>${recipe.title}</h2>
    <div class="modal-meta">
      <span>⏱ ${recipe.readyInMinutes ?? "—"} min</span>
      <span>🍽 ${recipe.servings ?? "—"} porções</span>
      <span>❤️ ${recipe.aggregateLikes ?? 0} curtidas</span>
    </div>
    <h3>Ingredientes</h3>
    <ul>${ingredients || "<li>Não informado.</li>"}</ul>
    <h3>Modo de preparo</h3>
    <ol>${instructions}</ol>
  `;
}

function openModalShell(loadingText) {
  modalBody.innerHTML = `<p class="modal-summary">${loadingText}</p>`;
  modalOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modalOverlay.hidden = true;
  document.body.style.overflow = "";
}

// ---------- 4. Orquestração + listeners de evento ----------

async function handleSearch(query) {
  if (!query.trim()) {
    showStatus("Digite algo para buscar — um prato, um ingrediente ou uma vontade.", "error");
    clearResults();
    return;
  }

  hideStatus();
  renderSkeletons();
  searchBtn.disabled = true;

  try {
    const recipes = await searchRecipes(query.trim());

    if (recipes.length === 0) {
      clearResults();
      showStatus(`Nenhuma receita encontrada para "${query}". Tente outro termo.`, "empty");
      return;
    }

    renderRecipeCards(recipes);
  } catch (error) {
    clearResults();
    // Distingue falha de rede (offline, DNS, CORS) de erro retornado pela API.
    if (error instanceof TypeError) {
      showStatus("Não foi possível conectar à API. Verifique sua internet e tente novamente.", "error");
    } else {
      showStatus(error.message, "error");
    }
  } finally {
    searchBtn.disabled = false;
  }
}

async function openRecipeModal(id) {
  openModalShell("Carregando receita...");
  try {
    const recipe = await fetchRecipeDetails(id);
    renderModalContent(recipe);
  } catch (error) {
    modalBody.innerHTML = `<p class="modal-summary">Erro ao carregar a receita: ${error.message}</p>`;
  }
}

async function handleRandomRecipe() {
  hideStatus();
  randomBtn.disabled = true;
  openModalShell("Sorteando uma receita...");
  try {
    const recipe = await fetchRandomRecipe();
    // A resposta de /recipes/random já vem completa, sem precisar de uma segunda chamada.
    renderModalContent(recipe);
  } catch (error) {
    modalBody.innerHTML = `<p class="modal-summary">Erro: ${error.message}</p>`;
  } finally {
    randomBtn.disabled = false;
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  handleSearch(searchInput.value);
});

randomBtn.addEventListener("click", handleRandomRecipe);

modalCloseBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalOverlay.hidden) closeModal();
});
