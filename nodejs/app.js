const express = require('express');
const axios = require('axios');
const { Buffer } = require('buffer');
const winston = require('winston');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const config = require('./config');

// Initialize Express app
const app = express();

// Configure logging
const logger = winston.createLogger({
    level: config.LOG_LEVEL,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: config.LOG_FILE }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB setup
let db;
let transactionsCollection;

async function connectToMongoDB() {
    try {
        const client = new MongoClient(config.MONGO_URI);
        await client.connect();
        
        db = client.db(config.MONGO_DB_NAME);
        transactionsCollection = db.collection(config.MONGO_COLLECTION_NAME);
        
        // Create indexes
        await transactionsCollection.createIndex({ phone: 1, amount: 1 });
        await transactionsCollection.createIndex({ transaction_id: 1 }, { unique: true });
        await transactionsCollection.createIndex({ checkout_request_id: 1 }, { unique: true });
        
        logger.info('Successfully connected to MongoDB');
    } catch (error) {
        logger.error(`Failed to connect to MongoDB: ${error.message}`);
        throw error;
    }
}

// Utility functions
function generateTimestamp() {
    return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
}

function generatePassword() {
    try {
        const timestamp = generateTimestamp();
        const password = Buffer.from(`${config.BUSINESS_SHORTCODE}${config.PASSKEY}${timestamp}`).toString('base64');
        return { password, timestamp };
    } catch (error) {
        logger.error(`Error generating password: ${error.message}`);
        throw error;
    }
}

async function getAccessToken() {
    try {
        const auth = Buffer.from(`${config.CONSUMER_KEY}:${config.CONSUMER_SECRET}`).toString('base64');
        const response = await axios.get(`${config.API_URL}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: { Authorization: `Basic ${auth}` },
            timeout: config.API_TIMEOUT
        });
        
        logger.info('Successfully obtained access token');
        return response.data.access_token;
    } catch (error) {
        logger.error(`Error getting access token: ${error.message}`);
        throw new Error(`Failed to get access token: ${error.message}`);
    }
}

function validatePhoneNumber(phone) {
    if (!phone) {
        return { isValid: false, error: 'Phone number is required' };
    }
    
    const cleanPhone = phone.replace(/[^\d]/g, '');
    
    if (!cleanPhone.startsWith('254')) {
        return { isValid: false, error: 'Phone number must start with 254' };
    }
    
    if (cleanPhone.length !== 12) {
        return { isValid: false, error: 'Phone number must be 12 digits (254XXXXXXXXX)' };
    }
    
    if (!config.PHONE_REGEX.test(cleanPhone)) {
        return { isValid: false, error: 'Phone number must be a valid Safaricom number' };
    }
    
    return { isValid: true, phone: cleanPhone };
}

function validateAmount(amount) {
    try {
        const numAmount = parseFloat(amount);
        
        if (isNaN(numAmount)) {
            return { isValid: false, error: 'Invalid amount format' };
        }
        
        if (numAmount < config.MIN_AMOUNT) {
            return { isValid: false, error: `Amount must be at least ${config.MIN_AMOUNT} KES` };
        }
        
        if (numAmount > config.MAX_AMOUNT) {
            return { isValid: false, error: `Amount cannot exceed ${config.MAX_AMOUNT} KES` };
        }
        
        return { isValid: true, amount: numAmount };
    } catch (error) {
        return { isValid: false, error: 'Invalid amount format' };
    }
}

// Authentication middleware
function requireApiToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }
    
    try {
        const token = authHeader.replace('Bearer ', '');
        const isValid = bcrypt.compareSync(token, config.API_TOKEN);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid API token' });
        }
        
        next();
    } catch (error) {
        logger.error(`Authentication error: ${error.message}`);
        return res.status(401).json({ error: 'Authentication failed' });
    }
}

// Routes
app.get('/health', async (req, res) => {
    try {
        await db.command({ ping: 1 });
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        logger.error(`Health check failed: ${error.message}`);
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

app.post('/initiate_payment', requireApiToken, async (req, res) => {
    try {
        const { phone, amount, account_reference = 'Payment', transaction_desc = 'Payment for goods/services' } = req.body;
        
        if (!phone || !amount) {
            return res.status(400).json({ error: 'Phone and amount are required' });
        }
        
        // Validate phone number
        const phoneValidation = validatePhoneNumber(phone);
        if (!phoneValidation.isValid) {
            return res.status(400).json({ error: phoneValidation.error });
        }
        
        // Validate amount
        const amountValidation = validateAmount(amount);
        if (!amountValidation.isValid) {
            return res.status(400).json({ error: amountValidation.error });
        }
        
        // Get access token
        const accessToken = await getAccessToken();
        
        // Generate password
        const { password, timestamp } = generatePassword();
        
        // Prepare STK push payload
        const payload = {
            BusinessShortCode: config.BUSINESS_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.floor(amountValidation.amount),
            PartyA: phoneValidation.phone,
            PartyB: config.BUSINESS_SHORTCODE,
            PhoneNumber: phoneValidation.phone,
            CallBackURL: config.CALLBACK_URL,
            AccountReference: account_reference,
            TransactionDesc: transaction_desc
        };
        
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };
        
        // Make STK push request
        const response = await axios.post(
            `${config.API_URL}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers,
                timeout: config.API_TIMEOUT
            }
        );
        
        const responseData = response.data;
        
        // Check for API errors
        if (responseData.errorCode) {
            logger.error(`STK push API error: ${JSON.stringify(responseData)}`);
            return res.status(400).json({
                error: 'Payment initiation failed',
                details: responseData.errorMessage || 'Unknown error'
            });
        }
        
        // Store initial transaction in MongoDB
        const transaction = {
            phone: phoneValidation.phone,
            amount: amountValidation.amount,
            status: 'PENDING',
            account_reference,
            transaction_desc,
            created_at: new Date(),
            checkout_request_id: responseData.CheckoutRequestID,
            merchant_request_id: responseData.MerchantRequestID,
            customer_message: responseData.CustomerMessage || '',
            request_id: responseData.RequestID || ''
        };
        
        try {
            await transactionsCollection.insertOne(transaction);
            logger.info(`Payment initiated: Phone=${phoneValidation.phone}, Amount=${amountValidation.amount}, CheckoutRequestID=${transaction.checkout_request_id}`);
        } catch (error) {
            if (error.code === 11000) {
                logger.warning(`Duplicate transaction attempt: CheckoutRequestID=${transaction.checkout_request_id}`);
                return res.status(409).json({ error: 'Duplicate transaction' });
            }
            throw error;
        }
        
        res.json({
            message: 'Payment initiated successfully',
            data: {
                checkout_request_id: responseData.CheckoutRequestID,
                merchant_request_id: responseData.MerchantRequestID,
                customer_message: responseData.CustomerMessage,
                status: 'PENDING'
            }
        });
        
    } catch (error) {
        logger.error(`Payment initiation failed: ${error.message}`);
        res.status(500).json({
            error: 'Payment initiation failed',
            details: error.message
        });
    }
});

