module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    name: "Agent Firm",
    phase: 1,
    network: "eip155:8453",
    asset: "USDC",
    payTo: "0xa26f179e42836bc4ae0cea997fdfc9602d5b8147",
    payToName: "treasury-grokbot.base.eth",
    checkout: {
      automated: false,
      note: "Unpaid skill routes return HTTP 402. Settlement/fulfillment is still manual until we wire a facilitator.",
    },
    skills: [
      { id: "risk.snapshot", path: "/api/v1/risk-snapshot", price: "0.10" },
      { id: "research.memo.base", path: "/api/v1/research-memo", price: "0.50" },
      { id: "exec.recipe.base", path: "/api/v1/exec-recipe", price: "5.00" },
    ],
  });
};
