// Vercel serverless entry point at root
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({
    success: true,
    message: 'Backend is running',
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  }));
};
