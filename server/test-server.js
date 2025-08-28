const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

// Force HTTP mode
process.env.HTTPS = 'false';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.get('/', (req, res) => {
  res.json({ message: 'Test server running', ssl: false });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', ssl: false });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📱 API available at http://localhost:${PORT}/api`);
  console.log(`🔒 SSL/HTTPS: DISABLED`);
});
