import express from "express";
import { createX402Server } from "@coinbase/cdp-sdk/x402";
import { paymentMiddlewareFromHTTPServer } from "@x402/express";

const PAY_TO = process.env.X402_PAY_TO;
const app = express();
let started;

async function start() {
  if (started) return app;
  if (!PAY_TO) throw new Error("X402_PAY_TO missing");

  const server = await createX402Server({
    environment: "production",
    payToConfig: { type: "address", evm: PAY_TO },
    routes: {
      "GET /api/v1/risk-snapshot": {
        price: "$0.10",
        networks: ["eip155:8453"],
        description:
          "Red-flag snapshot for a Base address or contract. Not investment advice.",
      },
      "GET /api/v1/research-memo": {
        price: "$0.50",
        networks: ["eip155:8453"],
        description: "Sourced memo. Not a buy order. Manual write-up until wired.",
      },
      "GET /api/v1/exec-recipe": {
        price: "$5.00",
        networks: ["eip155:8453"],
        description: "Unsigned exec recipe. We do not sign your wallet.",
      },
    },
  });

  app.use(paymentMiddlewareFromHTTPServer(server));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      name: "Agent Firm API",
      checkout: "cdp_facilitator",
      payTo: PAY_TO,
      site: "https://agent-firm.grok.me",
    });
  });

  app.get("/api/catalog", (_req, res) => {
    res.json({
      name: "Agent Firm",
      network: "eip155:8453",
      asset: "USDC",
      payTo: PAY_TO,
      checkout: { automated: true, facilitator: "cdp" },
      skills: [
        { id: "risk.snapshot", path: "/api/v1/risk-snapshot", price: "0.10" },
        { id: "research.memo.base", path: "/api/v1/research-memo", price: "0.50" },
        { id: "exec.recipe.base", path: "/api/v1/exec-recipe", price: "5.00" },
      ],
    });
  });

  app.get("/api/v1/risk-snapshot", async (req, res) => {
    const subject = String(req.query.subject || req.query.address || "").trim();
    if (!subject) {
      res.status(400).json({
        error: "Pass ?subject=0x... after payment",
        skill: "risk.snapshot",
      });
      return;
    }
    let explorer = null;
    try {
      const r = await fetch(
        `https://base.blockscout.com/api/v2/addresses/${subject}`
      );
      if (r.ok) explorer = await r.json();
    } catch {
      explorer = { error: "explorer_unavailable" };
    }
    res.json({
      type: "risk.snapshot",
      skill: "risk.snapshot",
      network: "eip155:8453",
      subject,
      payTo: PAY_TO,
      signed: false,
      source: `https://base.blockscout.com/address/${subject}`,
      explorer,
      red_flags: [],
      note: "Automated explorer snapshot. Not investment advice.",
    });
  });

  app.get("/api/v1/research-memo", (_req, res) => {
    res.json({
      skill: "research.memo.base",
      status: "paid_ack",
      note: "Payment accepted. Long-form memo still fulfilled by Research desk.",
    });
  });

  app.get("/api/v1/exec-recipe", (_req, res) => {
    res.json({
      skill: "exec.recipe.base",
      status: "paid_ack",
      note: "Payment accepted. Recipe is unsigned. We do not execute.",
    });
  });

  started = true;
  return app;
}

export default async function handler(req, res) {
  const application = await start();
  return application(req, res);
}
