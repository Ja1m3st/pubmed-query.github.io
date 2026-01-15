const API_BASE = '/api';

let currentQuery = "";
let currentStart = 0;
const BATCH_SIZE = 10;
let isLoading = false;
let hasMoreResults = true;
let searchHistory = [];

// Initialize folders from localStorage or use default
let folders = JSON.parse(localStorage.getItem('folders')) || [
    { id: 'default', name: 'Uncategorized', papers: [] }
];
let currentFolder = 'default';

document.addEventListener('DOMContentLoaded', () => {
    renderFolders();
    renderSavedPapers();
});

function handleEnter(e) { if (e.key === 'Enter') startNewSearch(); }

function toggleAdvancedFilters() {
    const p = document.getElementById('advancedFilters');
    const t = event.target;
    if (p.style.display === 'block') { p.style.display = 'none'; t.textContent = '+ Advanced Filters'; }
    else { p.style.display = 'block'; t.textContent = '- Hide Filters'; }
}

function toggleCustomDate() {
    const isCustom = document.querySelector('input[name="dateFilter"][value="custom"]')?.checked;
    const div = document.getElementById('customDate');
    if(div) div.className = isCustom ? 'date-range active' : 'date-range';
}

function quickSearch(text) { document.getElementById('userPrompt').value = text; startNewSearch(); }
function toggleQuery() { const c = document.getElementById('queryText'); c.style.display = c.style.display === 'block' ? 'none' : 'block'; }
function copyQuery(e) { 
    e.stopPropagation(); 
    navigator.clipboard.writeText(document.getElementById('queryText').innerText); 
    e.target.innerText = "✓ Copied"; 
    setTimeout(() => e.target.innerText = "Copy", 2000); 
}

function buildFilters() {
    let f = "";
    const year = new Date().getFullYear();
    
    const dateInput = document.querySelector('input[name="dateFilter"]:checked');
    if (dateInput) {
        const dateVal = dateInput.value;
        if (dateVal === '1') f += ` AND ("${year-1}"[Date - Publication] : "3000"[Date - Publication])`;
        else if (dateVal === '5') f += ` AND ("${year-5}"[Date - Publication] : "3000"[Date - Publication])`;
        else if (dateVal === '10') f += ` AND ("${year-10}"[Date - Publication] : "3000"[Date - Publication])`;
        else if (dateVal === 'custom') {
            const yFrom = document.getElementById('yearFrom').value;
            const yTo = document.getElementById('yearTo').value;
            if(yFrom && yTo) f += ` AND ("${yFrom}"[Date - Publication] : "${yTo}"[Date - Publication])`;
        }
    }

    const free = document.getElementById('filterFree');
    if(free && free.checked) f += " AND free full text[filter]";
    
    const rev = document.getElementById('filterReview');
    if(rev && rev.checked) f += " AND (Meta-Analysis[pt] OR Systematic Review[pt] OR Review[pt])";
    
    const data = document.getElementById('checkData');
    if(data && data.checked) f += " AND associated data[filter]";
    
    const prep = document.getElementById('checkPreprints');
    if(prep && prep.checked) f += " NOT preprint[filter]";

    const type = document.getElementById('articleType').value; if(type) f += ` AND ${type}`;
    const lang = document.getElementById('language').value; if(lang) f += ` AND ${lang}`;
    const spec = document.getElementById('species').value; if(spec) f += ` AND ${spec}`;
    const age = document.getElementById('age').value; if(age) f += ` AND ${age}`;

    return f;
}

function toggleSave(pmid) {
    let existsInFolder = null;
    let paperIndex = -1;
    
    folders.forEach(folder => {
        const idx = folder.papers.findIndex(p => p.pmid === pmid);
        if (idx !== -1) {
            existsInFolder = folder;
            paperIndex = idx;
        }
    });
    
    const btn = document.getElementById(`save-${pmid}`);
    
    if (!existsInFolder) {
        const title = document.getElementById(`title-${pmid}`).innerText;
        const folder = folders.find(f => f.id === 'default'); 
        
        if (folder) {
            folder.papers.push({ pmid: pmid, title: title, date: new Date().toISOString() });
            if (btn) { 
                btn.classList.add('btn-saved'); 
                btn.innerText = '✓ Saved'; 
            }
            saveFolders(); 
        }
    } else {
        existsInFolder.papers.splice(paperIndex, 1);
        if (btn) { 
            btn.classList.remove('btn-saved'); 
            btn.innerText = 'Save'; 
        }
        saveFolders();
    }
}

