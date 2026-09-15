const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const ideaRoutes = require('./routes/ideas');

app.use('/api/auth', authRoutes);
app.use('/api/ideas', ideaRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Startup Validator API is running!' });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
  });