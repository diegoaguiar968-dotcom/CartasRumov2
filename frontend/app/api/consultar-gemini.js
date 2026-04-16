// api/consultar-gemini.js
export default async function handler(req, res) {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY; // Aqui ele pega a chave que você salvou na Vercel
    const model = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        const texto = data.candidates[0].content.parts[0].text;
        res.status(200).json({ resultado: texto });
    } catch (error) {
        res.status(500).json({ error: "Erro ao consultar Gemini" });
    }
}