function removeSaved(pmid) {
    folders.forEach(folder => {
        const index = folder.papers.findIndex(p => p.pmid === pmid);
        if (index > -1) {
            folder.papers.splice(index, 1);
        }
    });
    
    saveFolders();
    
    const btn = document.getElementById(`save-${pmid}`);
    if (btn) { 
        btn.classList.remove('btn-saved'); 
        btn.innerText = 'Save'; 
    }
}

function startEdit(pmid) { 
    document.getElementById(`view-${pmid}`).style.display = 'none'; 
    document.getElementById(`edit-${pmid}`).style.display = 'flex'; 
    document.getElementById(`input-${pmid}`).focus(); 
}

function finishEdit(pmid) {
    const val = document.getElementById(`input-${pmid}`).value;
    
    folders.forEach(folder => {
        const idx = folder.papers.findIndex(p => p.pmid === pmid);
        if (idx > -1 && val.trim() !== "") { 
            folder.papers[idx].title = val;
        }
    });
    
    saveFolders();
}

function cancelEdit() { renderSavedPapers(); }

function addToHistory(text) {
    if (searchHistory.length > 0 && searchHistory[0] === text) return;
    searchHistory.unshift(text);
    if (searchHistory.length > 6) searchHistory.pop();
    const list = document.getElementById('historyList');
    if (searchHistory.length === 0) list.innerHTML = '<li class="empty-state">No searches</li>';
    else list.innerHTML = searchHistory.map(item => `<li class="sidebar-item" onclick="quickSearch('${item.replace(/'/g, "\\'")}')">${item}</li>`).join('');
}

function extractKeywordsFromQuery(complexQuery) {
    if (!complexQuery) return [];
    let clean = complexQuery.replace(/\[.*?\]/g, ' ').replace(/\b(AND|OR|NOT)\b/g, ' ').replace(/[()"*,]/g, ' '); 
    return clean.split(/\s+/).filter(w => w.length > 3);
}

function highlightTerms(text, keywords) {
    if (!keywords || keywords.length === 0 || !text) return text;
    const pattern = new RegExp(`(${keywords.join('|')})`, 'gi');
    return text.replace(pattern, '<span class="search-highlight">$1</span>');
}

async function startNewSearch() {
    const input = document.getElementById('userPrompt').value;
    if (!input.trim()) return;

    addToHistory(input);
    currentStart = 0;
    hasMoreResults = true;
    isLoading = false;
    
    document.getElementById('paperList').innerHTML = "";
    document.getElementById('resultsContainer').style.display = 'none';
    document.getElementById('queryPanel').style.display = 'none';
    
    const btn = document.getElementById('btnSearch');
    btn.disabled = true; btn.textContent = "...";
    document.getElementById('mainLoader').style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/generate-query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userInput: input })
        });
        
        const data = await response.json();
        const baseQuery = data.query;
        const filters = buildFilters();
        currentQuery = baseQuery + filters;
        
        document.getElementById('queryText').innerText = currentQuery;
        document.getElementById('queryPanel').style.display = 'block';
        
        await fetchPapersBatch();
        document.getElementById('resultsContainer').style.display = 'block';
    } catch (error) { 
        alert("Error: " + error.message); 
    } 
    finally { 
        btn.disabled = false; 
        btn.textContent = "Search"; 
        document.getElementById('mainLoader').style.display = 'none'; 
    }
}

