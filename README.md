# 🧊 Geladeira Aberta

Aplicação web que sugere **receitas a partir dos ingredientes que você já tem em casa**, usando a [Spoonacular Food API](https://spoonacular.com/food-api).

> Projeto da disciplina de Desenvolvimento Web – consumo de API com JavaScript assíncrono.

**Equipe:** Roberto Brittes Gebauer, Saulo Gabriel dos Santos Souza

## Problema que resolve

Muita gente não sabe o que cozinhar com o que sobrou na geladeira e acaba desperdiçando comida. O usuário digita os ingredientes e o app mostra receitas ordenadas por quantos deles são aproveitados, além do que falta comprar.

## Funcionalidades

- Adicionar e remover ingredientes (chips) com Enter ou botão
- Sugestões rápidas de ingredientes
- Busca de receitas com indicação de ingredientes que você tem e que faltam
- Modal com tempo de preparo, porções, ingredientes e modo de preparo
- Tratamento de erros: campo vazio, sem resultados, offline, timeout, chave inválida (401), limite diário (402) e excesso de requisições (429)

## Endpoints utilizados

| Endpoint | Uso |
|---|---|
| `GET /recipes/findByIngredients` | Lista receitas a partir dos ingredientes |
| `GET /recipes/{id}/information` | Detalhes de uma receita |

## Arquitetura

```
geladeira-receitas/
├── index.html         # estrutura da página
├── style.css          # estilos
├── script.js          # lógica (ver seções abaixo)
├── config.example.js  # modelo de configuração da chave
├── config.js          # sua chave (ignorado pelo Git)
└── .gitignore
```

`script.js` é dividido em 5 seções:

1. **Estado e DOM** – objeto `state` e referências `el` aos elementos.
2. **Camada de API** – função `request()` com `fetch`, `async/await`, `AbortController` (timeout de 10 s) e a classe `ApiError`, que converte falhas técnicas em mensagens amigáveis.
3. **Renderização** – função auxiliar `h()` que cria elementos com `textContent` (evita XSS) e funções `renderChips`, `renderRecipes` e `renderRecipeDetails`.
4. **Eventos** – `click`, `keydown`, `submit`, `online`/`offline`. Um contador `requestId` impede que uma resposta antiga substitua uma busca mais recente.
5. **Inicialização** – monta as sugestões iniciais.

## Como executar

1. Crie uma conta gratuita em <https://spoonacular.com/food-api/console#Dashboard> e copie sua **API Key**.
2. Clone o repositório:
   ```bash
   git clone <URL-DO-REPOSITORIO>
   cd geladeira-receitas
   ```
3. Copie o modelo de configuração e cole sua chave:
   ```bash
   cp config.example.js config.js
   ```
   ```js
   const CONFIG = { API_KEY: "sua-chave-aqui", BASE_URL: "https://api.spoonacular.com" };
   ```
4. Abra o `index.html` no navegador (ou use a extensão *Live Server* do VS Code).

> ⚠️ O plano gratuito tem limite diário de pontos. A API funciona com ingredientes em **inglês**.

## Tecnologias

HTML5, CSS3, JavaScript (ES2020), Fetch API, `<dialog>`.
