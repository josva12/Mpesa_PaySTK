# M-Pesa STK Push API Documentation

This document provides comprehensive documentation for the M-Pesa STK Push payment integration API.

## Base URL

- **Development**: `http://localhost:5000` (Python) / `http://localhost:3000` (Node.js)
- **Production**: `https://your-domain.com`

## Authentication

All API endpoints (except `/health` and `/callback`) require authentication using a Bearer token.

### Headers
```
Authorization: Bearer your_api_token
Content-Type: application/json
```

### Generating API Token

#### Python
```python
from werkzeug.security import generate_password_hash
print(generate_password_hash('your_secret_token'))
```

#### Node.js
```javascript
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('your_secret_token', 10));
```

## Endpoints

### 1. Health Check

**GET** `/health`

Check the health status of the application and database connection.

#### Response
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T12:00:00.000Z",
  "database": "connected"
}
```

#### Example
```bash
curl -X GET http://localhost:5000/health
```

### 2. Initiate Payment

**POST** `/initiate_payment`

Initiate an M-Pesa STK Push payment request.

#### Headers
```
Authorization: Bearer your_api_token
Content-Type: application/json
```

#### Request Body
```json
{
  "phone": "254708374149",
  "amount": 100,
  "account_reference": "Order123",
  "transaction_desc": "Payment for goods/services"
}
```

#### Parameters

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| `phone` | string | Yes | Phone number in 254XXXXXXXXX format | Must start with 254, 12 digits, valid Safaricom number |
| `amount` | number | Yes | Payment amount in KES | Between 1 and 70,000 KES |
| `account_reference` | string | No | Reference for the payment | Default: "Payment" |
| `transaction_desc` | string | No | Description of the transaction | Default: "Payment for goods/services" |

#### Response (Success - 200)
```json
{
  "message": "Payment initiated successfully",
  "data": {
    "checkout_request_id": "ws_CO_123456789012345678901234567890",
    "merchant_request_id": "12345-12345678-1",
    "customer_message": "Success. Request accepted for processing",
    "status": "PENDING"
  }
}
```

#### Response (Error - 400)
```json
{
  "error": "Validation failed",
  "details": [
    {
      "type": "field",
      "value": "123",
      "msg": "Phone number must start with 254",
      "path": "phone",
      "location": "body"
    }
  ]
}
```

#### Example
```bash
curl -X POST http://localhost:5000/initiate_payment \
  -H "Authorization: Bearer your_api_token" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254708374149",
    "amount": 100,
    "account_reference": "Order123",
    "transaction_desc": "Payment for goods"
  }'
```

### 3. Callback (M-Pesa)

**POST** `/callback`

This endpoint is called by M-Pesa to provide payment status updates. It's handled automatically and doesn't require authentication.

#### Request Body (Success)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "12345-12345678-1",
      "CheckoutRequestID": "ws_CO_123456789012345678901234567890",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 100.00
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "QK12345678"
          },
          {
            "Name": "TransactionDate",
            "Value": 20231201120000
          },
          {
            "Name": "PhoneNumber",
            "Value": 254708374149
          }
        ]
      }
    }
  }
}
```

#### Request Body (Failure)
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "12345-12345678-1",
      "CheckoutRequestID": "ws_CO_123456789012345678901234567890",
      "ResultCode": 1,
      "ResultDesc": "The balance is insufficient for the transaction."
    }
  }
}
```

#### Response
```json
{
  "message": "Callback processed successfully",
  "status": "SUCCESS"
}
```

### 4. Get Transactions

**GET** `/transactions`

Retrieve transaction history with optional filtering.

#### Headers
```
Authorization: Bearer your_api_token
```

#### Query Parameters

| Parameter | Type | Required | Description | Default |
|-----------|------|----------|-------------|---------|
| `phone` | string | No | Filter by phone number | All |
| `status` | string | No | Filter by status (PENDING, SUCCESS, FAILED) | All |
| `limit` | number | No | Number of records to return | 50 |
| `skip` | number | No | Number of records to skip | 0 |

#### Response
```json
{
  "transactions": [
    {
      "phone": "254708374149",
      "amount": 100,
      "status": "SUCCESS",
      "account_reference": "Order123",
      "transaction_desc": "Payment for goods",
      "created_at": "2023-12-01T12:00:00.000Z",
      "updated_at": "2023-12-01T12:00:30.000Z",
      "checkout_request_id": "ws_CO_123456789012345678901234567890",
      "merchant_request_id": "12345-12345678-1",
      "transaction_id": "QK12345678",
      "transaction_date": "20231201120000",
      "result_code": 0,
      "result_desc": "The service request is processed successfully.",
      "customer_message": "Success. Your payment has been received."
    }
  ],
  "count": 1,
  "total": 1
}
```

#### Example
```bash
curl -X GET "http://localhost:5000/transactions?phone=254708374149&status=SUCCESS&limit=10" \
  -H "Authorization: Bearer your_api_token"
