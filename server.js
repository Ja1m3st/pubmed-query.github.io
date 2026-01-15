//require('dotenv').config(); 

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();

const API_PUBMED = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// 2. Ahora cogemos la clave del entorno
const API_KEY = process.env.API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting
let lastRequestTime = 0;
const RATE_LIMIT_DELAY = 350;

async function throttledFetch(url) {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLast));
    }
    lastRequestTime = Date.now();
    return fetch(url);
}

// API Endpoints

// Generate AI query
app.post('/api/generate-query', async (req, res) => {
    try {
        const { userInput } = req.body;
        
        const systemPrompt = `You are an expert PubMed Medical Research Librarian specialized in creating EFFECTIVE and CONCISE queries.

    CRITICAL RULES:
    1. Keep queries UNDER 200 characters when possible
    2. Match the SPECIFICITY of the user's search - don't add extra concepts they didn't ask for
    3. Use 1-3 concept groups based on what user asks
    4. Prioritize MeSH terms but include [tiab] alternatives
    5. Use wildcards (*) strategically

    EXAMPLES:

    Input: "gout" (SINGLE DISEASE - no specific aspect)
    Output: Gout[MeSH] OR gout[tiab] OR gouty arthritis[tiab]

    Input: "gout complications" (DISEASE + SPECIFIC ASPECT)
    Output: (Gout[MeSH] OR gout[tiab]) AND (complications[tiab] OR cardiovascular[tiab] OR renal[tiab] OR outcome*[tiab])

    Input: "gout treatment"
    Output: (Gout[MeSH] OR gout[tiab]) AND (drug therapy[sh] OR treatment[tiab] OR therap*[tiab])

    Input: "lupus"
    Output: Lupus Erythematosus, Systemic[MeSH] OR lupus[tiab] OR SLE[tiab]

    Input: "lupus kidney"
    Output: (Lupus Erythematosus, Systemic[MeSH] OR lupus[tiab]) AND (Kidney Diseases[MeSH] OR nephritis[tiab] OR renal[tiab])

    Input: "diabetes"
    Output: Diabetes Mellitus[MeSH] OR diabetes[tiab]

    Input: "insulin resistance"
    Output: Insulin Resistance[MeSH] OR insulin resistan*[tiab]

    IMPORTANT RULES:
    - If user searches ONLY a disease name → search ONLY that disease (broad search)
    - If user searches disease + aspect → search disease AND that specific aspect
    - TRANSLATE to English if input is in another language
    - DO NOT add aspects the user didn't ask for
    - Keep it simple and direct

    Output ONLY the query string, no explanations.

    User input: "${userInput}"`;

        const url = `https://gen.pollinations.ai/text/${encodeURIComponent(userInput)}?model=openai&system=${encodeURIComponent(systemPrompt)}&key=${API_KEY}`;
        const response = await throttledFetch(url);
        
        if (!response.ok) throw new Error("AI service error");
        
        let query = (await response.text()).replace(/^"|"$/g, '').trim();
        
        if (query.length > 500) {
            const words = userInput.toLowerCase().trim().split(/\s+/).filter(w => w.length > 2);
            query = words.length === 1 ? `${words[0]}[tiab]` : words.map(w => `${w}[tiab]`).join(' AND ');
        }
        
        res.json({ query });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search PubMed
app.post('/api/search', async (req, res) => {
    try {
        const { query, start = 0, max = 10 } = req.body;
        
        const searchUrl = `${API_PUBMED}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retstart=${start}&retmax=${max}&retmode=json&sort=relevance`;
        const searchRes = await throttledFetch(searchUrl);
        const contentType = searchRes.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await searchRes.json();
        } else {
            const text = await searchRes.text();
        }
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch paper details
app.post('/api/fetch-papers', async (req, res) => {
    try {
        const { ids } = req.body;
        
        const fetchUrl = `${API_PUBMED}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`;
        const fetchRes = await throttledFetch(fetchUrl);
        const xmlText = await fetchRes.text();
        
        res.type('text/xml').send(xmlText);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check free status
app.post('/api/check-free', async (req, res) => {
    try {
        const { ids } = req.body;
        
        const checkQuery = `(${ids.join(' OR ')}) AND "free full text"[filter]`;
        const checkUrl = `${API_PUBMED}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(checkQuery)}&retmode=json`;
        const checkRes = await throttledFetch(checkUrl);
        const data = await checkRes.json();
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate summary
app.post('/api/generate-summary', async (req, res) => {
    try {
        const { title, abstract, userSearch } = req.body;
        
        const prompt = `You are a medical analyst. Generate a SHORT summary in ENGLISH (max 10-15 lines).

        USER SEARCH: "${userSearch}"

        ARTICLE:
        Title: "${title}"
        Abstract: "${abstract.substring(0, 1800)}"

        INSTRUCTIONS:
        1. Summarize the article in max 10-15 lines.
        2. IMPORTANT: Clearly indicate if the article talks DIRECTLY about what the user is searching for.
        3. If it does, explain WHAT it says specifically.
        4. If it does NOT, indicate what it is actually about.

        FORMAT (max 15 lines):

        <p><strong>Relevance:</strong> [YES, talks about X / NO directly, talks about Y]</p>

        <p><strong>Summary:</strong> [2-3 lines of main content]</p>

        Be HONEST about relevance.`;

        const url = `https://gen.pollinations.ai/text/${encodeURIComponent(prompt)}?model=openai&key=${API_KEY}`;
        const response = await throttledFetch(url);
        
        if (!response.ok) throw new Error("AI Error");
        
        let text = await response.text();
        text = text.replace(/```html/g, '').replace(/```/g, '');
        
        res.json({ summary: text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get related papers
app.post('/api/related-papers', async (req, res) => {
    try {
        const { pmid } = req.body;
        
        const linkUrl = `${API_PUBMED}/elink.fcgi?dbfrom=pubmed&id=${pmid}&retmode=json&cmd=neighbor_score`;
        const linkRes = await throttledFetch(linkUrl);
        const linkData = await linkRes.json();
        
        const relatedIds = linkData.linksets?.[0]?.linksetdbs?.[0]?.links?.slice(0, 4) || [];
        
        if (relatedIds.length === 0) {
            return res.json({ relatedIds: [] });
        }
        
        const fetchUrl = `${API_PUBMED}/efetch.fcgi?db=pubmed&id=${relatedIds.join(',')}&retmode=xml`;
        const fetchRes = await throttledFetch(fetchUrl);
        const xmlText = await fetchRes.text();
        
        res.type('text/xml').send(xmlText);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Solo escuchamos el puerto si estamos en local (no en Vercel)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
}

// IMPORTANTE PARA VERCEL: Exportar la app
module.exports = app;