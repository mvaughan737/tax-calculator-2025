const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'saved-returns.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Helper function to read data
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading data:', error);
        return [];
    }
}

// Helper function to write data
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing data:', error);
        return false;
    }
}

// API Routes

// Save new tax return
app.post('/api/save', (req, res) => {
    try {
        const { email, data } = req.body;

        if (!email || !data) {
            return res.status(400).json({ error: 'Email and data are required' });
        }

        const returns = readData();
        const existingIndex = returns.findIndex(r => r.email === email);

        const taxReturn = {
            id: existingIndex >= 0 ? returns[existingIndex].id : uuidv4(),
            email,
            data,
            lastModified: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            returns[existingIndex] = taxReturn;
        } else {
            returns.push(taxReturn);
        }

        if (writeData(returns)) {
            res.json({ success: true, id: taxReturn.id, message: 'Tax return saved successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save data' });
        }
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Load tax return by email
app.get('/api/load/:email', (req, res) => {
    try {
        const { email } = req.params;
        const returns = readData();
        const taxReturn = returns.find(r => r.email === email);

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

// Update existing tax return
app.put('/api/update/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { data } = req.body;

        if (!data) {
            return res.status(400).json({ error: 'Data is required' });
        }

        const returns = readData();
        const index = returns.findIndex(r => r.id === id);

        if (index >= 0) {
            returns[index].data = data;
            returns[index].lastModified = new Date().toISOString();

            if (writeData(returns)) {
                res.json({ success: true, message: 'Tax return updated successfully' });
            } else {
                res.status(500).json({ error: 'Failed to update data' });
            }
        } else {
            res.status(404).json({ error: 'Tax return not found' });
        }
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete tax return
app.delete('/api/delete/:id', (req, res) => {
    try {
        const { id } = req.params;
        const returns = readData();
        const filteredReturns = returns.filter(r => r.id !== id);

        if (filteredReturns.length < returns.length) {
            if (writeData(filteredReturns)) {
                res.json({ success: true, message: 'Tax return deleted successfully' });
            } else {
                res.status(500).json({ error: 'Failed to delete data' });
            }
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
    res.json({ status: 'ok', message: 'Tax Calculator API is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Tax Calculator 2025 Backend Server`);
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`📁 Data stored in: ${DATA_FILE}`);
    console.log(`\n✅ Ready to accept connections!\n`);
});
