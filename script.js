let selectedFilters = new Set();
let currentRenderId = 0;
let currentAudio = null;
let currentPlayBtn = null;
let currentGeneratedTracks = []; 

// NOUVELLES VARIABLES POUR LE CRUD
let currentEditId = null;
let currentEditTracks = [];

const LASTFM_API_KEY = 'b1f5da385d56d615216962552cfe67c0';

const filtersConfig = {
  emotions: {
    triste: { icon: '😢', label: 'Triste', lastfmTag: 'sad' },
    calme: { icon: '🧘', label: 'Calme', lastfmTag: 'calm' },
    mélancolique: { icon: '🌧️', label: 'Mélancolique', lastfmTag: 'melancholy' },
    Énergique: { icon: '⚡', label: 'Énergique', lastfmTag: 'energetic' },
    Sensuel: { icon: '🍷', label: 'Sensuel', lastfmTag: 'sensual' },
    Sombre: { icon: '🦇', label: 'Sombre', lastfmTag: 'dark' },
    Nostalgique: { icon: '📼', label: 'Nostalgique', lastfmTag: 'nostalgic' }
  },
  activities: {
    chill: { icon: '😌', label: 'Détente', lastfmTag: 'chill' },
    focus: { icon: '💻', label: 'Focus / Code', lastfmTag: 'focus' },
    voiture: { icon: '🚗', label: 'Conduite', lastfmTag: 'driving' },
    workout: { icon: '💪', label: 'Sport', lastfmTag: 'workout' },
    nightwalk: { icon: '🚶‍♂️', label: 'Marche nocturne', lastfmTag: 'late night' }
  },
  genres: {
    '80s': { icon: '📻', label: '80s', lastfmTag: '80s' },
    '90s': { icon: '💿', label: '90s', lastfmTag: '90s' },
    postpunk: { icon: '🖤', label: 'Post-Punk / Coldwave', lastfmTag: 'post-punk' },
    shoegaze: { icon: '🎛️', label: 'Shoegaze', lastfmTag: 'shoegaze' },
    rock: { icon: '🤘', label: 'Rock / Metal', lastfmTag: 'rock' },
    ambient: { icon: '🌌', label: 'Ambient / Électro', lastfmTag: 'ambient' },
    pop: { icon: '🎤', label: 'Pop Alternative', lastfmTag: 'alt pop' },
    slowcore: { icon: '🐌', label: 'slowcore', lastfmTag: 'slowcore' },
    guitar: { icon: '🎸', label: 'guitard', lastfmtag: 'guitard' }
  }
};

const flatConfig = { ...filtersConfig.emotions, ...filtersConfig.activities, ...filtersConfig.genres };
const deezerCache = new Map();
const delay = (ms) => new Promise(res => setTimeout(res, ms));

function toggleAudio(previewUrl, btnElement) {
  if (!previewUrl) return;
  if (currentAudio && currentAudio.src === previewUrl) {
    if (currentAudio.paused) { currentAudio.play(); btnElement.textContent = '⏸️'; } 
    else { currentAudio.pause(); btnElement.textContent = '▶️'; }
    return;
  }
  if (currentAudio) {
    currentAudio.pause();
    if (currentPlayBtn) currentPlayBtn.textContent = '▶️';
  }
  currentAudio = new Audio(previewUrl);
  currentAudio.volume = 0.5;
  currentPlayBtn = btnElement;
  currentAudio.play();
  btnElement.textContent = '⏸️';
  currentAudio.onended = () => { btnElement.textContent = '▶️'; };
}

async function fetchDeezerData(artist, title) {
  const queryKey = `${artist} ${title}`;
  if (deezerCache.has(queryKey)) return deezerCache.get(queryKey);
  try {
    const query = encodeURIComponent(queryKey);
    const targetUrl = `https://api.deezer.com/search?q=${query}&limit=1`;
    const url = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const result = { 
        link: data.data[0].link, 
        preview: data.data[0].preview, 
        duration: data.data[0].duration 
      };
      deezerCache.set(queryKey, result);
      return result;
    }
  } catch (e) { console.error("Erreur Deezer", e); }
  deezerCache.set(queryKey, null);
  return null;
}

