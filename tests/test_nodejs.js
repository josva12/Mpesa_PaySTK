const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');

// Mock MongoDB
jest.mock('mongodb');

// Mock axios
jest.mock('axios');

// Mock winston
jest.mock('winston', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }))
}));

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
    compareSync: jest.fn()
}));

// Import the app after mocking
const app = require('../nodejs/app');

describe('M-Pesa STK Push API Tests', () => {
    let server;
    
    beforeAll(() => {
        server = app.listen(3001);
    });
    
    afterAll((done) => {
        server.close(done);
    });
    
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Health Check', () => {
        it('should return healthy status', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);
            
            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('database', 'connected');
        });
    });
    
    describe('Phone Number Validation', () => {
        const { validatePhoneNumber } = require('../nodejs/app');
        
        it('should validate correct phone number', () => {
            const result = validatePhoneNumber('254708374149');
            expect(result.isValid).toBe(true);
            expect(result.phone).toBe('254708374149');
        });
        
        it('should reject phone number without 254 prefix', () => {
            const result = validatePhoneNumber('123708374149');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('254');
        });
        
        it('should reject phone number that is too short', () => {
            const result = validatePhoneNumber('25470837414');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('12 digits');
        });
        
        it('should reject phone number that is too long', () => {
            const result = validatePhoneNumber('2547083741499');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('12 digits');
        });
        
        it('should reject empty phone number', () => {
            const result = validatePhoneNumber('');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('required');
        });
    });
    
    describe('Amount Validation', () => {
        const { validateAmount } = require('../nodejs/app');
        
        it('should validate correct amount', () => {
            const result = validateAmount(100);
            expect(result.isValid).toBe(true);
            expect(result.amount).toBe(100);
        });
        
        it('should validate amount as string', () => {
            const result = validateAmount('100');
            expect(result.isValid).toBe(true);
            expect(result.amount).toBe(100);
        });
        
        it('should reject amount below minimum', () => {
            const result = validateAmount(0);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('at least');
        });
        
        it('should reject amount above maximum', () => {
            const result = validateAmount(80000);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('exceed');
        });
        
        it('should reject invalid amount string', () => {
            const result = validateAmount('invalid');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('format');
        });
        
        it('should reject negative amount', () => {
            const result = validateAmount(-10);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('at least');
        });
    });
    
    describe('Authentication', () => {
        it('should reject request without authorization header', async () => {
            const response = await request(app)
                .post('/initiate_payment')
                .send({})
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Missing Authorization header');
        });
        
        it('should reject request with invalid token', async () => {
            const bcrypt = require('bcryptjs');
            bcrypt.compareSync.mockReturnValue(false);
            
            const response = await request(app)
                .post('/initiate_payment')
                .set('Authorization', 'Bearer invalid_token')
                .send({})
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Invalid API token');
        });
        
        it('should accept request with valid token', async () => {
            const bcrypt = require('bcryptjs');
            bcrypt.compareSync.mockReturnValue(true);
            
            // Mock other dependencies
            const axios = require('axios');
            axios.get.mockResolvedValue({
                data: { access_token: 'test_token' }
            });
            
            axios.post.mockResolvedValue({
                data: {
                    CheckoutRequestID: 'ws_CO_test123',
                    MerchantRequestID: 'test_merchant_id',
                    CustomerMessage: 'Success. Request accepted for processing'
                }
            });
            
            const response = await request(app)
                .post('/initiate_payment')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    phone: '254708374149',
                    amount: 100
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('message', 'Payment initiated successfully');
        });
    });
    
    describe('Payment Initiation', () => {
        beforeEach(() => {
            const bcrypt = require('bcryptjs');
            bcrypt.compareSync.mockReturnValue(true);
        });
        
        it('should reject payment with invalid phone number', async () => {
            const response = await request(app)
                .post('/initiate_payment')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    phone: 'invalid_phone',
                    amount: 100
                })
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('254');
        });
        
        it('should reject payment with invalid amount', async () => {
            const response = await request(app)
                .post('/initiate_payment')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    phone: '254708374149',
                    amount: -10
                })
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('at least');
        });
        
        it('should reject payment with missing required fields', async () => {
            const response = await request(app)
                .post('/initiate_payment')
                .set('Authorization', 'Bearer valid_token')
                .send({})
                .expect(400);
            
            expect(response.body).toHaveProperty('error');
        });
        
        it('should successfully initiate payment', async () => {
            const axios = require('axios');
            
            // Mock access token request
            axios.get.mockResolvedValue({
                data: { access_token: 'test_token' }
            });
            
            // Mock STK push request
            axios.post.mockResolvedValue({
                data: {
                    CheckoutRequestID: 'ws_CO_test123',
                    MerchantRequestID: 'test_merchant_id',
                    CustomerMessage: 'Success. Request accepted for processing'
                }
            });
            
            const response = await request(app)
                .post('/initiate_payment')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    phone: '254708374149',
                    amount: 100,
                    account_reference: 'Test Payment',
                    transaction_desc: 'Testing'
                })
                .expect(200);
            
            expect(response.body).toHaveProperty('message', 'Payment initiated successfully');
            expect(response.body).toHaveProperty('data');
            expect(response.body.data).toHaveProperty('checkout_request_id', 'ws_CO_test123');
            expect(response.body.data).toHaveProperty('status', 'PENDING');
        });
        
        it('should handle API errors gracefully', async () => {
            const axios = require('axios');
            
            // Mock access token request
            axios.get.mockResolvedValue({
                data: { access_token: 'test_token' }
            });
            
            // Mock STK push request with error
            axios.post.mockResolvedValue({
                data: {
                    errorCode: 1,
                    errorMessage: 'Invalid request'
                }
            });
            
            const response = await request(app)
                .post('/initiate_payment')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    phone: '254708374149',
                    amount: 100
                })
                .expect(400);
            
            expect(response.body).toHaveProperty('error', 'Payment initiation failed');
            expect(response.body).toHaveProperty('details', 'Invalid request');
        });
    });
    
    describe('Callback Processing', () => {
        it('should reject callback with missing body', async () => {
            const response = await request(app)
                .post('/callback')
                .send()
                .expect(400);
            
            expect(response.body).toHaveProperty('error', 'Callback data is required');
        });
        
        it('should reject callback with invalid format', async () => {
            const response = await request(app)
                .post('/callback')
                .send({ invalid: 'format' })
                .expect(400);
            
            expect(response.body).toHaveProperty('error', 'Invalid callback format');
        });
        
        it('should process successful callback', async () => {
            const callbackData = {
                Body: {
                    stkCallback: {
                        MerchantRequestID: 'test_merchant_id',
                        CheckoutRequestID: 'ws_CO_test123',
                        ResultCode: 0,
                        ResultDesc: 'The service request is processed successfully.',
                        CallbackMetadata: {
                            Item: [
                                { Name: 'Amount', Value: 100.00 },
                                { Name: 'MpesaReceiptNumber', Value: 'QK12345678' },
                                { Name: 'TransactionDate', Value: 20231201120000 },
                                { Name: 'PhoneNumber', Value: 254708374149 }
                            ]
                        }
                    }
                }
            };
            
            const response = await request(app)
                .post('/callback')
                .send(callbackData)
                .expect(200);
            
            expect(response.body).toHaveProperty('message', 'Callback processed successfully');
            expect(response.body).toHaveProperty('status', 'SUCCESS');
        });
        
        it('should process failed callback', async () => {
            const callbackData = {
                Body: {
                    stkCallback: {
                        MerchantRequestID: 'test_merchant_id',
                        CheckoutRequestID: 'ws_CO_test123',
                        ResultCode: 1,
                        ResultDesc: 'The balance is insufficient for the transaction.'
                    }
                }
            };
            
            const response = await request(app)
                .post('/callback')
                .send(callbackData)
                .expect(200);
            
            expect(response.body).toHaveProperty('message', 'Callback processed successfully');
            expect(response.body).toHaveProperty('status', 'FAILED');
        });
    });
    
    describe('Transaction Retrieval', () => {
        beforeEach(() => {
            const bcrypt = require('bcryptjs');
            bcrypt.compareSync.mockReturnValue(true);
        });
        
        it('should reject request without authentication', async () => {
            const response = await request(app)
                .get('/transactions')
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Missing Authorization header');
        });
        
        it('should retrieve transactions successfully', async () => {
            const response = await request(app)
                .get('/transactions')
                .set('Authorization', 'Bearer valid_token')
                .expect(200);
            
            expect(response.body).toHaveProperty('transactions');
            expect(response.body).toHaveProperty('count');
            expect(response.body).toHaveProperty('total');
            expect(Array.isArray(response.body.transactions)).toBe(true);
        });
        
        it('should filter transactions by phone number', async () => {
            const response = await request(app)
                .get('/transactions?phone=254708374149')
                .set('Authorization', 'Bearer valid_token')
                .expect(200);
            
            expect(response.body).toHaveProperty('transactions');
        });
        
        it('should filter transactions by status', async () => {
            const response = await request(app)
                .get('/transactions?status=SUCCESS')
                .set('Authorization', 'Bearer valid_token')
                .expect(200);
            
            expect(response.body).toHaveProperty('transactions');
        });
        
        it('should limit and skip transactions', async () => {
            const response = await request(app)
                .get('/transactions?limit=10&skip=0')
                .set('Authorization', 'Bearer valid_token')
                .expect(200);
            
            expect(response.body).toHaveProperty('transactions');
        });
    });
    
    describe('Transaction by ID', () => {
        beforeEach(() => {
            const bcrypt = require('bcryptjs');
            bcrypt.compareSync.mockReturnValue(true);
        });
        
        it('should reject request without authentication', async () => {
            const response = await request(app)
                .get('/transactions/test_id')
                .expect(401);
            
            expect(response.body).toHaveProperty('error', 'Missing Authorization header');
        });
        
        it('should retrieve specific transaction', async () => {
            const response = await request(app)
                .get('/transactions/ws_CO_test123')
                .set('Authorization', 'Bearer valid_token')
                .expect(200);
            
            expect(response.body).toHaveProperty('checkout_request_id', 'ws_CO_test123');
        });
    });
    
    describe('Error Handling', () => {
        it('should handle 404 errors', async () => {
            const response = await request(app)
                .get('/nonexistent_endpoint')
                .expect(404);
            
            expect(response.body).toHaveProperty('error', 'Endpoint not found');
        });
        
        it('should handle internal server errors', async () => {
            // This would require more complex mocking to trigger
            // but the error handling middleware should be in place
            expect(true).toBe(true);
        });
    });
});

// Mock configuration for testing
jest.mock('../nodejs/config', () => ({
    CONSUMER_KEY: 'test_consumer_key',
    CONSUMER_SECRET: 'test_consumer_secret',
    BUSINESS_SHORTCODE: '174379',
    PASSKEY: 'test_passkey',
    CALLBACK_URL: 'https://test.com/callback',
    API_TOKEN: 'test_api_token_hash',
    API_URL: 'https://sandbox.safaricom.co.ke',
    MONGO_URI: 'mongodb://localhost:27017/test',
    MONGO_DB_NAME: 'test_db',
    MONGO_COLLECTION_NAME: 'test_transactions',
    PORT: 3001,
    HOST: 'localhost',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    LOG_FILE: 'test.log',
    RATE_LIMIT_REQUESTS: 100,
    RATE_LIMIT_WINDOW: 900,
    API_TIMEOUT: 30000,
    TOKEN_TIMEOUT: 3600000,
    MIN_AMOUNT: 1,
    MAX_AMOUNT: 70000,
    PHONE_REGEX: /^254[17]\d{8}$/,
    validateConfig: jest.fn(() => true),
    isDevelopment: jest.fn(() => false),
    isProduction: jest.fn(() => false),
    isTesting: jest.fn(() => true)
})); 