```

### 5. Get Transaction by ID

**GET** `/transactions/{checkout_request_id}`

Retrieve a specific transaction by its checkout request ID.

#### Headers
```
Authorization: Bearer your_api_token
```

#### Response
```json
{
  "phone": "254708374149",
  "amount": 100,
  "status": "SUCCESS",
  "account_reference": "Order123",
  "transaction_desc": "Payment for goods",
  "created_at": "2023-12-01T12:00:00.000Z",
  "updated_at": "2023-12-01T12:00:30.000Z",
  "checkout_request_id": "ws_CO_123456789012345678901234567890",
  "merchant_request_id": "12345-12345678-1",
  "transaction_id": "QK12345678",
  "transaction_date": "20231201120000",
  "result_code": 0,
  "result_desc": "The service request is processed successfully.",
  "customer_message": "Success. Your payment has been received."
}
```

#### Example
```bash
curl -X GET "http://localhost:5000/transactions/ws_CO_123456789012345678901234567890" \
  -H "Authorization: Bearer your_api_token"
```

## Error Responses

### Common Error Codes

| Status Code | Description | Example |
|-------------|-------------|---------|
| 400 | Bad Request | Invalid input parameters |
| 401 | Unauthorized | Missing or invalid API token |
| 404 | Not Found | Transaction not found |
| 409 | Conflict | Duplicate transaction |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Response Format
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default**: 100 requests per 15 minutes per IP address
- **Payment Initiation**: 10 requests per minute per IP address

When rate limit is exceeded:
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

## Testing

### Sandbox Testing

For testing purposes, use the following:

- **Test Phone Number**: `254708374149`
- **Test Amounts**: 1-1000 KES
- **Environment**: Sandbox (https://sandbox.safaricom.co.ke)

### Test Scenarios

1. **Successful Payment**
   - Use test phone number
   - Amount between 1-1000 KES
   - Should receive SUCCESS status

2. **Insufficient Balance**
   - Use test phone number
   - Amount > 1000 KES
   - Should receive FAILED status

3. **Invalid Phone Number**
   - Use invalid phone format
   - Should receive 400 error

4. **Invalid Amount**
   - Use amount < 1 or > 70,000
   - Should receive 400 error

### Testing with ngrok

For local testing with M-Pesa callbacks:

```bash
# Install ngrok
npm install -g ngrok

# Start your application
python app.py  # or node app.js

# In another terminal, expose your local server
ngrok http 5000  # or 3000 for Node.js

# Update your CALLBACK_URL in .env with the ngrok URL
CALLBACK_URL=https://your-ngrok-url.ngrok.io/callback
```

## Production Considerations

### Security
- Use HTTPS for all endpoints
- Store API tokens securely
- Implement proper logging
- Use environment variables for sensitive data

### Monitoring
- Monitor transaction success rates
- Set up alerts for failed payments
- Log all API requests and responses
- Monitor database performance

### Scaling
- Use load balancers for high traffic
- Implement caching for frequently accessed data
- Monitor MongoDB performance
- Set up database replication

## Support

For issues related to:
- **M-Pesa API**: Contact Safaricom support (2222 or [email protected])
- **Application**: Check logs in `mpesa_logs.log`
- **Database**: Monitor MongoDB connection and performance 