function initGrids() {
  const createCards = (categoryKey, gridId) => {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';
    Object.entries(filtersConfig[categoryKey]).forEach(([key, val]) => {
      const card = document.createElement('div');
      card.className = 'mood-card';
      card.dataset.filter = key;
      card.innerHTML = `<div class="mood-icon">${val.icon}</div><div class="mood-name">${val.label}</div>`;
      card.onclick = () => toggleFilter(key, card);
      grid.appendChild(card);
    });
  };
  createCards('emotions', 'emotionsGrid');
  createCards('activities', 'activitiesGrid');
  createCards('genres', 'genresGrid');
}

function toggleFilter(filterKey, element) {
  if (selectedFilters.has(filterKey)) {
    selectedFilters.delete(filterKey);
    element.classList.remove('active');
  } else {
    selectedFilters.add(filterKey);
    element.classList.add('active');
  }
  renderSongs();
}

async function fetchLastFmTracks(tag) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${encodeURIComponent(tag)}&api_key=${LASTFM_API_KEY}&format=json&limit=200`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.tracks && data.tracks.track) {
      return data.tracks.track.map(t => ({
        id: t.mbid || encodeURIComponent(`${t.name}-${t.artist.name}`), 
        title: t.name, artist: t.artist.name, lastfmUrl: t.url
      }));
    }
  } catch (err) { console.error("Erreur Last.fm", err); }
  return [];
}

function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m} min`;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function loadDeezerLinks(tracks, renderIdToMatch) {
  for (const song of tracks) {
    if (renderIdToMatch && currentRenderId !== renderIdToMatch) break;
    let deezerData = deezerCache.get(`${song.artist} ${song.title}`);
    
    if (deezerData === undefined) {
      deezerData = await fetchDeezerData(song.artist, song.title);
      await delay(200);
    }
    
    const btnContainer = document.getElementById(`deezer-btn-${song.id}`);
    if (btnContainer && (!renderIdToMatch || currentRenderId === renderIdToMatch)) {
      if (deezerData) {
        let buttonsHtml = '';
        if (deezerData.preview) {
          buttonsHtml += `<button onclick="toggleAudio('${deezerData.preview}', this)" class="btn-link btn-play" title="Écouter l'extrait (30s)">▶️</button>`;
        }
        buttonsHtml += `<a href="${deezerData.link}" target="_blank" rel="noopener" class="btn-link btn-deezer">Deezer</a>`;
        btnContainer.outerHTML = buttonsHtml;
      } else {
        btnContainer.outerHTML = `<span class="tag" style="border: none; padding: 0.45rem;">Introuvable ❌</span>`;
      }
    }
  }
}

// --- SYSTEME DE BIBLIOTHEQUE & CRUD ---
function initLibrary() {
  renderSavedPlaylists();
  document.getElementById('saveBtn').addEventListener('click', saveCurrentPlaylist);
  document.getElementById('copyPlaylistBtn').addEventListener('click', copyPlaylistToClipboard);
}

function saveCurrentPlaylist() {
  const nameInput = document.getElementById('playlistName');
  const name = nameInput.value.trim() || 'Mix sans nom';
  if (currentGeneratedTracks.length === 0) return;

  const newPlaylist = {
    id: Date.now(), name: name, date: new Date().toLocaleDateString('fr-FR'),
    tracks: currentGeneratedTracks, tags: Array.from(selectedFilters)
  };

  let saved = JSON.parse(localStorage.getItem('audioHubPlaylists')) || [];
  saved.unshift(newPlaylist);
  localStorage.setItem('audioHubPlaylists', JSON.stringify(saved));
  nameInput.value = '';
  renderSavedPlaylists();
}

