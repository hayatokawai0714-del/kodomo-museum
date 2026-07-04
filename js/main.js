const STORAGE_KEY = "kodomoMuseumArtworks";
const FAMILY_CODE_STORAGE_KEY = "kodomoMuseumFamilyCode";
const API_BASE = "/api";
const IMAGE_MAX_EDGE = 1200;
const JPEG_QUALITY = 0.72;
const STORAGE_SOFT_LIMIT_BYTES = 4.5 * 1024 * 1024;

const state = {
  artworks: [],
  currentRoute: "home",
  galleryItems: [],
  galleryIndex: 0,
  selectedImage: "",
  selectedImageSize: 0,
  cloudImageObjectUrls: [],
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
const storageStatus = document.querySelector("#storage-status");
const detailContent = document.querySelector("#detail-content");
const cloudMessage = document.querySelector("#cloud-message");
const museumGate = document.querySelector("#museum-gate");
const gateForm = document.querySelector("#gate-form");
const gateKeyInput = document.querySelector("#gate-key-input");
const gateMessage = document.querySelector("#gate-message");
const resetFamilyCodeButton = document.querySelector("#reset-family-code");

function getFamilyCode() {
  try {
    return localStorage.getItem(FAMILY_CODE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveFamilyCode(code) {
  try {
    const trimmedCode = String(code || "").trim();
    if (trimmedCode) {
      localStorage.setItem(FAMILY_CODE_STORAGE_KEY, trimmedCode);
    } else {
      localStorage.removeItem(FAMILY_CODE_STORAGE_KEY);
    }
  } catch {
    // Keep the LocalStorage artwork flow working even if code storage fails.
  }
}

function setCloudMessage(message, isError = false) {
  if (!cloudMessage) return;
  cloudMessage.textContent = message;
  cloudMessage.classList.toggle("error", isError);
}

function setGateMessage(message) {
  if (gateMessage) gateMessage.textContent = message;
}

function showGate(message = "") {
  if (!museumGate) return;
  museumGate.classList.remove("hidden", "closing");
  museumGate.setAttribute("aria-hidden", "false");
  document.body.classList.add("gate-locked");
  setGateMessage(message);
  if (gateKeyInput) {
    gateKeyInput.value = "";
    gateKeyInput.focus();
  }
}

function hideGate() {
  if (!museumGate) return;
  museumGate.classList.add("closing");
  museumGate.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    museumGate.classList.add("hidden");
    museumGate.classList.remove("closing");
    document.body.classList.remove("gate-locked");
  }, 420);
}

function getApiHeaders(headers = {}) {
  const apiHeaders = new Headers(headers);
  const familyCode = getFamilyCode();
  if (familyCode) apiHeaders.set("X-Family-Code", familyCode);
  return apiHeaders;
}

async function readApiJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestApi(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: getApiHeaders(options.headers),
  });
  const body = await readApiJson(response);
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || "API request failed");
  }
  return body;
}

async function fetchArtworksFromApi() {
  try {
    const body = await requestApi("/artworks");
    return body.artworks || [];
  } catch (error) {
    console.warn("Failed to fetch artworks from API.", error);
    return null;
  }
}

async function fetchArtworksWithFamilyCode(code) {
  try {
    const response = await fetch(`${API_BASE}/artworks`, {
      headers: { "X-Family-Code": String(code || "").trim() },
    });
    const body = await readApiJson(response);
    if (!response.ok || body?.ok === false) return null;
    return body?.artworks || [];
  } catch (error) {
    console.warn("Failed to fetch artworks from API.", error);
    return null;
  }
}

async function uploadArtworkImage(imageData, fileName = "artwork.jpg") {
  try {
    const body = await requestApi("/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageData, fileName }),
    });
    return body.imageKey || null;
  } catch (error) {
    console.warn("Failed to upload artwork image.", error);
    return null;
  }
}

async function fetchArtworkImageUrl(imageKey) {
  if (!imageKey) return "";

  try {
    const response = await fetch(`${API_BASE}/image?key=${encodeURIComponent(imageKey)}`, {
      headers: getApiHeaders(),
    });
    if (!response.ok) throw new Error("Image request failed");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.warn("Failed to fetch artwork image.", error);
    return "";
  }
}