async function fetchPapersBatch() {
    if (isLoading || !hasMoreResults) return;
    isLoading = true;
    if (currentStart > 0) document.getElementById('bottomLoader').style.display = 'block';

    try {
        let queryToSend = currentQuery;
        if (queryToSend.length > 1000) queryToSend = queryToSend.substring(0, 1000);
        
        const searchRes = await fetch(`${API_BASE}/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryToSend, start: currentStart, max: BATCH_SIZE })
        });
        const searchData = await searchRes.json();

        if (!searchData.esearchresult?.idlist?.length) {
            hasMoreResults = false;
            if (currentStart === 0) {
                document.getElementById('paperList').innerHTML = '<div class="empty-state" style="padding:40px;">❌ No results found.</div>';
            }
            return;
        }

        const ids = searchData.esearchresult.idlist;
        
        const [fetchRes, checkRes] = await Promise.all([
            fetch(`${API_BASE}/fetch-papers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            }),
            fetch(`${API_BASE}/check-free`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            })
        ]);

        const xmlText = await fetchRes.text();
        const checkData = await checkRes.json();
        const freeIds = checkData.esearchresult?.idlist || [];
        
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, "text/xml");
        const articles = xml.getElementsByTagName("PubmedArticle");
        
        if (articles.length === 0) {
            console.error("XML Error");
            return;
        }

        appendResults(articles, freeIds);
        currentStart += BATCH_SIZE;

    } catch (error) { 
        console.error("Fetch error:", error);
        document.getElementById('paperList').innerHTML = '<div class="empty-state">❌ Error: ' + error.message + '</div>';
    } 
    finally { 
        isLoading = false; 
        document.getElementById('bottomLoader').style.display = 'none'; 
    }
}

function appendResults(articles, freeIds = []) {
    const list = document.getElementById('paperList');
    const searchTerms = extractKeywordsFromQuery(currentQuery);

    for (let art of articles) {
        let title = art.querySelector("ArticleTitle")?.textContent || "Untitled";
        let abstract = art.querySelector("AbstractText")?.textContent || "Abstract not available.";
        const pmid = art.querySelector("PMID")?.textContent;
        const journal = art.querySelector("ISOAbbreviation")?.textContent || "Journal";
        const date = art.querySelector("PubDate Year")?.textContent || "N/A";
        
        const pmcElement = art.querySelector('ArticleId[IdType="pmc"]');
        const pmcId = pmcElement ? pmcElement.textContent : null;
        
        const isFree = pmcId || freeIds.includes(pmid);
        
        let freeLabel = '';
        let extraLink = '';

        if (isFree) {
            if (pmcId) {
                freeLabel = `<span class="free-label" title="Available in PMC">Free PMC article</span>`;
                extraLink = `<a href="https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/" target="_blank" class="link-pubmed" style="margin-left:10px; color:#f47023;">View PDF (PMC) →</a>`;
            } else {
                freeLabel = `<span class="free-label" title="Free at publisher site">Free article</span>`;
            }
        }

        const author = art.querySelector("Author LastName") ? art.querySelector("Author LastName").textContent + " et al." : "Unknown Author";

        title = highlightTerms(title, searchTerms);
        abstract = highlightTerms(abstract, searchTerms);

        let isSaved = false;
        folders.forEach(folder => {
            if (folder.papers.some(p => p.pmid === pmid)) {
                isSaved = true;
            }
        });
        const savedClass = isSaved ? 'btn-saved' : '';
        const savedText = isSaved ? '✓ Saved' : 'Save';

        const div = document.createElement('div');
        div.className = 'paper';
        
        div.innerHTML = `
            <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" class="paper-title" id="title-${pmid}">${title}</a>
            <div class="paper-meta">
                <span>${author}</span> | <span>${journal}</span> | <span>${date}</span> | <span>PMID: ${pmid}</span>
                ${freeLabel}
            </div>
            <p class="paper-abstract" id="abstract-${pmid}">${abstract}</p>
            <div class="paper-actions">
                <button class="btn-action" onclick="getSummary('${pmid}')" id="btn-${pmid}">📊 Quick Summary</button>
                <button class="btn-action ${savedClass}" onclick="toggleSave('${pmid}')" id="save-${pmid}">${savedText}</button>
                <a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}/" target="_blank" class="link-pubmed">View on PubMed →</a>
                ${extraLink}
            </div>
            <div id="summary-${pmid}" class="ai-summary"><div id="content-${pmid}"></div><div style="font-size:10px; color:#999; margin-top:5px; border-top:1px solid #ddd; padding-top:5px;">⚠️ Note: Summary generated by AI. May contain inaccuracies. Always consult the original article.</div></div>
        `;
        list.appendChild(div);
    }
}