function renderSavedPlaylists() {
  const saved = JSON.parse(localStorage.getItem('audioHubPlaylists')) || [];
  const librarySection = document.getElementById('librarySection');
  const grid = document.getElementById('savedPlaylistsGrid');

  if (saved.length === 0) { librarySection.style.display = 'none'; return; }

  librarySection.style.display = 'block';
  grid.innerHTML = saved.map(pl => `
    <div class="mood-card" style="align-items: flex-start; text-align: left; cursor: default;">
      <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 0.2rem;">${pl.name}</div>
      <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 0.5rem; font-family: var(--font-mono);">${pl.tracks.length} pistes • ${pl.date}</div>
      <div style="display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 1rem;">
        ${pl.tags.map(tag => `<span class="tag" style="font-size: 0.55rem;">${flatConfig[tag] ? flatConfig[tag].label : tag}</span>`).join('')}
      </div>
      <div style="display: flex; gap: 0.5rem; width: 100%;">
        <button onclick="loadSavedPlaylist(${pl.id})" class="btn-link btn-spotify" style="flex: 1; justify-content: center; font-size: 0.7rem;">▶️ Charger</button>
        <button onclick="openEditModal(${pl.id})" class="btn-link btn-deezer" style="background: transparent; border-color: var(--border-light); color: var(--text-primary); padding: 0.4rem;" title="Éditer la playlist">✏️</button>
        <button onclick="deletePlaylist(${pl.id})" class="btn-link btn-deezer" style="padding: 0.4rem;" title="Supprimer">🗑️</button>
      </div>
    </div>
  `).join('');
}

function deletePlaylist(id) {
  let saved = JSON.parse(localStorage.getItem('audioHubPlaylists')) || [];
  saved = saved.filter(pl => pl.id !== id);
  localStorage.setItem('audioHubPlaylists', JSON.stringify(saved));
  renderSavedPlaylists();
}

// === NOUVELLES FONCTIONS CRUD (UPDATE) ===
function openEditModal(id) {
  const saved = JSON.parse(localStorage.getItem('audioHubPlaylists')) || [];
  const pl = saved.find(p => p.id === id);
  if (!pl) return;

  currentEditId = id;
  currentEditTracks = [...pl.tracks];

  document.getElementById('editPlaylistName').value = pl.name;
  renderEditTracks();
  
  document.getElementById('editModal').style.display = 'flex';
}

function renderEditTracks() {
  const list = document.getElementById('editTrackList');
  document.getElementById('editTrackCount').textContent = currentEditTracks.length;
  
  if(currentEditTracks.length === 0) {
    list.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-tertiary);">Aucun morceau.</div>`;
    return;
  }

  list.innerHTML = currentEditTracks.map((song, index) => `
    <div class="edit-track-item">
      <div class="edit-track-info">
        <span class="edit-track-title">${song.title}</span>
        <span class="edit-track-artist">${song.artist}</span>
      </div>
      <button onclick="removeTrackFromEdit(${index})" class="btn-remove-track" title="Retirer ce morceau">✖</button>
    </div>
  `).join('');
}

function removeTrackFromEdit(index) {
  currentEditTracks.splice(index, 1);
  renderEditTracks();
}

function saveEditedPlaylist() {
  if(!currentEditId) return;
  const newName = document.getElementById('editPlaylistName').value.trim() || 'Mix sans nom';
  
  let saved = JSON.parse(localStorage.getItem('audioHubPlaylists')) || [];
  const plIndex = saved.findIndex(p => p.id === currentEditId);
  
  if(plIndex !== -1) {
    saved[plIndex].name = newName;
    saved[plIndex].tracks = currentEditTracks;
    localStorage.setItem('audioHubPlaylists', JSON.stringify(saved));
    
    renderSavedPlaylists();
    document.getElementById('editModal').style.display = 'none';
    
    const info = document.getElementById('resultsInfo');
    if(info.textContent.includes(saved[plIndex].name.toUpperCase())) {
         loadSavedPlaylist(currentEditId);
    }
  }
}
// =====================================

