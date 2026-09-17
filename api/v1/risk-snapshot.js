const PAY_TO = "0xa26f179e42836bc4ae0cea997fdfc9602d5b8147";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function paymentRequired(resourceUrl) {
  return {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: resourceUrl,
      description: "Red-flag snapshot for a Base address or contract. Not investment advice.",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: "100000",
        asset: USDC_BASE,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USDC",
          version: "2",
          skill: "risk.snapshot",
          price_usdc: "0.10",
        },
      },
    ],
  };
}

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, PAYMENT-SIGNATURE, X-PAYMENT"
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const paid = req.headers["payment-signature"] || req.headers["x-payment"];
  const host = req.headers["x-forwarded-host"] || req.headers.host || "agent-firm.vercel.app";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const resourceUrl = `${proto}://${host}/api/v1/risk-snapshot`;
  const body = paymentRequired(resourceUrl);

  if (!paid) {
    res.setHeader(
      "PAYMENT-REQUIRED",
      Buffer.from(JSON.stringify(body)).toString("base64")
    );
    res.status(402).json(body);
    return;
  }

  res.status(402).json({
    ...body,
    error:
      "Payment header seen, but automated fulfillment is not live. Use https://agent-firm.grok.me/request",
  });
};
