require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// MongoDB Connection
if (MONGODB_URI && MONGODB_URI !== 'placeholder') {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ Connected to MongoDB Cloud Database'))
        .catch(err => console.error('❌ MongoDB connection error:', err));
} else {
    console.warn('⚠️ No MONGODB_URI found. Database features will not work until configured.');
}

// Tax Return Schema
const taxReturnSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    userName: String,
    lastModified: { type: Date, default: Date.now }
});

const TaxReturn = mongoose.model('TaxReturn', taxReturnSchema);

// API Routes

// Save or Update tax return
app.post('/api/save', async (req, res) => {
    try {
        const { email, data } = req.body;

        if (!email || !data) {
            return res.status(400).json({ error: 'Email and data are required' });
        }

        const taxReturn = await TaxReturn.findOneAndUpdate(
            { email },
            {
                data,
                lastModified: new Date(),
                userName: data.userName // Optional: capture name if provided in data
            },
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            id: taxReturn._id,
            message: 'Tax return saved successfully to Cloud Database'
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Load tax return by email
app.get('/api/load/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const taxReturn = await TaxReturn.findOne({ email });

        if (taxReturn) {
            res.json({ success: true, data: taxReturn });
        } else {
            res.status(404).json({ error: 'No saved return found for this email' });
        }
    } catch (error) {
        console.error('Load error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete tax return
app.delete('/api/delete/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const result = await TaxReturn.findOneAndDelete({ email });

        if (result) {
            res.json({ success: true, message: 'Tax return deleted successfully' });
        } else {
            res.status(404).json({ error: 'Tax return not found' });
        }
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        message: 'Tax Calculator API is running'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Tax Calculator 2025 Cloud-Ready Server`);
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`☁️ Database: ${MONGODB_URI && MONGODB_URI !== 'placeholder' ? 'MongoDB Cloud' : 'Not Configured'}`);
    console.log(`\n✅ Ready to accept connections!\n`);
});
