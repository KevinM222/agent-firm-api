const PAY_TO = "0xa26f179e42836bc4ae0cea997fdfc9602d5b8147";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const body = {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: `${proto}://${host}/api/v1/research-memo`,
      description:
        "Sourced Base memo. Flash 0.50 USDC. Not a buy order. Fulfillment still manual.",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "500000",
        asset: USDC_BASE,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USDC",
          version: "2",
          skill: "research.memo.base",
          price_usdc: "0.50",
        },
      },
    ],
  };

  res.setHeader(
    "PAYMENT-REQUIRED",
    Buffer.from(JSON.stringify(body)).toString("base64")
  );
  res.status(402).json(body);
};