function loadSavedPlaylist(id) {
  const saved = JSON.parse(localStorage.getItem('audioHubPlaylists')) || [];
  const pl = saved.find(p => p.id === id);
  if (!pl) return;

  currentRenderId++;
  currentGeneratedTracks = pl.tracks;
  
  const container = document.getElementById('songsContainer');
  const info = document.getElementById('resultsInfo');
  
  info.textContent = `PLAYLIST : ${pl.name.toUpperCase()}`;
  document.getElementById('saveWrapper').style.display = 'flex'; 

  container.innerHTML = pl.tracks.map(song => `
    <div class="song-card" id="card-${song.id}">
      <div class="song-header">
        <div class="song-title">${song.title}</div>
        <div class="song-artist">${song.artist}</div>
      </div>
      <div class="song-tags">
        ${song.tags.map(tag => `<span class="tag">${flatConfig[tag] ? flatConfig[tag].label : tag}</span>`).join('')}
      </div>
      <div class="song-links" id="links-${song.id}">
        <a href="${song.lastfmUrl}" target="_blank" rel="noopener" class="btn-link btn-spotify">Last.fm</a>
        <span id="deezer-btn-${song.id}" class="tag" style="border: none; padding: 0.45rem 0.8rem;">Recherche... ⏳</span>
      </div>
    </div>
  `).join('');

  loadDeezerLinks(pl.tracks, currentRenderId);
  window.scrollTo({ top: container.offsetTop - 100, behavior: 'smooth' });
}

function copyPlaylistToClipboard() {
  if (currentGeneratedTracks.length === 0) return;

  const textToCopy = currentGeneratedTracks.map(song => `${song.artist} - ${song.title}`).join('\n');

  navigator.clipboard.writeText(textToCopy).then(() => {
    document.getElementById('exportModal').style.display = 'flex';
  }).catch(err => {
    console.error("Erreur de copie : ", err);
    alert("Aïe, impossible de copier automatiquement. Ton navigateur bloque peut-être l'accès au presse-papier.");
  });
}