function revokeCloudImageObjectUrls() {
  state.cloudImageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.cloudImageObjectUrls = [];
}

function toApiArtworkPayload(artwork) {
  return {
    id: artwork.id,
    title: artwork.title,
    image_key: artwork.image_key || artwork.imageKey,
    child_name: artwork.child_name || artwork.childName || artwork.artist,
    age: artwork.age,
    created_date: artwork.created_date || artwork.createdDate || artwork.date,
    memo: artwork.memo || artwork.comment,
    child_comment: artwork.child_comment || artwork.childComment || artwork.story,
    tags_json: artwork.tags_json || JSON.stringify(artwork.tags || []),
    favorite: Boolean(artwork.favorite),
    created_at: artwork.created_at || artwork.createdAt,
  };
}

async function createArtworkInApi(artwork) {
  try {
    const body = await requestApi("/artworks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiArtworkPayload(artwork)),
    });
    return body.artwork || null;
  } catch (error) {
    console.warn("Failed to create artwork in API.", error);
    return null;
  }
}

async function deleteArtworkFromApi(id) {
  try {
    const body = await requestApi(`/artworks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return Boolean(body.ok);
  } catch (error) {
    console.warn("Failed to delete artwork from API.", error);
    return false;
  }
}

function normalizeApiArtwork(artwork) {
  let tags = [];
  try {
    tags = artwork.tags_json ? JSON.parse(artwork.tags_json) : [];
  } catch {
    tags = [];
  }

  return {
    id: artwork.id,
    imageUrl: artwork.imageUrl || artwork.image || "",
    imageKey: artwork.image_key || artwork.imageKey || "",
    title: artwork.title || "Untitled",
    artist: artwork.child_name || artwork.childName || artwork.artist || "",
    age: artwork.age || "",
    date: artwork.created_date || artwork.createdDate || artwork.date || "",
    comment: artwork.memo || artwork.comment || "",
    story: artwork.child_comment || artwork.childComment || artwork.story || "",
    tags: Array.isArray(tags) ? tags : [],
    favorite: Boolean(artwork.favorite),
    createdAt: artwork.created_at || artwork.createdAt || "",
    updatedAt: artwork.updated_at || artwork.updatedAt || "",
    isCloud: true,
  };
}

async function attachCloudImageUrls(artworks) {
  const nextArtworks = await Promise.all(
    artworks.map(async (artwork) => {
      if (artwork.imageUrl || !artwork.imageKey) return artwork;
      const imageUrl = await fetchArtworkImageUrl(artwork.imageKey);
      if (imageUrl) state.cloudImageObjectUrls.push(imageUrl);
      return { ...artwork, imageUrl };
    })
  );
  return nextArtworks;
}

async function replaceStateWithCloudArtworks(artworks) {
  revokeCloudImageObjectUrls();
  state.artworks = await attachCloudImageUrls(artworks.map(normalizeApiArtwork));
  state.galleryIndex = 0;
  renderHome();
  renderList();
  renderGallery();
  updateStorageStatus();
}

async function loadCloudArtworks() {
  const familyCode = String(getFamilyCode()).trim();
  if (!familyCode) {
    setCloudMessage("共有コードを入力してください。", true);
    return;
  }

  setCloudMessage("クラウドから読み込み中...");
  const artworks = await fetchArtworksWithFamilyCode(familyCode);
  if (!artworks) {
    setCloudMessage("鍵が合いませんでした。", true);
    return;
  }

  saveFamilyCode(familyCode);
  await replaceStateWithCloudArtworks(artworks);
  setCloudMessage(`クラウドから${state.artworks.length}件読み込みました。`);
  navigate("home");
  hideGate();
}

if (typeof window !== "undefined") {
  window.kodomoMuseumApi = {
    getFamilyCode,
    saveFamilyCode,
    fetchArtworksFromApi,
    fetchArtworksWithFamilyCode,
    uploadArtworkImage,
    createArtworkInApi,
    deleteArtworkFromApi,
    loadCloudArtworks,
  };
}

async function enterMuseumWithCode(code, { auto = false } = {}) {
  const familyCode = String(code || "").trim();
  if (!familyCode) {
    showGate();
    return false;
  }

  if (!auto) setGateMessage("鍵を確かめています...");
  const artworks = await fetchArtworksWithFamilyCode(familyCode);
  if (!artworks) {
    saveFamilyCode("");
    showGate(auto ? "" : "鍵が合いませんでした");
    return false;
  }

  saveFamilyCode(familyCode);
  await replaceStateWithCloudArtworks(artworks);
  navigate("home");
  hideGate();
  return true;
}

function initializeMuseumGate() {
  const savedCode = getFamilyCode();
  if (!savedCode) {
    showGate();
    return;
  }
  enterMuseumWithCode(savedCode, { auto: true });
}

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

function getStorageBytes(value) {
  return new Blob([value || ""]).size;
}

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getSavedStorageBytes() {
  return getStorageBytes(localStorage.getItem(STORAGE_KEY) || "");
}

function updateStorageStatus() {
  const savedBytes = getSavedStorageBytes();
  const selectedText = state.selectedImageSize
    ? ` / 選択中の写真 約${formatBytes(state.selectedImageSize)} / 保存後見込み 約${formatBytes(savedBytes + state.selectedImageSize)}`
    : "";
  storageStatus.textContent = `保存済み ${state.artworks.length}件 / 使用容量 約${formatBytes(savedBytes)}${selectedText}`;
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
  const imageUrl = artwork.imageUrl || artwork.image;
  if (!imageUrl) return '<div class="image-placeholder">画像を準備中です</div>';
  return `<img src="${imageUrl}" alt="${escapeHtml(`${altPrefix}：${artwork.title}`)}" />`;
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
  todayArtwork.className = "featured-display";
  todayArtwork.innerHTML = `<div class="featured-frame">${artworkImageHtml(artwork, "今日の展示作品")}</div>${plateHtml(artwork)}`;
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
    <div class="detail-artwork-display">
      <div class="detail-image-wrap">${artworkImageHtml(artwork, "作品詳細")}</div>
      ${plateHtml(artwork, "detail-plate")}
    </div>
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
  if (route === "add") updateStorageStatus();
}

function resetForm() {
  form.reset();
  state.selectedImage = "";
  state.selectedImageSize = 0;
  imagePreview.textContent = "画像プレビュー";
  updateStorageStatus();
}

function parseTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("image-load-failed")), { once: true });
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result), { once: true });
    reader.addEventListener("error", () => reject(new Error("file-read-failed")), { once: true });
    reader.readAsDataURL(file);
  });
}

function getResizeSize(width, height) {
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function compressImageFile(file) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const size = getResizeSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = size.width;
  canvas.height = size.height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

async function saveArtworkToCloud(artwork) {
  const fileName = imageInput.files[0]?.name || "artwork.jpg";
  const imageKey = await uploadArtworkImage(state.selectedImage, fileName);
  if (!imageKey) return false;

  const cloudArtwork = {
    ...artwork,
    imageUrl: "",
    imageKey,
    childName: artwork.artist,
    createdDate: artwork.date,
    memo: artwork.comment,
    childComment: artwork.story,
  };

  const createdArtwork = await createArtworkInApi(cloudArtwork);
  if (!createdArtwork) return false;

  const cloudArtworks = await fetchArtworksFromApi();
  if (!cloudArtworks) return false;

  await replaceStateWithCloudArtworks(cloudArtworks);
  formMessage.textContent = "クラウドに保存しました。";
  setCloudMessage(`クラウドから${state.artworks.length}件読み込みました。`);
  resetForm();
  renderDetail(createdArtwork.id || artwork.id);
  return true;
}

imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];
  if (!file) return;

  formMessage.textContent = "写真を保存用に圧縮しています。";
  imagePreview.textContent = "圧縮中...";

  try {
    const compressedImage = await compressImageFile(file);
    const compressedSize = getStorageBytes(compressedImage);

    if (compressedSize > STORAGE_SOFT_LIMIT_BYTES) {
      state.selectedImage = "";
      state.selectedImageSize = 0;
      imageInput.value = "";
      imagePreview.textContent = "画像プレビュー";
      formMessage.textContent = "この写真は圧縮しても大きすぎるため保存できませんでした。";
      updateStorageStatus();
      return;
    }

    state.selectedImage = compressedImage;
    state.selectedImageSize = compressedSize;
    imagePreview.innerHTML = `<img src="${state.selectedImage}" alt="圧縮後の画像プレビュー" />`;
    formMessage.textContent = `写真を圧縮しました（約${formatBytes(compressedSize)}）。`;
    updateStorageStatus();
  } catch {
    state.selectedImage = "";
    state.selectedImageSize = 0;
    imageInput.value = "";
    imagePreview.textContent = "画像プレビュー";
    formMessage.textContent = "写真を読み込めませんでした。別の写真を選んでください。";
    updateStorageStatus();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);

  if (!state.selectedImage) {
    formMessage.textContent = "画像を選択してください。";
    return;
  }

  const artwork = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    imageUrl: state.selectedImage,
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

  if (getFamilyCode()) {
    formMessage.textContent = "クラウドに保存しています...";
    const cloudSaved = await saveArtworkToCloud(artwork);
    if (cloudSaved) return;
    formMessage.textContent = "クラウド保存に失敗したため、この端末に保存します。";
  }

  try {
    const nextArtworks = [artwork, ...state.artworks];
    const nextJson = JSON.stringify(nextArtworks);
    const nextSize = getStorageBytes(nextJson);

    if (nextSize > STORAGE_SOFT_LIMIT_BYTES) {
      formMessage.textContent = "写真の容量が大きいため保存できませんでした。別の写真を選ぶか、保存済み作品を減らしてください。";
      updateStorageStatus();
      return;
    }

    localStorage.setItem(STORAGE_KEY, nextJson);
    state.artworks = nextArtworks;
    formMessage.textContent = "保存しました。";
    resetForm();
    renderHome();
    renderList();
    renderGallery();
    renderDetail(artwork.id);
    if (getFamilyCode()) formMessage.textContent = "クラウド保存に失敗したため、この端末に保存しました。";
  } catch {
    formMessage.textContent = "写真の容量が大きいため保存できませんでした。別の写真を選ぶか、保存済み作品を減らしてください。";
    updateStorageStatus();
  }
});

document.addEventListener("click", async (event) => {
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
    const deleteId = deleteButton.dataset.deleteId;
    const artwork = state.artworks.find((item) => item.id === deleteId);
    if (artwork?.isCloud && getFamilyCode()) {
      const deleted = await deleteArtworkFromApi(deleteId);
      if (!deleted) {
        setCloudMessage("削除に失敗しました。", true);
        return;
      }

      const artworks = await fetchArtworksFromApi();
      if (artworks) {
        await replaceStateWithCloudArtworks(artworks);
      } else {
        state.artworks = state.artworks.filter((item) => item.id !== deleteId);
        renderHome();
        renderList();
        renderGallery();
      }
      setCloudMessage("作品を削除しました。");
      navigate("list");
      return;
    }

    state.artworks = state.artworks.filter((item) => item.id !== deleteButton.dataset.deleteId);
    saveArtworks();
    updateStorageStatus();
    renderHome();
    renderList();
    renderGallery();
    navigate("list");
  }
});

document.querySelector("#prev-art").addEventListener("click", () => moveGallery(-1));
document.querySelector("#next-art").addEventListener("click", () => moveGallery(1));
document.querySelector("#back-to-list").addEventListener("click", () => navigate("list"));

if (gateForm) {
  gateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await enterMuseumWithCode(gateKeyInput?.value || "");
  });
}

if (resetFamilyCodeButton) {
  resetFamilyCodeButton.addEventListener("click", () => {
    saveFamilyCode("");
    setCloudMessage("");
    showGate();
  });
}

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
updateStorageStatus();
navigate(window.location.hash.replace("#", "") || "home");
initializeMuseumGate();
