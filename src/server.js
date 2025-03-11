const express = require('express');
const config = require('../config'); // Already correct path since server.js is in src/
const routes = require('./routes');

// ... rest of the file remains unchanged ...

// Initialize Express app
const app = express();

// Raw body parser for JWT tokens
app.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/jwt') {
    let data = Buffer.from('');
    
    req.on('data', chunk => {
      data = Buffer.concat([data, chunk]);
    });
    
    req.on('end', () => {
      req.rawBody = data.toString();
      req.body = req.rawBody;
      next();
    });
  } else {
    next();
  }
});

// Standard JSON and URL-encoded parsers for non-JWT requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log all requests
app.use((req, res, next) => {
  console.log(`Request received: ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

// Routes
app.use('/', routes);

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.server.env}`);
});