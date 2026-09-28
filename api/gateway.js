import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

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
            description:
              "Red-flag snapshot for a Base address. Not investment advice.",
            mimeType: "application/json",
            extensions: {
              ...declareDiscoveryExtension({
                input: { subject: "0x0000000000000000000000000000000000000000" },
                inputSchema: {
                  properties: {
                    subject: {
                      type: "string",
                      description: "Base address or contract to snapshot",
                    },
                  },
                  required: ["subject"],
                },
                output: {
                  example: {
                    type: "risk.snapshot",
                    skill: "risk.snapshot",
                    network: "eip155:8453",
                    subject: "0x0000000000000000000000000000000000000000",
                  },
                },
              }),
            },
          },
          "GET /api/v1/research-memo": {
            accepts: [
              {
                scheme: "exact",
                price: "$0.50",
                network: "eip155:8453",
                payTo: PAY_TO,
              },
            ],
            description:
              "Flash sourced memo. Not a buy order. Phase 1 automated flash only.",
            mimeType: "application/json",
            extensions: {
              ...declareDiscoveryExtension({
                input: { topic: "x402" },
                inputSchema: {
                  properties: {
                    topic: {
                      type: "string",
                      description: "Topic or Base address for a flash memo",
                    },
                  },
                  required: ["topic"],
                },
                output: {
                  example: {
                    type: "memo",
                    skill: "research.memo.base",
                    depth: "flash",
                    topic: "x402",
                  },
                },
              }),
            },
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
      mode: boot.ok ? "payai-bazaar" : "fallback",
      facilitator: FACILITATOR,
      hasPayTo: Boolean(PAY_TO && PAY_TO.startsWith("0x")),
      skills: ["risk.snapshot", "research.memo.base"],
      error: boot.error,
    });
  });

  app.get(["/openapi.json", "/api/openapi.json"], (_req, res) => {
    res.json({
      openapi: "3.1.0",
      info: {
        title: "Agent Firm",
        version: "1.1.0",
        description:
          "x402-paid Base USDC skills. Not investment advice. No custody.",
      },
      servers: [{ url: "https://agent-firm-api.vercel.app" }],
      paths: {
        "/api/v1/risk-snapshot": {
          get: {
            summary: "Red-flag snapshot for a Base address",
            parameters: [
              {
                name: "subject",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": { description: "Snapshot JSON after payment" },
              "402": { description: "Payment required" },
            },
            "x-payment-info": {
              protocols: ["x402"],
              network: "eip155:8453",
              asset: "USDC",
              price: "0.10",
              payTo: PAY_TO,
            },
          },
        },
        "/api/v1/research-memo": {
          get: {
            summary: "Flash sourced memo",
            parameters: [
              {
                name: "topic",
                in: "query",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": { description: "Memo JSON after payment" },
              "402": { description: "Payment required" },
            },
            "x-payment-info": {
              protocols: ["x402"],
              network: "eip155:8453",
              asset: "USDC",
              price: "0.50",
              payTo: PAY_TO,
            },
          },
        },
      },
    });
  });

  app.get("/api/v1/risk-snapshot", async (req, res) => {
    if (!boot.ok) {
      res.status(402).json({ error: "Payment required", error_detail: boot.error });
      return;
    }
    const subject = String(req.query.subject || req.query.address || "").trim();
    if (!subject) {
      res.status(400).json({ error: "Pass ?subject=0x..." });
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
      source: `https://base.blockscout.com/address/${subject}`,
      explorer,
      signed: false,
      note: "Automated explorer snapshot. Not investment advice.",
    });
  });

  app.get("/api/v1/research-memo", async (req, res) => {
    if (!boot.ok) {
      res.status(402).json({ error: "Payment required", error_detail: boot.error });
      return;
    }
    const topic = String(req.query.topic || "").trim();
    if (!topic) {
      res.status(400).json({ error: "Pass ?topic=..." });
      return;
    }

    const facts = [];
    const sources = [];
    const isAddr = /^0x[a-fA-F0-9]{40}$/.test(topic);

    try {
      if (isAddr) {
        const r = await fetch(
          `https://base.blockscout.com/api/v2/addresses/${topic}`
        );
        sources.push(`https://base.blockscout.com/address/${topic}`);
        if (r.ok) {
          const j = await r.json();
          facts.push({
            claim: `Base explorer lists this as ${j.implementation_name || j.name || j.is_contract ? "a contract or labeled address" : "an EOA-style address"}.`,
            source: sources[0],
          });
          facts.push({
            claim: `Coin balance field present: ${String(j.coin_balance || "unknown")}.`,
            source: sources[0],
          });
        } else {
          facts.push({
            claim: "Explorer did not return a usable record for this address.",
            source: sources[0],
          });
        }
      } else {
        const title = encodeURIComponent(topic.replace(/\s+/g, "_"));
        const r = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
          { headers: { "User-Agent": "AgentFirmFlashMemo/1.1" } }
        );
        sources.push(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
        if (r.ok) {
          const j = await r.json();
          if (j.extract) {
            facts.push({
              claim: String(j.extract).slice(0, 600),
              source: j.content_urls?.desktop?.page || sources[0],
            });
          }
          if (j.description) {
            facts.push({
              claim: `Short descriptor: ${j.description}`,
              source: j.content_urls?.desktop?.page || sources[0],
            });
          }
        } else {
          facts.push({
            claim:
              "No Wikipedia summary for that topic string. Treat as unsourced; use /request for a human Research memo.",
            source: "https://agent-firm.grok.m
