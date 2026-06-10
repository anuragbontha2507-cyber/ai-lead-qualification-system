const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./backend/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// Fallback to index.html for single-page application router behavior
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` AI Lead Qualification + Follow-up System Web Server`);
  console.log(` Company: lohithadharma Projects PVT, LTD.`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
