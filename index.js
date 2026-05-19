const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// NETWORK FIX: Bound dynamically to support production routing
const PORT = process.env.PORT || 3000;

// Local JSON Database Setup
const DB_FILE = path.join(__dirname, 'database.json');

// Ensure database file exists upon server startup
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], transactions: [] }, null, 2));
}

// Global Middleware Systems
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dynamic Assets & Public Folder Mapping
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions to read/write from local JSON layout
const readDatabase = () => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { users: [], transactions: [] };
    }
};

const writeDatabase = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// ==========================================
//          CORE ROUTING CONTROLLERS
// ==========================================

// Base Platform Index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication System Interface (Login/Signup)
app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

// User Trading & Overview Dashboard Terminal
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Administration & Accounting Control Room
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==========================================
//          BACKEND AUTHENTICATION API
// ==========================================

// User Registration Processing Pipeline
app.post('/api/auth/signup', (req, res) => {
    const { fullname, email, username, password, phone } = req.body;
    const db = readDatabase();

    // Check for unique attributes to avoid duplicate records
    const userExists = db.users.find(u => u.email === email || u.username === username);
    if (userExists) {
        return res.status(400).json({ success: false, message: 'Username or Email already registered.' });
    }

    // Build standard schema layout configuration
    const newUser = {
        id: 'usr_' + Date.now(),
        fullname,
        email,
        username,
        password, // Maintained flat string representation as previously structured
        phone: phone || '',
        balance: 0.00,
        savings: 0.00,
        role: 'user',
        status: 'active',
        createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDatabase(db);

    res.status(201).json({ success: true, message: 'Account provisioned successfully.', userId: newUser.id });
});

// User Credentials Verification Session Endpoints
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDatabase();

    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid authentication credentials.' });
    }

    res.status(200).json({
        success: true,
        message: 'Authorization granted.',
        user: {
            id: user.id,
            username: user.username,
            fullname: user.fullname,
            role: user.role
        }
    });
});

// ==========================================
//         FINTECH TRANSACTION ENGINES
// ==========================================

// Fetch Individual Profile State Metrics
app.get('/api/user/:id', (req, res) => {
    const db = readDatabase();
    const user = db.users.find(u => u.id === req.params.id);
    
    if (!user) {
        return res.status(404).json({ success: false, message: 'Identity context not discovered.' });
    }
    res.json({ success: true, user });
});

// Process Financial Deposits / Funding
app.post('/api/transactions/deposit', (req, res) => {
    const { userId, amount, paymentMethod } = req.body;
    const db = readDatabase();
    
    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Account record missing.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid transactional calculation.' });
    }

    // Append to internal array storage mapping
    db.users[userIndex].balance += parsedAmount;

    const transactionRecord = {
        id: 'txn_' + Date.now(),
        userId,
        type: 'deposit',
        amount: parsedAmount,
        method: paymentMethod || 'manual_verification',
        status: 'completed',
        timestamp: new Date().toISOString()
    };

    db.transactions.push(transactionRecord);
    writeDatabase(db);

    res.json({ success: true, message: 'Balance adjusted.', balance: db.users[userIndex].balance });
});

// Process Manual Asset Redemptions / Withdrawals
app.post('/api/transactions/withdraw', (req, res) => {
    const { userId, amount, destinationAccount } = req.body;
    const db = readDatabase();

    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Account context absent.' });
    }

    const parsedAmount = parseFloat(amount);
    if (db.users[userIndex].balance < parsedAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient clear ledger balance.' });
    }

    // Deduct balances immediately and stage manual authorization step
    db.users[userIndex].balance -= parsedAmount;

    const withdrawalRecord = {
        id: 'wth_' + Date.now(),
        userId,
        type: 'withdrawal',
        amount: parsedAmount,
        destination: destinationAccount,
        status: 'pending_admin_clearance',
        timestamp: new Date().toISOString()
    };

    db.transactions.push(withdrawalRecord);
    writeDatabase(db);

    res.json({ success: true, message: 'Processing manual administrative withdrawal.', balance: db.users[userIndex].balance });
});

// ==========================================
//          ADMINISTRATIVE CONTROL PANELS
// ==========================================

// Global User Registry Index Data Access
app.get('/api/admin/users', (req, res) => {
    const db = readDatabase();
    res.json({ success: true, users: db.users });
});

// Global Transaction Ledger Index Data Access
app.get('/api/admin/transactions', (req, res) => {
    const db = readDatabase();
    res.json({ success: true, transactions: db.transactions });
});

// Manual Authorization Management Trigger Updates
app.post('/api/admin/transactions/update', (req, res) => {
    const { transactionId, actionStatus } = req.body; // Action: 'approved' or 'declined'
    const db = readDatabase();

    const txnIndex = db.transactions.findIndex(t => t.id === transactionId);
    if (txnIndex === -1) {
        return res.status(404).json({ success: false, message: 'Target entry not found.' });
    }

    db.transactions[txnIndex].status = actionStatus;
    writeDatabase(db);

    res.json({ success: true, message: `Record marked as ${actionStatus}.` });
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



// 🚀 PRODUCTION SERVER STARTUP ENGINE (Bound securely to 0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 Hillstrade Engine Running Online!`);
    console.log(`📡 Bound Dynamically on Production Port: ${PORT}`);
    console.log(`=========================================`);
});
