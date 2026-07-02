const STORAGE_KEY = "kodomoMuseumArtworks";

const state = {
  artworks: [],
  currentRoute: "home",
  galleryItems: [],
  galleryIndex: 0,
  selectedImage: "",
};

const views = document.querySelectorAll(".view");
const routeLinks = document.querySelectorAll("[data-route]");
const todayTitle = document.querySelector("#today-title");
const todayCopy = document.querySelector("#today-copy");
const todayArtwork = document.querySelector("#today-artwork");
const artworkGrid = document.querySelector("#artwork-grid");
const galleryArtwork = document.querySelector("#gallery-artwork");
const galleryStage = document.querySelector("#gallery-stage");
const galleryEmpty = document.querySelector("#gallery-empty");
const filterType = document.querySelector("#filter-type");
const filterValue = document.querySelector("#filter-value");
const filterValueWrap = document.querySelector("#filter-value-wrap");
const form = document.querySelector("#artwork-form");
const imageInput = document.querySelector("#image-input");
const imagePreview = document.querySelector("#image-preview");
const formMessage = document.querySelector("#form-message");
const detailContent = document.querySelector("#detail-content");

function loadArtworks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state.artworks = saved ? JSON.parse(saved) : [];
  } catch {
    state.artworks = [];
  }
}

function saveArtworks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.artworks));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "日付未設定";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}

function getMonthKey(value) {
  return value ? value.slice(0, 7) : "日付未設定";
}

function getTodayArtwork() {
  if (!state.artworks.length) return null;
  const dateKey = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const index = Number(dateKey) % state.artworks.length;
  return state.artworks[index];
}

function plateHtml(artwork, className = "art-plate") {
  return `
    <div class="${className}">
      <strong>${escapeHtml(artwork.title)}</strong>
      <span>${escapeHtml(artwork.artist)} / ${escapeHtml(artwork.age)}歳 / ${escapeHtml(formatDate(artwork.date))}</span>
    </div>
  `;
}

function artworkImageHtml(artwork, altPrefix = "作品") {
  return `<img src="${artwork.image}" alt="${escapeHtml(`${altPrefix}：${artwork.title}`)}" />`;
}

function renderHome() {
  const artwork = getTodayArtwork();
  if (!artwork) {
    todayTitle.textContent = "最初の作品をお待ちしています";
    todayCopy.textContent =
      "ここは、できあがった作品を静かに飾っておける小さな展示室です。まずは1枚、写真を選んで作品プレートを添えてみましょう。";
    todayArtwork.className = "featured-frame empty-state";
    todayArtwork.innerHTML =
      '<div class="empty-art"><span class="empty-art-title">First Exhibition</span><span>ここに作品が飾られます</span></div>';
    return;
  }

  todayTitle.textContent = artwork.title;
  todayCopy.textContent = artwork.comment || "今日はこの作品をゆっくり眺めてみましょう。";
  todayArtwork.className = "featured-frame";
  todayArtwork.innerHTML = `${artworkImageHtml(artwork, "今日の展示作品")}${plateHtml(artwork)}`;
}

function renderList() {
  if (!state.artworks.length) {
    artworkGrid.innerHTML = '<div class="notice">作品がありません。追加画面から登録してください。</div>';
    return;
  }

  artworkGrid.innerHTML = state.artworks
    .map(
      (artwork) => `
        <article class="art-card">
          <button type="button" data-detail-id="${artwork.id}" aria-label="${escapeHtml(artwork.title)}の詳細を見る">
            ${artworkImageHtml(artwork)}
            <span class="favorite-mark" aria-label="${artwork.favorite ? "お気に入り" : "通常"}">${artwork.favorite ? "★" : "☆"}</span>
            <div class="art-card-body">
              <h2>${escapeHtml(artwork.title)}</h2>
              <p>${escapeHtml(artwork.age)}歳 / ${escapeHtml(formatDate(artwork.date))}</p>
            </div>
          </button>
        </article>
      `
    )
    .join("");
}