window.addEventListener('scroll', () => { 
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) fetchPapersBatch(); 
});

async function getSummary(pmid) {
    const btn = document.getElementById(`btn-${pmid}`);
    const summaryBox = document.getElementById(`summary-${pmid}`);
    const summaryContent = document.getElementById(`content-${pmid}`);
    const abstractText = document.getElementById(`abstract-${pmid}`).textContent;
    const titleText = document.getElementById(`title-${pmid}`).textContent;

    btn.disabled = true; 
    btn.innerText = "Summarizing..."; 
    summaryBox.style.display = "block";
    summaryContent.innerHTML = "Generating summary...";

    try {
        const userSearch = document.getElementById('userPrompt').value;
        
        const response = await fetch(`${API_BASE}/generate-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: titleText, 
                abstract: abstractText, 
                userSearch 
            })
        });
        
        const data = await response.json();
        summaryContent.innerHTML = data.summary; 
        btn.innerText = "✓ Summarized";
    } catch (err) { 
        summaryContent.innerHTML = "Error generating summary."; 
        btn.innerText = "Retry";
        btn.disabled = false; 
    }
}

// Modal Functions
function openLegalModal() {
    document.getElementById('legalModal').style.display = 'flex';
}

function closeLegalModal(e) {
    if (e && e.target !== document.getElementById('legalModal') && e.target.className !== 'close-btn') {
        return;
    }
    document.getElementById('legalModal').style.display = 'none';
}

function openAboutModal() {
    document.getElementById('aboutModal').style.display = 'flex';
}

function closeAboutModal(e) {
    if (e && e.target !== document.getElementById('aboutModal') && e.target.className !== 'close-btn') {
        return;
    }
    document.getElementById('aboutModal').style.display = 'none';
}

// FOLDER SYSTEM
function saveFolders() {
    // Save to localStorage
    localStorage.setItem('folders', JSON.stringify(folders));
    renderFolders();
    renderSavedPapers();
}

function renderFolders() {
    const container = document.getElementById('foldersContainer');
    container.innerHTML = '';
    
    folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = `folder-item ${currentFolder === folder.id ? 'active' : ''}`;
        folderDiv.setAttribute('data-folder', folder.id);
        
        folderDiv.innerHTML = `
            <img src="images/file.png" class="folder-icon" alt="Folder Icon">
            <span class="folder-name">${folder.name}</span>
            <span class="folder-count">${folder.papers.length}</span>
            ${folder.id !== 'default' ? `
                <div class="folder-actions">
                    <button class="folder-btn folder-btn-edit" onclick="renameFolder('${folder.id}')" title="Rename">
                        <svg width="14" height="14"><use href="#icon-edit-folder"/></svg>
                    </button>
                    <button class="folder-btn folder-btn-delete" onclick="deleteFolder('${folder.id}')" title="Delete">
                        <svg width="14" height="14"><use href="#icon-delete-folder"/></svg>
                    </button>
                </div>
            ` : ''}
        `;
        
        folderDiv.onclick = (e) => {
            if (e.target.closest('.folder-btn') || e.target.closest('svg')) {
                return;
            }
            selectFolder(folder.id);
        };
        
        container.appendChild(folderDiv);
    });
}

function selectFolder(folderId) {
    if (currentFolder === folderId) {
        currentFolder = null; 
    } else {
        currentFolder = folderId;
    }
    
    renderFolders();
    renderSavedPapers();
}

function createNewFolder() {
    const name = prompt('Folder Name:');
    if (name && name.trim()) {
        const id = 'folder_' + Date.now();
        folders.push({ id, name: name.trim(), papers: [] });
        saveFolders();
    }
}

function renameFolder(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const newName = prompt('New Name:', folder.name);
    if (newName && newName.trim()) {
        folder.name = newName.trim();
        saveFolders();
    }
}

function deleteFolder(folderId) {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const message = folder.papers.length > 0 
        ? `Are you sure? This will delete the folder "${folder.name}" and the ${folder.papers.length} articles inside.` 
        : `Delete folder "${folder.name}"?`;

    if (!confirm(message)) {
        return;
    }

    folder.papers.forEach(paper => {
        const btn = document.getElementById(`save-${paper.pmid}`);
        if (btn) { 
            btn.classList.remove('btn-saved'); 
            btn.innerText = 'Save'; 
        }
    });
    
    folders = folders.filter(f => f.id !== folderId);

    if (currentFolder === folderId) {
        currentFolder = 'default';
    }
    
    saveFolders();
}

function movePaperToFolder(pmid, targetFolderId) {
    event.stopPropagation();
    
    let paper = null;
    folders.forEach(folder => {
        const index = folder.papers.findIndex(p => p.pmid === pmid);
        if (index !== -1) {
            paper = folder.papers.splice(index, 1)[0];
        }
    });
    
    if (paper) {
        const targetFolder = folders.find(f => f.id === targetFolderId);
        if (targetFolder) {
            targetFolder.papers.push(paper);
            saveFolders();
            
            document.querySelectorAll('.folder-dropdown').forEach(d => {
                d.classList.remove('show');
            });
        }
    }
}

function renderSavedPapers() {
    const container = document.getElementById('foldersContainer');
    
    folders.forEach(folder => {
        let papersList = document.getElementById(`papers-${folder.id}`);
        
        if (!papersList) {
            const folderItem = container.querySelector(`[data-folder="${folder.id}"]`);
            if (folderItem) {
                papersList = document.createElement('div');
                papersList.id = `papers-${folder.id}`;
                papersList.className = 'folder-papers-list';
                papersList.style.display = currentFolder === folder.id ? 'block' : 'none';
                folderItem.after(papersList);
            }
        }
        
        if (papersList) {
            papersList.style.display = currentFolder === folder.id ? 'block' : 'none';
            
            if (folder.papers.length === 0) {
                papersList.innerHTML = '<div class="empty-state" style="margin-left: 20px;">No articles</div>';
            } else {
                papersList.innerHTML = folder.papers.map(paper => `
                    <div class="saved-item">
                        <div class="saved-row" id="view-${paper.pmid}">
                            <a href="https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/" target="_blank" class="saved-link">${paper.title}</a>
                            <div style="display:flex; gap:2px; position:relative;">
                                <button class="icon-btn" onclick="startEdit('${paper.pmid}')" title="Edit">
                                    <svg><use href="#icon-edit"/></svg>
                                </button>
                                <button class="icon-btn" onclick="toggleFolderDropdown(event, '${paper.pmid}')" title="Move to folder">
                                    <svg><use href="#icon-folder"/></svg>
                                </button>
                                <button class="icon-btn" onclick="removeSaved('${paper.pmid}')" title="Delete">
                                    <svg><use href="#icon-trash"/></svg>
                                </button>
                                <div class="folder-dropdown" id="dropdown-${paper.pmid}">
                                    ${folders.filter(f => f.id !== folder.id).map(f => `
                                        <div class="folder-option" onclick="movePaperToFolder('${paper.pmid}', '${f.id}')">
                                            <img src="images/file.png" class="folder-icon" alt="Folder Icon">
                                            <span>${f.name}</span>
                                        </div>
                                    `).join('') || '<div class="folder-option-empty">No other folders</div>'}
                                </div>
                            </div>
                        </div>
                        <div class="saved-row" id="edit-${paper.pmid}" style="display:none; gap:4px;">
                            <input type="text" class="edit-input" id="input-${paper.pmid}" value="${paper.title.replace(/"/g, '&quot;')}" onkeypress="if(event.key==='Enter') finishEdit('${paper.pmid}')">
                            <button class="icon-btn" style="color:green" onclick="finishEdit('${paper.pmid}')">
                                <svg><use href="#icon-check"/></svg>
                            </button>
                            <button class="icon-btn" style="color:red" onclick="renderSavedPapers()">
                                <svg><use href="#icon-x"/></svg>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }
    });
    
    updateSavedCount();
}

