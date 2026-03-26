const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(__dirname));

// ── Submit assessment ──
app.post("/api/submit", (req, res) => {
  const { name, ratings, domains } = req.body;

  if (!ratings || typeof ratings !== "object") {
    return res.status(400).json({ error: "Missing ratings" });
  }

  const id = crypto.randomBytes(4).toString("hex"); // 8-char hex
  const record = {
    id,
    name: (name || "").trim() || "Anonymous",
    ratings,
    domains, // domain metadata for rendering
    submittedAt: new Date().toISOString(),
  };

  const filePath = path.join(DATA_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

  console.log(`Assessment saved: ${id} (${record.name})`);
  res.json({ id });
});

// ── Get results ──
app.get("/api/results/:id", (req, res) => {
  const { id } = req.params;

  // Sanitize: only allow alphanumeric
  if (!/^[a-z0-9]+$/i.test(id)) {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const filePath = path.join(DATA_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Assessment not found" });
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  res.json(data);
});

// ── List all assessments (for facilitators) ──
app.get("/api/assessments", (req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  const summaries = files.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8"));
    // Compute overall average
    const vals = Object.values(data.ratings).filter(v => typeof v === "number");
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return {
      id: data.id,
      name: data.name,
      submittedAt: data.submittedAt,
      overallAvg: Math.round(avg * 10) / 10,
      conceptsRated: vals.length,
    };
  });
  summaries.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  res.json(summaries);
});

// ── SPA fallback: serve index.html for /results/:id routes ──
app.get("/results/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Architect Assessment server running at http://localhost:${PORT}`);
});