function updateFilterOptions() {
  const type = filterType.value;
  const values = new Set();

  state.artworks.forEach((artwork) => {
    if (type === "age") values.add(`${artwork.age}`);
    if (type === "tag") artwork.tags.forEach((tag) => values.add(tag));
    if (type === "month") values.add(getMonthKey(artwork.date));
  });

  if (type === "all" || type === "favorite") {
    filterValueWrap.classList.add("hidden");
    filterValue.innerHTML = "";
    return;
  }

  const sortedValues = [...values].sort((a, b) => a.localeCompare(b, "ja"));
  filterValueWrap.classList.remove("hidden");
  filterValue.innerHTML = sortedValues.length
    ? sortedValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")
    : '<option value="">条件なし</option>';
}

function getFilteredArtworks() {
  const type = filterType.value;
  const value = filterValue.value;

  if (type === "favorite") return state.artworks.filter((artwork) => artwork.favorite);
  if (type === "age") return state.artworks.filter((artwork) => `${artwork.age}` === value);
  if (type === "tag") return state.artworks.filter((artwork) => artwork.tags.includes(value));
  if (type === "month") return state.artworks.filter((artwork) => getMonthKey(artwork.date) === value);
  return [...state.artworks];
}

function renderGallery() {
  updateFilterOptions();
  state.galleryItems = getFilteredArtworks();
  if (state.galleryIndex >= state.galleryItems.length) state.galleryIndex = 0;

  if (!state.galleryItems.length) {
    galleryStage.classList.add("hidden");
    galleryEmpty.classList.remove("hidden");
    galleryArtwork.innerHTML = "";
    return;
  }

  galleryStage.classList.remove("hidden");
  galleryEmpty.classList.add("hidden");
  const artwork = state.galleryItems[state.galleryIndex];
  galleryArtwork.innerHTML = `
    <div class="museum-image-wrap">${artworkImageHtml(artwork, "展示作品")}</div>
    ${plateHtml(artwork, "museum-plate")}
  `;
}

function moveGallery(direction) {
  if (!state.galleryItems.length) return;
  state.galleryIndex = (state.galleryIndex + direction + state.galleryItems.length) % state.galleryItems.length;
  renderGallery();
}

function renderDetail(id) {
  const artwork = state.artworks.find((item) => item.id === id);
  if (!artwork) {
    navigate("list");
    return;
  }

  detailContent.innerHTML = `
    <div class="detail-image-wrap">${artworkImageHtml(artwork, "作品詳細")}</div>
    <div class="detail-text">
      <p class="eyebrow">Artwork Detail</p>
      <h1 id="detail-title">${escapeHtml(artwork.title)}</h1>
      <div class="meta-list">
        <div>作者：${escapeHtml(artwork.artist)}</div>
        <div>年齢：${escapeHtml(artwork.age)}歳</div>
        <div>制作日：${escapeHtml(formatDate(artwork.date))}</div>
      </div>
      <div class="button-row">
        <button class="ghost-button" type="button" data-toggle-favorite="${artwork.id}">
          ${artwork.favorite ? "★ お気に入り解除" : "☆ お気に入り登録"}
        </button>
        <button class="danger-button" type="button" data-delete-id="${artwork.id}">削除</button>
      </div>
      <section class="detail-block">
        <h2>コメント</h2>
        <p>${escapeHtml(artwork.comment || "未入力")}</p>
      </section>
      <section class="detail-block">
        <h2>子供の説明</h2>
        <p>${escapeHtml(artwork.story || "未入力")}</p>
      </section>
      <section class="detail-block">
        <h2>タグ</h2>
        <div class="tag-list">
          ${(artwork.tags.length ? artwork.tags : ["タグなし"]).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </section>
    </div>
  `;
  navigate("detail");
}