function toggleFolderDropdown(event, pmid) {
    event.stopPropagation();
    event.preventDefault();
    
    const dropdown = document.getElementById(`dropdown-${pmid}`);
    const button = event.currentTarget;
    
    document.querySelectorAll('.folder-dropdown').forEach(d => {
        if (d.id !== `dropdown-${pmid}`) {
            d.classList.remove('show');
        }
    });
    
    const isShowing = dropdown.classList.contains('show');
    
    if (!isShowing) {
        const rect = button.getBoundingClientRect();
        const dropdownHeight = 200; 
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
            dropdown.style.bottom = (window.innerHeight - rect.top) + 'px';
            dropdown.style.top = 'auto';
        } else {
            dropdown.style.top = rect.bottom + 'px';
            dropdown.style.bottom = 'auto';
        }
        
        dropdown.style.left = (rect.left - 180 + rect.width) + 'px';
        dropdown.classList.add('show');
    } else {
        dropdown.classList.remove('show');
    }
}

function updateSavedCount() {
    const totalPapers = folders.reduce((sum, folder) => sum + folder.papers.length, 0);
    document.getElementById('savedCount').textContent = totalPapers;
}

document.addEventListener('click', () => {
    document.querySelectorAll('.folder-dropdown').forEach(d => {
        d.classList.remove('show');
    });
});

