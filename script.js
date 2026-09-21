"use strict";

/* =========================================================
   Geladeira Aberta – busca de receitas pelos ingredientes
   API: Spoonacular (https://spoonacular.com/food-api)
   Estrutura do arquivo:
     1. Estado e referências do DOM
     2. Camada de API (fetch assíncrono + tratamento de erros)
     3. Funções de renderização (DOM)
     4. Manipuladores de eventos
     5. Inicialização
   ========================================================= */

/* ---------- 1. Estado e referências do DOM ---------- */

const state = {
  ingredients: [],   // ingredientes escolhidos pelo usuário
  requestId: 0,      // evita que uma resposta antiga sobrescreva uma nova
};

const SUGGESTIONS = ["chicken", "tomato", "rice", "eggs", "cheese", "potato"];

const el = {
  form: document.getElementById("search-form"),
  input: document.getElementById("ingredient-input"),
  addBtn: document.getElementById("add-btn"),
  chips: document.getElementById("chips"),
  suggestions: document.getElementById("suggestions"),
  searchBtn: document.getElementById("search-btn"),
  status: document.getElementById("status"),
  results: document.getElementById("results"),
  dialog: document.getElementById("recipe-dialog"),
  dialogBody: document.getElementById("dialog-body"),
  closeDialog: document.getElementById("close-dialog"),
};

/* ---------- 2. Camada de API ---------- */

class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

function messageForStatus(status) {
  switch (status) {
    case 401:
      return "Chave da API inválida. Confira o arquivo config.js.";
    case 402:
      return "O limite diário de requisições da API foi atingido. Tente amanhã ou use outra chave.";
    case 404:
      return "Receita não encontrada.";
    case 429:
      return "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente de novo.";
    default:
      return `A API respondeu com erro (código ${status}). Tente novamente.`;
  }
}

/**
 * Faz uma requisição GET para a Spoonacular e devolve o JSON.
 * Sempre lança um ApiError com mensagem amigável quando algo falha.
 */
async function request(path, params = {}) {
  if (CONFIG.API_KEY.includes("COLE_SUA_CHAVE")) {
    throw new ApiError("Adicione sua chave da Spoonacular no arquivo config.js.", "no-key");
  }
  if (!navigator.onLine) {
    throw new ApiError("Você está sem conexão com a internet. Conecte-se e tente de novo.", "offline");
  }

  const url = new URL(CONFIG.BASE_URL + path);
  url.search = new URLSearchParams({ ...params, apiKey: CONFIG.API_KEY });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // timeout de 10 s

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new ApiError(messageForStatus(response.status), response.status);
    }
    return await response.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === "AbortError") {
      throw new ApiError("A busca demorou demais. Verifique sua conexão e tente novamente.", "timeout");
    }
    throw new ApiError("Não foi possível conectar à API. Verifique sua internet.", "network");
  } finally {
    clearTimeout(timer);
  }
}

function findRecipesByIngredients(ingredients) {
  return request("/recipes/findByIngredients", {
    ingredients: ingredients.join(","),
    number: 12,
    ranking: 1,          // prioriza receitas que usam mais dos seus ingredientes
    ignorePantry: true,  // ignora sal, água, óleo etc.
  });
}

function getRecipeDetails(id) {
  return request(`/recipes/${id}/information`, { includeNutrition: false });
}

/* ---------- 3. Renderização (manipulação do DOM) ---------- */

/** Cria um elemento com atributos e filhos. Usa textContent (seguro contra XSS). */
function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function setStatus(message, { error = false, loading = false } = {}) {
  el.status.textContent = message;
  el.status.className = error ? "error" : loading ? "loading-dots" : "";
}

function renderChips() {
  el.chips.replaceChildren(
    ...state.ingredients.map((name) => {
      const remove = h("button", { type: "button", "aria-label": `Remover ${name}` }, "×");
      remove.addEventListener("click", () => removeIngredient(name));
      return h("li", {}, name, remove);
    })
  );
}

function renderSuggestions() {
  SUGGESTIONS.forEach((name) => {
    const btn = h("button", { type: "button" }, name);
    btn.addEventListener("click", () => addIngredient(name));
    el.suggestions.append(btn);
  });
}