function setActiveLinks(route) {
  routeLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.route === route);
  });
}

function navigate(route) {
  const previousRoute = state.currentRoute;
  state.currentRoute = route;
  views.forEach((view) => view.classList.toggle("active", view.id === route));
  setActiveLinks(route);
  window.location.hash = route;
  if (previousRoute !== route) window.scrollTo({ top: 0, behavior: "smooth" });

  if (route === "home") renderHome();
  if (route === "gallery") renderGallery();
  if (route === "list") renderList();
}

function resetForm() {
  form.reset();
  state.selectedImage = "";
  imagePreview.textContent = "画像プレビュー";
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.selectedImage = reader.result;
    imagePreview.innerHTML = `<img src="${state.selectedImage}" alt="選択した画像のプレビュー" />`;
  });
  reader.readAsDataURL(file);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);

  if (!state.selectedImage) {
    formMessage.textContent = "画像を選択してください。";
    return;
  }

  const artwork = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    image: state.selectedImage,
    title: data.get("title").trim(),
    artist: data.get("artist").trim(),
    age: data.get("age"),
    date: data.get("date"),
    comment: data.get("comment").trim(),
    story: data.get("story").trim(),
    tags: parseTags(data.get("tags")),
    favorite: data.get("favorite") === "on",
    createdAt: new Date().toISOString(),
  };

  try {
    state.artworks.unshift(artwork);
    saveArtworks();
    formMessage.textContent = "保存しました。";
    resetForm();
    renderHome();
    renderList();
    renderGallery();
    renderDetail(artwork.id);
  } catch {
    state.artworks.shift();
    formMessage.textContent = "保存容量を超えた可能性があります。画像サイズを小さくしてください。";
  }
});

document.addEventListener("click", (event) => {
  const routeLink = event.target.closest("[data-route]");
  if (routeLink) {
    event.preventDefault();
    navigate(routeLink.dataset.route);
    return;
  }

  const detailButton = event.target.closest("[data-detail-id]");
  if (detailButton) {
    renderDetail(detailButton.dataset.detailId);
    return;
  }

  const favoriteButton = event.target.closest("[data-toggle-favorite]");
  if (favoriteButton) {
    const artwork = state.artworks.find((item) => item.id === favoriteButton.dataset.toggleFavorite);
    if (artwork) {
      artwork.favorite = !artwork.favorite;
      saveArtworks();
      renderDetail(artwork.id);
    }
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    const ok = confirm("この作品を削除しますか？");
    if (!ok) return;
    state.artworks = state.artworks.filter((item) => item.id !== deleteButton.dataset.deleteId);
    saveArtworks();
    renderHome();
    renderList();
    renderGallery();
    navigate("list");
  }
});

document.querySelector("#prev-art").addEventListener("click", () => moveGallery(-1));
document.querySelector("#next-art").addEventListener("click", () => moveGallery(1));
document.querySelector("#back-to-list").addEventListener("click", () => navigate("list"));

filterType.addEventListener("change", () => {
  state.galleryIndex = 0;
  renderGallery();
});

filterValue.addEventListener("change", () => {
  state.galleryIndex = 0;
  renderGallery();
});

let touchStartX = 0;

galleryStage.addEventListener(
  "touchstart",
  (event) => {
    touchStartX = event.changedTouches[0].screenX;
  },
  { passive: true }
);

galleryStage.addEventListener(
  "touchend",
  (event) => {
    const diff = event.changedTouches[0].screenX - touchStartX;
    if (Math.abs(diff) < 48) return;
    moveGallery(diff > 0 ? -1 : 1);
  },
  { passive: true }
);

window.addEventListener("hashchange", () => {
  const route = window.location.hash.replace("#", "") || "home";
  if (document.getElementById(route)) navigate(route);
});

loadArtworks();
renderHome();
renderList();
renderGallery();
navigate(window.location.hash.replace("#", "") || "home");
