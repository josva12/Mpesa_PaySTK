const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mpesa_transactions';
const DB_NAME = 'mpesa_transactions';
const COLLECTION_NAME = 'transactions';

async function setupMongoDB() {
    let client;
    
    try {
        console.log('Connecting to MongoDB...');
        client = new MongoClient(MONGO_URI);
        await client.connect();
        
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        console.log('Creating indexes...');
        
        // Create indexes for efficient querying
        await collection.createIndex({ phone: 1, amount: 1 });
        console.log('✓ Index created: phone + amount');
        
        await collection.createIndex({ transaction_id: 1 }, { unique: true });
        console.log('✓ Index created: transaction_id (unique)');
        
        await collection.createIndex({ checkout_request_id: 1 }, { unique: true });
        console.log('✓ Index created: checkout_request_id (unique)');
        
        await collection.createIndex({ created_at: -1 });
        console.log('✓ Index created: created_at (descending)');
        
        await collection.createIndex({ status: 1 });
        console.log('✓ Index created: status');
        
        await collection.createIndex({ updated_at: -1 });
        console.log('✓ Index created: updated_at (descending)');
        
        // Create a compound index for common queries
        await collection.createIndex({ phone: 1, status: 1, created_at: -1 });
        console.log('✓ Index created: phone + status + created_at');
        
        console.log('\nMongoDB setup completed successfully!');
        console.log(`Database: ${DB_NAME}`);
        console.log(`Collection: ${COLLECTION_NAME}`);
        
        // Show collection stats
        const stats = await db.stats();
        console.log(`\nDatabase stats:`);
        console.log(`- Collections: ${stats.collections}`);
        console.log(`- Data size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- Storage size: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);
        
        // Show indexes
        const indexes = await collection.indexes();
        console.log(`\nIndexes on ${COLLECTION_NAME}:`);
        indexes.forEach((index, i) => {
            console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
        });
        
    } catch (error) {
        console.error('Error setting up MongoDB:', error.message);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('\nMongoDB connection closed.');
        }
    }
}

async function createSampleData() {
    let client;
    
    try {
        console.log('\nCreating sample data...');
        client = new MongoClient(MONGO_URI);
        await client.connect();
        
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        // Check if sample data already exists
        const existingCount = await collection.countDocuments();
        if (existingCount > 0) {
            console.log(`Sample data already exists (${existingCount} documents). Skipping...`);
            return;
        }
        
        const sampleTransactions = [
            {
                phone: '254708374149',
                amount: 100,
                status: 'SUCCESS',
                account_reference: 'Test Payment 1',
                transaction_desc: 'Sample payment for testing',
                created_at: new Date(Date.now() - 86400000), // 1 day ago
                updated_at: new Date(Date.now() - 86400000 + 30000), // 30 seconds later
                checkout_request_id: 'ws_CO_123456789012345678901234567890',
                merchant_request_id: '12345-12345678-1',
                transaction_id: 'QK12345678',
                transaction_date: '20231201120000',
                result_code: 0,
                result_desc: 'The service request is processed successfully.',
                customer_message: 'Success. Your payment has been received.',
                request_id: '12345-12345678-1'
            },
            {
                phone: '254708374149',
                amount: 250,
                status: 'PENDING',
                account_reference: 'Test Payment 2',
                transaction_desc: 'Another sample payment',
                created_at: new Date(),
                checkout_request_id: 'ws_CO_123456789012345678901234567891',
                merchant_request_id: '12345-12345678-2',
                customer_message: 'Success. Request accepted for processing',
                request_id: '12345-12345678-2'
            },
            {
                phone: '254708374149',
                amount: 500,
                status: 'FAILED',
                account_reference: 'Test Payment 3',
                transaction_desc: 'Failed payment example',
                created_at: new Date(Date.now() - 3600000), // 1 hour ago
                updated_at: new Date(Date.now() - 3600000 + 30000), // 30 seconds later
                checkout_request_id: 'ws_CO_123456789012345678901234567892',
                merchant_request_id: '12345-12345678-3',
                result_code: 1,
                result_desc: 'The balance is insufficient for the transaction.',
                customer_message: 'Failed. Insufficient balance.',
                request_id: '12345-12345678-3'
            }
        ];
        
        const result = await collection.insertMany(sampleTransactions);
        console.log(`✓ Created ${result.insertedCount} sample transactions`);
        
        // Show sample data
        const allTransactions = await collection.find({}, { _id: 0 }).toArray();
        console.log('\nSample transactions:');
        allTransactions.forEach((transaction, i) => {
            console.log(`${i + 1}. ${transaction.phone} - ${transaction.amount} KES - ${transaction.status}`);
        });
        
    } catch (error) {
        console.error('Error creating sample data:', error.message);
        throw error;
    } finally {
        if (client) {
            await client.close();
        }
    }
}

async function main() {
    try {
        await setupMongoDB();
        await createSampleData();
        console.log('\n✅ MongoDB setup completed successfully!');
    } catch (error) {
        console.error('\n❌ MongoDB setup failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { setupMongoDB, createSampleData }; 