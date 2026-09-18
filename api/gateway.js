import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";

const PAY_TO = process.env.X402_PAY_TO;
const FACILITATOR = "https://facilitator.payai.network";
const app = express();
let ready;
let boot = { ok: false, error: "not_started" };

async function start() {
  if (ready) return app;
  try {
    const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR });
    const server = new x402ResourceServer(facilitatorClient);
    server.register("eip155:8453", new ExactEvmScheme());
    await server.initialize();

    app.use(
      paymentMiddleware(
        {
          "GET /api/v1/risk-snapshot": {
            accepts: [
              {
                scheme: "exact",
                price: "$0.10",
                network: "eip155:8453",
                payTo: PAY_TO,
              },
            ],
            description: "Red-flag snapshot for a Base address. Not investment advice.",
            mimeType: "application/json",
          },
        },
        server
      )
    );

    boot = { ok: true, error: null };
  } catch (e) {
    boot = { ok: false, error: String(e && e.message ? e.message : e) };
  }

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      mode: boot.ok ? "payai" : "fallback",
      facilitator: FACILITATOR,
      hasPayTo: Boolean(PAY_TO && PAY_TO.startsWith("0x")),
      error: boot.error,
    });
  });

  app.get("/api/v1/risk-snapshot", async (req, res) => {
    if (!boot.ok) {
      res.status(402).json({ error: "Payment required", cdp_error: boot.error });
      return;
    }
    const subject = String(req.query.subject || req.query.address || "").trim();
    if (!subject) {
      res.status(400).json({ error: "Pass ?subject=0x..." });
      return;
    }
    let explorer = null;
    try {
      const r = await fetch(`https://base.blockscout.com/api/v2/addresses/${subject}`);
      if (r.ok) explorer = await r.json();
    } catch {
      explorer = { error: "explorer_unavailable" };
    }
    res.json({
      type: "risk.snapshot",
      skill: "risk.snapshot",
      network: "eip155:8453",
      subject,
      source: `https://base.blockscout.com/address/${subject}`,
      explorer,
      signed: false,
      note: "Automated explorer snapshot. Not investment advice.",
    });
  });

  ready = true;
  return app;
}

export default async function handler(req, res) {
  const application = await start();
  return application(req, res);
}
