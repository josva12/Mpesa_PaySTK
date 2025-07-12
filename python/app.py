import base64
import re
import logging
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify
from werkzeug.security import check_password_hash
import requests
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.Config.LOG_LEVEL),
    format='%(asctime)s %(levelname)s: %(message)s',
    handlers=[
        logging.FileHandler(config.Config.LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(config.Config)

# MongoDB setup
try:
    client = MongoClient(config.Config.MONGO_URI)
    db = client[config.Config.MONGO_DB_NAME]
    transactions_collection = db[config.Config.MONGO_COLLECTION_NAME]
    
    # Create indexes
    transactions_collection.create_index([("phone", 1), ("amount", 1)])
    transactions_collection.create_index([("transaction_id", 1)], unique=True)
    transactions_collection.create_index([("checkout_request_id", 1)], unique=True)
    
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    raise

def require_api_token(f):
    """Decorator for API authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        try:
            token = auth_header.replace('Bearer ', '')
            if not check_password_hash(config.Config.API_TOKEN, token):
                return jsonify({'error': 'Invalid API token'}), 401
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return jsonify({'error': 'Authentication failed'}), 401
        
        return f(*args, **kwargs)
    return decorated

def validate_phone_number(phone):
    """Validate phone number format"""
    if not phone:
        return False, "Phone number is required"
    
    phone = re.sub(r'[^\d]', '', phone)
    
    if not phone.startswith('254'):
        return False, "Phone number must start with 254"
    
    if len(phone) != 12:
        return False, "Phone number must be 12 digits (254XXXXXXXXX)"
    
    if not phone.startswith(('2547', '2541')):
        return False, "Phone number must be a valid Safaricom number"
    
    return True, phone

def validate_amount(amount):
    """Validate payment amount"""
    try:
        amount = float(amount)
        if amount < config.Config.MIN_AMOUNT:
            return False, f"Amount must be at least {config.Config.MIN_AMOUNT} KES"
        if amount > config.Config.MAX_AMOUNT:
            return False, f"Amount cannot exceed {config.Config.MAX_AMOUNT} KES"
        return True, amount
    except (ValueError, TypeError):
        return False, "Invalid amount format"

def get_access_token():
    """Generate OAuth access token from Safaricom"""
    try:
        auth_string = f"{config.Config.CONSUMER_KEY}:{config.Config.CONSUMER_SECRET}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        
        headers = {
            'Authorization': f'Basic {auth_b64}',
            'Content-Type': 'application/json'
        }
        
        url = f"{config.Config.API_URL}/oauth/v1/generate?grant_type=client_credentials"
        
        response = requests.get(url, headers=headers, timeout=config.Config.API_TIMEOUT)
        response.raise_for_status()
        
        token_data = response.json()
        if 'access_token' not in token_data:
            raise Exception("Access token not found in response")
        
        logger.info("Successfully obtained access token")
        return token_data['access_token']
        
    except Exception as e:
        logger.error(f"Error getting access token: {str(e)}")
        raise Exception(f"Failed to get access token: {str(e)}")

def generate_password():
    """Generate password for STK push"""
    try:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password_string = f"{config.Config.BUSINESS_SHORTCODE}{config.Config.PASSKEY}{timestamp}"
        password_bytes = password_string.encode('ascii')
        password_b64 = base64.b64encode(password_bytes).decode('ascii')
        
        return password_b64, timestamp
        
    except Exception as e:
        logger.error(f"Error generating password: {str(e)}")
        raise Exception(f"Failed to generate password: {str(e)}")

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        db.command('ping')
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'database': 'connected'
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'timestamp': datetime.utcnow().isoformat(),
            'error': str(e)
        }), 500

@app.route('/initiate_payment', methods=['POST'])
@require_api_token
def initiate_stk_push():
    """Initiate STK Push payment"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        phone = data.get('phone')
        amount = data.get('amount')
        account_reference = data.get('account_reference', 'Payment')
        transaction_desc = data.get('transaction_desc', 'Payment for goods/services')
        
        # Validate phone number
        is_valid_phone, phone_result = validate_phone_number(phone)
        if not is_valid_phone:
            return jsonify({'error': phone_result}), 400
        
        # Validate amount
        is_valid_amount, amount_result = validate_amount(amount)
        if not is_valid_amount:
            return jsonify({'error': amount_result}), 400
        
        # Get access token
        access_token = get_access_token()
        
        # Generate password
        password, timestamp = generate_password()
        
        # Prepare STK push payload
        payload = {
            "BusinessShortCode": config.Config.BUSINESS_SHORTCODE,
            "Password": password,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": int(amount_result),
            "PartyA": phone_result,
            "PartyB": config.Config.BUSINESS_SHORTCODE,
            "PhoneNumber": phone_result,
            "CallBackURL": config.Config.CALLBACK_URL,
            "AccountReference": account_reference,
            "TransactionDesc": transaction_desc
        }
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Make STK push request
        response = requests.post(
            f"{config.Config.API_URL}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers=headers,
            timeout=config.Config.API_TIMEOUT
        )
        response.raise_for_status()
        
        response_data = response.json()
        
        # Check for API errors
        if 'errorCode' in response_data:
            logger.error(f"STK push API error: {response_data}")
            return jsonify({
                'error': 'Payment initiation failed',
                'details': response_data.get('errorMessage', 'Unknown error')
            }), 400
        
        # Store initial transaction in MongoDB
        transaction = {
            "phone": phone_result,
            "amount": amount_result,
            "status": "PENDING",
            "account_reference": account_reference,
            "transaction_desc": transaction_desc,
            "created_at": datetime.utcnow(),
            "checkout_request_id": response_data.get('CheckoutRequestID'),
            "merchant_request_id": response_data.get('MerchantRequestID'),
            "customer_message": response_data.get('CustomerMessage', ''),
            "request_id": response_data.get('RequestID', '')
        }
        
        try:
            transactions_collection.insert_one(transaction)
            logger.info(f"Payment initiated: Phone={phone_result}, Amount={amount_result}, CheckoutRequestID={transaction['checkout_request_id']}")
        except DuplicateKeyError:
            logger.warning(f"Duplicate transaction attempt: CheckoutRequestID={transaction['checkout_request_id']}")
            return jsonify({'error': 'Duplicate transaction'}), 409
        
        return jsonify({
            'message': 'Payment initiated successfully',
            'data': {
                'checkout_request_id': response_data.get('CheckoutRequestID'),
                'merchant_request_id': response_data.get('MerchantRequestID'),
                'customer_message': response_data.get('CustomerMessage'),
                'status': 'PENDING'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Payment initiation failed: {str(e)}")
        return jsonify({
            'error': 'Payment initiation failed',
            'details': str(e)
        }), 500

@app.route('/callback', methods=['POST'])
def handle_callback():
    """Handle M-Pesa callback"""
    try:
        callback_data = request.get_json()
        if not callback_data:
            return jsonify({'error': 'Callback data is required'}), 400
        
        logger.info(f"Callback received: {callback_data}")
        
        stk_callback = callback_data.get('Body', {}).get('stkCallback', {})
        if not stk_callback:
            return jsonify({'error': 'Invalid callback format'}), 400
        
        result_code = stk_callback.get('ResultCode')
        result_desc = stk_callback.get('ResultDesc')
        checkout_request_id = stk_callback.get('CheckoutRequestID')
        
        if not checkout_request_id:
            return jsonify({'error': 'CheckoutRequestID is required'}), 400
        
        # Prepare update data
        update_data = {
            "status": "SUCCESS" if result_code == 0 else "FAILED",
            "result_code": result_code,
            "result_desc": result_desc,
            "updated_at": datetime.utcnow()
        }
        
        # Extract additional data for successful transactions
        if result_code == 0:
            callback_metadata = stk_callback.get('CallbackMetadata', {}).get('Item', [])
            
            metadata_dict = {}
            for item in callback_metadata:
                metadata_dict[item.get('Name')] = item.get('Value')
            
            update_data.update({
                "amount": metadata_dict.get('Amount'),
                "phone": metadata_dict.get('PhoneNumber'),
                "transaction_id": metadata_dict.get('MpesaReceiptNumber'),
                "transaction_date": metadata_dict.get('TransactionDate'),
                "balance": metadata_dict.get('Balance')
            })
        
        # Update transaction in MongoDB
        result = transactions_collection.update_one(
            {"checkout_request_id": checkout_request_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            logger.warning(f"Transaction not found: CheckoutRequestID={checkout_request_id}")
            return jsonify({'error': 'Transaction not found'}), 404
        
        logger.info(f"Callback processed: CheckoutRequestID={checkout_request_id}, Status={update_data['status']}")
        
        return jsonify({
            'message': 'Callback processed successfully',
            'status': update_data['status']
        }), 200
        
    except Exception as e:
        logger.error(f"Callback processing failed: {str(e)}")
        return jsonify({
            'error': 'Callback processing failed',
            'details': str(e)
        }), 500

@app.route('/transactions', methods=['GET'])
@require_api_token
def get_transactions():
    """Get transaction history"""
    try:
        phone = request.args.get('phone')
        status = request.args.get('status')
        limit = min(int(request.args.get('limit', 50)), 100)
        skip = int(request.args.get('skip', 0))
        
        query = {}
        if phone:
            query['phone'] = phone
        if status:
            query['status'] = status.upper()
        
        transactions = list(transactions_collection.find(
            query,
            {'_id': 0}
        ).sort('created_at', -1).skip(skip).limit(limit))
        
        # Convert datetime objects to ISO strings
        for transaction in transactions:
            if 'created_at' in transaction:
                transaction['created_at'] = transaction['created_at'].isoformat()
            if 'updated_at' in transaction:
                transaction['updated_at'] = transaction['updated_at'].isoformat()
        
        return jsonify({
            'transactions': transactions,
            'count': len(transactions),
            'total': transactions_collection.count_documents(query)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching transactions: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch transactions',
            'details': str(e)
        }), 500

if __name__ == '__main__':
    try:
        config.Config.validate_config()
        logger.info("Configuration validated successfully")
        
        app.run(
            host=config.Config.HOST,
            port=config.Config.PORT,
            debug=config.Config.DEBUG
        )
    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}")
        raise 