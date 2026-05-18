const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'hillstrade_secure_node_key_2026';
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database helper tools
function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { 
            users: [], 
            deposits: [], 
            withdrawals: [], 
            settings: { 
                adminPasskey: "Admin2026!", 
                globalWalletAddress: "bc1q7zuadd7wr7lmk37z04jxng8m38pfdglsr8nqhy" 
            } 
        };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
// --- SECURE ACCOUNTS API ROUTING ---

// Real Registration Gateway
app.post('/api/auth/signup', async (req, res) => {
    const { fullName, email, password, walletAddress } = req.body;
    if (!fullName || !email || !password) return res.status(400).json({ msg: 'All core fields are required' });

    let db = readDB();
    if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ msg: 'Registration email already in use' });
    }

    const securePassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: 'USR_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        fullName,
        email: email.toLowerCase(),
        password: securePassword,
        walletAddress: walletAddress || '',
        balance: 0,
        earnings: 0,
        createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);
    res.json({ success: true, msg: 'Account successfully registered' });
});

// Secure Sign In Portal
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    let db = readDB();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(400).json({ msg: 'Invalid authorization credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid authorization credentials' });

    const sessionToken = jwt.sign({ id: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ sessionToken, user: { id: user.id, fullName: user.fullName, balance: user.balance, earnings: user.earnings } });
});

// User Dashboard Accounting Load
app.get('/api/user/dashboard', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ msg: 'No session token provided' });
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        let db = readDB();
        const user = db.users.find(u => u.id === verified.id);
        if (!user) return res.status(404).json({ msg: 'Account profile not found' });
        
        const userDeposits = db.deposits.filter(d => d.userId === user.id);
        const userWithdrawals = db.withdrawals.filter(w => w.userId === user.id);
        
        res.json({
            fullName: user.fullName,
            balance: user.balance,
            earnings: user.earnings,
            walletAddress: user.walletAddress,
            deposits: userDeposits,
            withdrawals: userWithdrawals,
            globalWallet: db.settings.globalWalletAddress
        });
    } catch (e) { res.status(400).json({ msg: 'Session expired or invalid' }); }
});

// Record New User Deposit Request
app.post('/api/user/deposit', (req, res) => {
    const token = req.headers['authorization'];
    const { amount, txHash } = req.body;
    if (!token) return res.status(401).json({ msg: 'Unauthorized request' });
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        let db = readDB();
        const user = db.users.find(u => u.id === verified.id);
        
        const depositTicket = {
            id: 'DEP_' + Math.random().toString(36).substr(2, 5).toUpperCase(),
            userId: user.id,
            userEmail: user.email,
            amount: parseFloat(amount),
            txHash: txHash || 'Manual Transfer Protocol',
            status: 'PENDING',
            date: new Date().toISOString()
        };
        db.deposits.push(depositTicket);
        writeDB(db);
        res.json({ success: true, msg: 'Deposit processing logged' });
    } catch (e) { res.status(400).json({ msg: 'Invalid request parameter' }); }
});

// --- MAIN ADMINISTRATIVE MASTER ENGINE ---

// Administrator Verification Gate
app.post('/api/admin/login', (req, res) => {
    const { passkey } = req.body;
    let db = readDB();
    if (passkey !== db.settings.adminPasskey) return res.status(401).json({ msg: 'Access Denied: Terminal Secured' });
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, success: true });
});

// Admin Control Terminal: Review All Users & Financial Statements
app.get('/api/admin/data', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ msg: 'Access denied' });
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        if (verified.role !== 'admin') return res.status(403).json({ msg: 'Access unauthorized' });
        let db = readDB();
        res.json({ users: db.users, deposits: db.deposits, withdrawals: db.withdrawals, settings: db.settings });
    } catch(e) { res.status(400).json({ msg: 'Session closed' }); }
});

// Admin Control Terminal: Credit Balance & Approve Pending Deposit
app.post('/api/admin/approve-deposit', (req, res) => {
    const token = req.headers['authorization'];
    const { depositId } = req.body;
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        if (verified.role !== 'admin') return res.status(403).json({ msg: 'Access unauthorized' });
        let db = readDB();
        const deposit = db.deposits.find(d => d.id === depositId);
        if (deposit && deposit.status === 'PENDING') {
            deposit.status = 'CONFIRMED';
            const user = db.users.find(u => u.id === deposit.userId);
            if (user) user.balance += deposit.amount;
            writeDB(db);
            return res.json({ success: true, msg: 'Deposit validated. Funds active on client ledger' });
        }
        res.status(400).json({ msg: 'Transaction ledger item not found or already audited' });
    } catch(e) { res.status(400).json({ msg: 'Verification session closed' }); }
});

// Admin Control Terminal: Change Live Wallet Globally
app.post('/api/admin/update-wallet', (req, res) => {
    const token = req.headers['authorization'];
    const { newAddress } = req.body;
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        if (verified.role !== 'admin') return res.status(403).json({ msg: 'Access unauthorized' });
        let db = readDB();
        db.settings.globalWalletAddress = newAddress;
        writeDB(db);
        res.json({ success: true, msg: 'Company target core custody address reset globally' });
    } catch(e) { res.status(400).json({ msg: 'Session validation failed' }); }
});

app.listen(PORT, () => console.log(`Server execution engine active on port ${PORT}`));