function renderRecipes(recipes) {
  el.results.replaceChildren(
    ...recipes.map((recipe) => {
      const total = recipe.usedIngredientCount + recipe.missedIngredientCount;
      const complete = recipe.missedIngredientCount === 0;

      const match = h(
        "span",
        { class: complete ? "match full" : "match" },
        complete
          ? "Você tem tudo!"
          : `Você tem ${recipe.usedIngredientCount} de ${total} ingredientes`
      );

      const body = h("div", { class: "card-body" }, h("h2", {}, recipe.title), match);

      if (!complete) {
        const names = recipe.missedIngredients.map((i) => i.name).join(", ");
        body.append(h("p", { class: "missing" }, `Falta: ${names}`));
      }

      const detailsBtn = h("button", { type: "button" }, "Ver receita");
      detailsBtn.addEventListener("click", () => openRecipe(recipe.id));
      body.append(detailsBtn);

      const img = h("img", { src: recipe.image, alt: recipe.title, loading: "lazy" });
      return h("article", { class: "card" }, img, body);
    })
  );
}

/** O campo "summary" vem com HTML. Convertemos para texto puro. */
function htmlToText(html) {
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}

function renderRecipeDetails(recipe) {
  const steps = recipe.analyzedInstructions?.[0]?.steps ?? [];

  const content = [
    h("img", { src: recipe.image, alt: recipe.title }),
    h("h2", {}, recipe.title),
    h("p", { class: "meta" }, `${recipe.readyInMinutes} min • ${recipe.servings} porções`),
    h("p", {}, htmlToText(recipe.summary).split(". ").slice(0, 2).join(". ") + "."),
    h("h3", {}, "Ingredientes"),
    h("ul", {}, ...recipe.extendedIngredients.map((i) => h("li", {}, i.original))),
    h("h3", {}, "Modo de preparo"),
  ];

  content.push(
    steps.length
      ? h("ol", {}, ...steps.map((s) => h("li", {}, s.step)))
      : h("p", {}, "Esta receita não tem passo a passo cadastrado.")
  );

  el.dialogBody.replaceChildren(...content);
}

/* ---------- 4. Ações e eventos ---------- */

function addIngredient(raw) {
  const name = raw.trim().toLowerCase();
  if (!name) return;
  if (!state.ingredients.includes(name)) {
    state.ingredients.push(name);
    renderChips();
  }
  el.input.value = "";
  el.input.focus();
}

function removeIngredient(name) {
  state.ingredients = state.ingredients.filter((i) => i !== name);
  renderChips();
}

async function searchRecipes() {
  // Aproveita o que ficou digitado no campo sem apertar "Adicionar"
  if (el.input.value.trim()) addIngredient(el.input.value);

  if (state.ingredients.length === 0) {
    el.results.replaceChildren();
    setStatus("Adicione pelo menos um ingrediente antes de buscar.", { error: true });
    return;
  }

  const myRequest = ++state.requestId;
  el.searchBtn.disabled = true;
  el.results.replaceChildren();
  setStatus("Procurando receitas", { loading: true });

  try {
    const recipes = await findRecipesByIngredients(state.ingredients);
    if (myRequest !== state.requestId) return; // chegou uma busca mais nova

    if (recipes.length === 0) {
      setStatus("Nenhuma receita encontrada. Confira se os nomes estão em inglês ou tente outros ingredientes.", { error: true });
      return;
    }
    setStatus(`${recipes.length} receitas encontradas.`);
    renderRecipes(recipes);
  } catch (err) {
    setStatus(err.message, { error: true });
    console.warn("Falha na busca:", err.code, err.message);
  } finally {
    el.searchBtn.disabled = false;
  }
}

async function openRecipe(id) {
  el.dialogBody.replaceChildren(h("p", { class: "loading-dots" }, "Carregando receita"));
  el.dialog.showModal();
  try {
    renderRecipeDetails(await getRecipeDetails(id));
  } catch (err) {
    el.dialogBody.replaceChildren(h("p", { class: "error" }, err.message));
  }
}

el.addBtn.addEventListener("click", () => addIngredient(el.input.value));

el.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addIngredient(el.input.value);
  }
});

el.form.addEventListener("submit", (event) => {
  event.preventDefault();
  searchRecipes();
});

el.closeDialog.addEventListener("click", () => el.dialog.close());

// Fecha o modal ao clicar fora dele
el.dialog.addEventListener("click", (event) => {
  if (event.target === el.dialog) el.dialog.close();
});

window.addEventListener("offline", () =>
  setStatus("Conexão perdida. Você está offline.", { error: true })
);
window.addEventListener("online", () => setStatus("Conexão restabelecida."));

/* ---------- 5. Inicialização ---------- */
renderSuggestions();