function savePaper(pmid, title) {
    const folder = folders.find(f => f.id === currentFolder);
    if (!folder) return;
    
    const exists = folders.some(f => f.papers.some(p => p.pmid === pmid));
    if (exists) {
        alert('This article is already saved in a folder');
        return;
    }
    
    folder.papers.push({ pmid, title, date: new Date().toISOString() });
    saveFolders();
    alert('✅ Article saved in: ' + folder.name);
}

let currentSearchMode = 'ai';

function switchSearchMode(mode) {
    currentSearchMode = mode;
    
    const aiRow = document.getElementById('searchAI');
    const directRow = document.getElementById('searchDirect');
    const tabAI = document.getElementById('tabAI');
    const tabDirect = document.getElementById('tabDirect');
    
    if (mode === 'ai') {
        aiRow.style.display = 'flex';
        directRow.style.display = 'none';
        tabAI.classList.add('active');
        tabDirect.classList.remove('active');
        document.getElementById('userPrompt').focus();
    } else {
        aiRow.style.display = 'none';
        directRow.style.display = 'flex';
        tabAI.classList.remove('active');
        tabDirect.classList.add('active');
        document.getElementById('directQuery').focus();
    }
}

function handleDirectEnter(e) {
    if (e.key === 'Enter') startDirectSearch();
}

async function startDirectSearch() {
    const input = document.getElementById('directQuery').value;
    if (!input.trim()) return;

    addToHistory(input);
    currentStart = 0;
    hasMoreResults = true;
    isLoading = false;
    
    document.getElementById('paperList').innerHTML = "";
    document.getElementById('resultsContainer').style.display = 'none';
    document.getElementById('queryPanel').style.display = 'none';
    
    const btn = document.getElementById('btnDirectSearch');
    btn.disabled = true;
    btn.textContent = "...";
    document.getElementById('mainLoader').style.display = 'block';

    try {
        const filters = buildFilters();
        currentQuery = input + filters;
        document.getElementById('queryText').innerText = currentQuery;
        document.getElementById('queryPanel').style.display = 'block';
        
        await fetchPapersBatch();
        document.getElementById('resultsContainer').style.display = 'block';
    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Search";
        document.getElementById('mainLoader').style.display = 'none';
    }
}

function openAboutModal() {
    document.getElementById('aboutModal').style.display = 'flex';
}

function closeAboutModal(e) {
    if (e && e.target !== document.getElementById('aboutModal') && e.target.className !== 'close-btn') {
        return;
    }
    document.getElementById('aboutModal').style.display = 'none';
}

renderFolders();
renderSavedPapers();