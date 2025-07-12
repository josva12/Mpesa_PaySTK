# M-Pesa STK Push Payment Integration

A comprehensive M-Pesa Daraja API integration for STK Push payments using Python, Node.js, and MongoDB.

## Features

- **STK Push Payment Initiation**: Initiate payments via M-Pesa STK Push
- **Callback Handling**: Process M-Pesa payment callbacks
- **MongoDB Integration**: Store transaction data in MongoDB
- **Dual Implementation**: Both Python (Flask) and Node.js (Express) versions
- **Security**: API token authentication and input validation
- **Logging**: Comprehensive logging for debugging and auditing
- **Error Handling**: Robust error handling and validation

## Project Structure

```
Mpesa_PaySTK/
├── python/
│   ├── app.py                 # Main Flask application
│   ├── requirements.txt       # Python dependencies
│   └── config.py             # Configuration settings
├── nodejs/
│   ├── app.js                # Main Express application
│   ├── package.json          # Node.js dependencies
│   └── config.js             # Configuration settings
├── database/
│   └── mongodb_setup.js      # MongoDB setup and indexes
├── docs/
│   ├── api_documentation.md  # API documentation
│   └── setup_guide.md        # Detailed setup guide
├── tests/
│   ├── test_python.py        # Python tests
│   └── test_nodejs.js        # Node.js tests
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## Prerequisites

### 1. Safaricom Daraja API Setup
- Register at [https://developer.safaricom.co.ke](https://developer.safaricom.co.ke)
- Create an app and obtain:
  - Consumer Key
  - Consumer Secret
  - Business Shortcode
  - Passkey
- Map **Lipa na M-Pesa Online** API to your app
- Set up a public callback URL

### 2. MongoDB Setup
- Install MongoDB locally or use MongoDB Atlas
- Create a database for transactions

### 3. Environment Setup
- Python 3.8+ or Node.js 14+
- ngrok (for local testing)

## Quick Start

### 1. Clone and Setup
```bash
git clone <repository-url>
cd Mpesa_PaySTK
```

### 2. Environment Configuration
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Choose Your Implementation

#### Python (Flask)
```bash
cd python
pip install -r requirements.txt
python app.py
```

#### Node.js (Express)
```bash
cd nodejs
npm install
npm start
```

### 4. Test with ngrok
```bash
ngrok http 5000  # For Python
ngrok http 3000  # For Node.js
```

## API Endpoints

### Initiate Payment
- **URL**: `POST /initiate_payment`
- **Headers**: `Authorization: Bearer <api_token>`
- **Body**:
```json
{
    "phone": "2547XXXXXXXX",
    "amount": 100,
    "account_reference": "Order123",
    "transaction_desc": "Payment for goods"
}
```

### Callback (M-Pesa)
- **URL**: `POST /callback`
- **Handled automatically by M-Pesa**

## Configuration

### Environment Variables
```env
# Safaricom Daraja API
CONSUMER_KEY=your_consumer_key
CONSUMER_SECRET=your_consumer_secret
BUSINESS_SHORTCODE=your_shortcode
PASSKEY=your_passkey
CALLBACK_URL=https://your-callback-url/callback

# Security
API_TOKEN=your_hashed_api_token

# Database
MONGO_URI=mongodb://localhost:27017/mpesa_transactions

# Server
PORT=5000  # Python default
PORT=3000  # Node.js default
```

## Testing

### Sandbox Testing
- Use Safaricom's test phone: `254708374149`
- Test amounts: 1-1000 KES
- Use ngrok for callback testing

### Test Commands
```bash
# Python tests
cd python && python -m pytest tests/

# Node.js tests
cd nodejs && npm test
```

## Production Deployment

### Security Checklist
- [ ] Use HTTPS for all endpoints
- [ ] Store environment variables securely
- [ ] Implement rate limiting
- [ ] Enable MongoDB authentication
- [ ] Set up monitoring and logging
- [ ] Use production Safaricom API URL

### Deployment Options
- **Python**: Gunicorn + Nginx
- **Node.js**: PM2 + Nginx
- **MongoDB**: MongoDB Atlas or self-hosted

## Troubleshooting

### Common Issues
1. **Authentication Errors**: Check Consumer Key/Secret
2. **Callback Issues**: Verify callback URL is public and HTTPS
3. **MongoDB Errors**: Check connection string and network
4. **Timeout Errors**: Increase timeout values

### Support
- Safaricom Support: 2222 or [email protected]
- Check logs in `mpesa_logs.log`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Changelog

### v1.0.0
- Initial release
- STK Push integration
- MongoDB support
- Python and Node.js implementations
- Comprehensive documentation 