async function renderSongs() {
  const container = document.getElementById('songsContainer');
  const info = document.getElementById('resultsInfo');
  
  // Plus de variable "strict" ici !
  const durationSelect = document.getElementById('playlistDuration');
  const targetDuration = parseInt(durationSelect ? durationSelect.value : 0, 10);
  const filters = Array.from(selectedFilters);

  currentRenderId++;
  const renderId = currentRenderId;
  document.getElementById('saveWrapper').style.display = 'none'; 

  if (filters.length === 0) {
    container.innerHTML = `<div class="empty-state">Sélectionne des filtres pour affiner ta recherche.</div>`;
    info.textContent = '0 PISTE';
    return;
  }

  container.innerHTML = `<div class="empty-state">Je fouille Last.fm avec tes filtres... ⏳</div>`;
  info.textContent = 'RECHERCHE...';

  let trackMap = new Map();

  for (const filterKey of filters) {
    const fmTag = flatConfig[filterKey].lastfmTag;
    const tracks = await fetchLastFmTracks(fmTag);
    if (currentRenderId !== renderId) return; 
    
    tracks.forEach(t => {
      if (!trackMap.has(t.id)) { trackMap.set(t.id, { ...t, tags: [filterKey], matchCount: 1 }); } 
      else {
        const existing = trackMap.get(t.id);
        if (!existing.tags.includes(filterKey)) { existing.tags.push(filterKey); existing.matchCount++; }
      }
    });
  }

  let finalTracks = Array.from(trackMap.values());

  // On trie simplement par nombre de correspondances pour afficher les meilleurs combos en premier
  finalTracks.sort((a, b) => b.matchCount - a.matchCount); 
  finalTracks = finalTracks.slice(0, 300);

  finalTracks = shuffleArray(finalTracks);

  let totalCalculatedSeconds = 0;
  
  if (targetDuration > 0) {
    info.textContent = 'CALCUL DU TEMPS... ⏱️';
    container.innerHTML = `<div class="empty-state">Calcul de la durée de la playlist via Deezer, ça peut prendre un instant... ⏳</div>`;
    
    let durationTracks = [];
    for (const song of finalTracks) {
      if (totalCalculatedSeconds >= targetDuration) break; 
      if (currentRenderId !== renderId) return; 
      
      let deezerData = deezerCache.get(`${song.artist} ${song.title}`);
      if (deezerData === undefined) { deezerData = await fetchDeezerData(song.artist, song.title); await delay(200); }
      
      const songDuration = (deezerData && deezerData.duration) ? deezerData.duration : 210;
      totalCalculatedSeconds += songDuration;
      durationTracks.push(song);
    }
    finalTracks = durationTracks;
  } else {
    finalTracks = finalTracks.slice(0, 150);
  }

  if (finalTracks.length === 0) {
    container.innerHTML = `<div class="empty-state">Aïe, aucune correspondance. Mode strict trop hardcore ou combo improbable ! 📉</div>`;
    info.textContent = '0 PISTE';
    return;
  }

  if (targetDuration > 0) { info.textContent = `${finalTracks.length} PISTES • ${formatTime(totalCalculatedSeconds)}`; } 
  else { info.textContent = `${finalTracks.length} PISTE${finalTracks.length > 1 ? 'S' : ''}`; }

  currentGeneratedTracks = finalTracks;
  document.getElementById('saveWrapper').style.display = 'flex';

  container.innerHTML = finalTracks.map(song => `
    <div class="song-card" id="card-${song.id}">
      <div class="song-header">
        <div class="song-title">${song.title}</div>
        <div class="song-artist">${song.artist}</div>
      </div>
      <div class="song-tags">
        ${song.tags.map(tag => `<span class="tag">${flatConfig[tag] ? flatConfig[tag].label : tag}</span>`).join('')}
      </div>
      <div class="song-links" id="links-${song.id}">
        <a href="${song.lastfmUrl}" target="_blank" rel="noopener" class="btn-link btn-spotify">Last.fm</a>
        <span id="deezer-btn-${song.id}" class="tag" style="border: none; padding: 0.45rem 0.8rem;">Recherche... ⏳</span>
      </div>
    </div>
  `).join('');

  loadDeezerLinks(finalTracks, renderId);
}

document.addEventListener('DOMContentLoaded', () => {
  initGrids();
  initLibrary();
  document.getElementById('playlistDuration').addEventListener('change', renderSongs);
  
  const themeToggleBtn = document.getElementById('themeToggle');
  const body = document.body;
  
  const savedTheme = localStorage.getItem('audioHubTheme');
  if (savedTheme === 'light') {
    body.setAttribute('data-theme', 'light');
  } else {
    body.setAttribute('data-theme', 'dark'); 
  }

  themeToggleBtn.addEventListener('click', () => {
    if (body.getAttribute('data-theme') === 'light') {
      body.setAttribute('data-theme', 'dark');
      localStorage.setItem('audioHubTheme', 'dark');
    } else {
      body.setAttribute('data-theme', 'light');
      localStorage.setItem('audioHubTheme', 'light');
    }
  });

  // --- FERMETURE DES MODALES ---
  const exportModal = document.getElementById('exportModal');
  const editModal = document.getElementById('editModal');
  
  document.getElementById('closeModalBtn')?.addEventListener('click', () => exportModal.style.display = 'none');
  document.getElementById('closeEditModalBtn')?.addEventListener('click', () => editModal.style.display = 'none');
  document.getElementById('saveEditBtn')?.addEventListener('click', saveEditedPlaylist);
  
  window.addEventListener('click', (e) => {
    if (e.target === exportModal) exportModal.style.display = 'none';
    if (e.target === editModal) editModal.style.display = 'none';
  });
});