import express from "express";

const app = express();
const PAY_TO = process.env.X402_PAY_TO || "";
const HAS_ID = Boolean(process.env.CDP_API_KEY_ID);
const HAS_SECRET = Boolean(process.env.CDP_API_KEY_SECRET);

let cdp = { ok: false, error: "not_started" };

async function initCdp() {
  try {
    const { createX402Server } = await import("@coinbase/cdp-sdk/x402");
    const { paymentMiddlewareFromHTTPServer } = await import("@x402/express");
    const server = await createX402Server({
      environment: "production",
      payToConfig: { type: "address", evm: PAY_TO },
      routes: {
        "GET /api/v1/risk-snapshot": {
          price: "$0.10",
          networks: ["eip155:8453"],
          description: "Red-flag snapshot for a Base address.",
        },
      },
    });
    app.use(paymentMiddlewareFromHTTPServer(server));
    cdp = { ok: true, error: null };
  } catch (e) {
    cdp = { ok: false, error: String(e && e.message ? e.message : e) };
  }
}

const ready = initCdp();

app.get("/api/health", async (_req, res) => {
  await ready;
  res.json({
    ok: true,
    mode: cdp.ok ? "cdp" : "fallback",
    cdp: cdp.ok,
    error: cdp.error,
    hasPayTo: PAY_TO.startsWith("0x"),
    hasKeyId: HAS_ID,
    hasSecret: HAS_SECRET,
  });
});

app.get("/api/v1/risk-snapshot", async (req, res) => {
  await ready;
  if (cdp.ok) {
    res.json({
      type: "risk.snapshot",
      note: "If you see this without paying, middleware did not wrap the route.",
    });
    return;
  }
  res.status(402).json({
    error: "Payment required",
    mode: "fallback",
    cdp_error: cdp.error,
  });
});

export default async function handler(req, res) {
  await ready;
  return app(req, res);
}
