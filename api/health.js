module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    ok: true,
    name: "Agent Firm API",
    checkout: "402_probe_only",
    site: "https://agent-firm.grok.me",
  });
};
