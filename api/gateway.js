import express from "express";

const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: "test-no-cdp" });
});

app.get("/api/v1/risk-snapshot", (_req, res) => {
  res.status(402).json({ error: "Payment required", mode: "test-no-cdp" });
});

export default function handler(req, res) {
  return app(req, res);
}