app.post('/callback', async (req, res) => {
    try {
        const callbackData = req.body;
        
        if (!callbackData) {
            return res.status(400).json({ error: 'Callback data is required' });
        }
        
        logger.info(`Callback received: ${JSON.stringify(callbackData)}`);
        
        const stkCallback = callbackData.Body?.stkCallback;
        if (!stkCallback) {
            return res.status(400).json({ error: 'Invalid callback format' });
        }
        
        const resultCode = stkCallback.ResultCode;
        const resultDesc = stkCallback.ResultDesc;
        const checkoutRequestId = stkCallback.CheckoutRequestID;
        
        if (!checkoutRequestId) {
            return res.status(400).json({ error: 'CheckoutRequestID is required' });
        }
        
        // Prepare update data
        const updateData = {
            status: resultCode === 0 ? 'SUCCESS' : 'FAILED',
            result_code: resultCode,
            result_desc: resultDesc,
            updated_at: new Date()
        };
        
        // Extract additional data for successful transactions
        if (resultCode === 0) {
            const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
            
            const metadataDict = {};
            callbackMetadata.forEach(item => {
                metadataDict[item.Name] = item.Value;
            });
            
            updateData.amount = metadataDict.Amount;
            updateData.phone = metadataDict.PhoneNumber;
            updateData.transaction_id = metadataDict.MpesaReceiptNumber;
            updateData.transaction_date = metadataDict.TransactionDate;
            updateData.balance = metadataDict.Balance;
        }
        
        // Update transaction in MongoDB
        const result = await transactionsCollection.updateOne(
            { checkout_request_id: checkoutRequestId },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            logger.warning(`Transaction not found: CheckoutRequestID=${checkoutRequestId}`);
            return res.status(404).json({ error: 'Transaction not found' });
        }
        
        logger.info(`Callback processed: CheckoutRequestID=${checkoutRequestId}, Status=${updateData.status}`);
        
        res.json({
            message: 'Callback processed successfully',
            status: updateData.status
        });
        
    } catch (error) {
        logger.error(`Callback processing failed: ${error.message}`);
        res.status(500).json({
            error: 'Callback processing failed',
            details: error.message
        });
    }
});

app.get('/transactions', requireApiToken, async (req, res) => {
    try {
        const { phone, status, limit = 50, skip = 0 } = req.query;
        
        const query = {};
        if (phone) query.phone = phone;
        if (status) query.status = status.toUpperCase();
        
        const limitNum = Math.min(parseInt(limit), 100);
        const skipNum = parseInt(skip);
        
        const transactions = await transactionsCollection.find(query, { _id: 0 })
            .sort({ created_at: -1 })
            .skip(skipNum)
            .limit(limitNum)
            .toArray();
        
        // Convert dates to ISO strings
        transactions.forEach(transaction => {
            if (transaction.created_at) {
                transaction.created_at = transaction.created_at.toISOString();
            }
            if (transaction.updated_at) {
                transaction.updated_at = transaction.updated_at.toISOString();
            }
        });
        
        const total = await transactionsCollection.countDocuments(query);
        
        res.json({
            transactions,
            count: transactions.length,
            total
        });
        
    } catch (error) {
        logger.error(`Error fetching transactions: ${error.message}`);
        res.status(500).json({
            error: 'Failed to fetch transactions',
            details: error.message
        });
    }
});

// Start server
async function startServer() {
    try {
        // Validate configuration
        config.validateConfig();
        logger.info('Configuration validated successfully');
        
        // Connect to MongoDB
        await connectToMongoDB();
        
        // Start server
        app.listen(config.PORT, config.HOST, () => {
            logger.info(`Server running on ${config.HOST}:${config.PORT}`);
            logger.info(`Environment: ${config.NODE_ENV}`);
            logger.info(`API URL: ${config.API_URL}`);
        });
        
    } catch (error) {
        logger.error(`Server startup failed: ${error.message}`);
        process.exit(1);
    }
}

// Start the server
startServer(); 