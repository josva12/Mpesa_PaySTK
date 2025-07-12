import pytest
import json
import os
from unittest.mock import patch, MagicMock
from datetime import datetime

# Add the python directory to the path
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'python'))

from app import app, validate_phone_number, validate_amount, generate_password, get_access_token

@pytest.fixture
def client():
    """Create a test client for the Flask application"""
    app.config['TESTING'] = True
    app.config['API_TOKEN'] = 'pbkdf2:sha256:600000$test_token_hash'
    
    with app.test_client() as client:
        yield client

@pytest.fixture
def auth_headers():
    """Return authentication headers for testing"""
    return {'Authorization': 'Bearer test_token'}

class TestPhoneValidation:
    """Test phone number validation"""
    
    def test_valid_phone_number(self):
        """Test valid phone number format"""
        is_valid, result = validate_phone_number('254708374149')
        assert is_valid is True
        assert result == '254708374149'
    
    def test_invalid_phone_number_short(self):
        """Test phone number that's too short"""
        is_valid, result = validate_phone_number('25470837414')
        assert is_valid is False
        assert '12 digits' in result
    
    def test_invalid_phone_number_long(self):
        """Test phone number that's too long"""
        is_valid, result = validate_phone_number('2547083741499')
        assert is_valid is False
        assert '12 digits' in result
    
    def test_invalid_phone_number_prefix(self):
        """Test phone number with wrong prefix"""
        is_valid, result = validate_phone_number('123708374149')
        assert is_valid is False
        assert '254' in result
    
    def test_invalid_phone_number_format(self):
        """Test phone number with invalid format"""
        is_valid, result = validate_phone_number('25470837414a')
        assert is_valid is False
        assert '254' in result
    
    def test_empty_phone_number(self):
        """Test empty phone number"""
        is_valid, result = validate_phone_number('')
        assert is_valid is False
        assert 'required' in result

class TestAmountValidation:
    """Test amount validation"""
    
    def test_valid_amount(self):
        """Test valid amount"""
        is_valid, result = validate_amount(100)
        assert is_valid is True
        assert result == 100
    
    def test_valid_amount_string(self):
        """Test valid amount as string"""
        is_valid, result = validate_amount('100')
        assert is_valid is True
        assert result == 100.0
    
    def test_amount_too_small(self):
        """Test amount below minimum"""
        is_valid, result = validate_amount(0)
        assert is_valid is False
        assert 'at least' in result
    
    def test_amount_too_large(self):
        """Test amount above maximum"""
        is_valid, result = validate_amount(80000)
        assert is_valid is False
        assert 'exceed' in result
    
    def test_invalid_amount_string(self):
        """Test invalid amount string"""
        is_valid, result = validate_amount('invalid')
        assert is_valid is False
        assert 'format' in result
    
    def test_negative_amount(self):
        """Test negative amount"""
        is_valid, result = validate_amount(-10)
        assert is_valid is False
        assert 'at least' in result

class TestPasswordGeneration:
    """Test password generation for STK push"""
    
    @patch('app.config.Config.BUSINESS_SHORTCODE', '174379')
    @patch('app.config.Config.PASSKEY', 'test_passkey')
    def test_generate_password(self):
        """Test password generation"""
        password, timestamp = generate_password()
        
        assert isinstance(password, str)
        assert isinstance(timestamp, str)
        assert len(timestamp) == 14
        assert timestamp.isdigit()

class TestAccessToken:
    """Test access token generation"""
    
    @patch('requests.get')
    def test_get_access_token_success(self, mock_get):
        """Test successful access token retrieval"""
        mock_response = MagicMock()
        mock_response.json.return_value = {'access_token': 'test_token'}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        with patch('app.config.Config.CONSUMER_KEY', 'test_key'), \
             patch('app.config.Config.CONSUMER_SECRET', 'test_secret'), \
             patch('app.config.Config.API_URL', 'https://test.api.com'):
            
            token = get_access_token()
            assert token == 'test_token'
    
    @patch('requests.get')
    def test_get_access_token_failure(self, mock_get):
        """Test access token retrieval failure"""
        mock_get.side_effect = Exception('Network error')
        
        with patch('app.config.Config.CONSUMER_KEY', 'test_key'), \
             patch('app.config.Config.CONSUMER_SECRET', 'test_secret'), \
             patch('app.config.Config.API_URL', 'https://test.api.com'):
            
            with pytest.raises(Exception) as exc_info:
                get_access_token()
            assert 'Failed to get access token' in str(exc_info.value)

class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check_success(self, client):
        """Test successful health check"""
        response = client.get('/health')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'healthy'
        assert 'timestamp' in data
        assert data['database'] == 'connected'

class TestInitiatePayment:
    """Test payment initiation endpoint"""
    
    def test_initiate_payment_missing_auth(self, client):
        """Test payment initiation without authentication"""
        response = client.post('/initiate_payment', json={})
        assert response.status_code == 401
    
    def test_initiate_payment_invalid_auth(self, client):
        """Test payment initiation with invalid authentication"""
        headers = {'Authorization': 'Bearer invalid_token'}
        response = client.post('/initiate_payment', json={}, headers=headers)
        assert response.status_code == 401
    
    def test_initiate_payment_missing_body(self, client, auth_headers):
        """Test payment initiation with missing request body"""
        response = client.post('/initiate_payment', headers=auth_headers)
        assert response.status_code == 400
    
    def test_initiate_payment_invalid_phone(self, client, auth_headers):
        """Test payment initiation with invalid phone number"""
        data = {
            'phone': 'invalid_phone',
            'amount': 100
        }
        response = client.post('/initiate_payment', json=data, headers=auth_headers)
        assert response.status_code == 400
        
        response_data = json.loads(response.data)
        assert 'error' in response_data
    
    def test_initiate_payment_invalid_amount(self, client, auth_headers):
        """Test payment initiation with invalid amount"""
        data = {
            'phone': '254708374149',
            'amount': -10
        }
        response = client.post('/initiate_payment', json=data, headers=auth_headers)
        assert response.status_code == 400
        
        response_data = json.loads(response.data)
        assert 'error' in response_data
    
    @patch('app.get_access_token')
    @patch('app.generate_password')
    @patch('requests.post')
    def test_initiate_payment_success(self, mock_post, mock_generate_password, mock_get_token, client, auth_headers):
        """Test successful payment initiation"""
        # Mock dependencies
        mock_get_token.return_value = 'test_access_token'
        mock_generate_password.return_value = ('test_password', '20231201120000')
        
        mock_response = MagicMock()
        mock_response.json.return_value = {
            'CheckoutRequestID': 'ws_CO_test123',
            'MerchantRequestID': 'test_merchant_id',
            'CustomerMessage': 'Success. Request accepted for processing'
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response
        
        # Mock MongoDB insert
        with patch('app.transactions_collection') as mock_collection:
            mock_collection.insert_one.return_value = None
            
            data = {
                'phone': '254708374149',
                'amount': 100,
                'account_reference': 'Test Payment',
                'transaction_desc': 'Testing'
            }
            
            response = client.post('/initiate_payment', json=data, headers=auth_headers)
            assert response.status_code == 200
            
            response_data = json.loads(response.data)
            assert response_data['message'] == 'Payment initiated successfully'
            assert 'data' in response_data
            assert response_data['data']['checkout_request_id'] == 'ws_CO_test123'

class TestCallback:
    """Test callback endpoint"""
    
    def test_callback_missing_body(self, client):
        """Test callback with missing body"""
        response = client.post('/callback')
        assert response.status_code == 400
    
    def test_callback_invalid_format(self, client):
        """Test callback with invalid format"""
        data = {'invalid': 'format'}
        response = client.post('/callback', json=data)
        assert response.status_code == 400
    
    def test_callback_success(self, client):
        """Test successful callback processing"""
        callback_data = {
            'Body': {
                'stkCallback': {
                    'MerchantRequestID': 'test_merchant_id',
                    'CheckoutRequestID': 'ws_CO_test123',
                    'ResultCode': 0,
                    'ResultDesc': 'The service request is processed successfully.',
                    'CallbackMetadata': {
                        'Item': [
                            {'Name': 'Amount', 'Value': 100.00},
                            {'Name': 'MpesaReceiptNumber', 'Value': 'QK12345678'},
                            {'Name': 'TransactionDate', 'Value': 20231201120000},
                            {'Name': 'PhoneNumber', 'Value': 254708374149}
                        ]
                    }
                }
            }
        }
        
        # Mock MongoDB update
        with patch('app.transactions_collection') as mock_collection:
            mock_collection.update_one.return_value = MagicMock(matched_count=1)
            
            response = client.post('/callback', json=callback_data)
            assert response.status_code == 200
            
            response_data = json.loads(response.data)
            assert response_data['message'] == 'Callback processed successfully'
            assert response_data['status'] == 'SUCCESS'
    
    def test_callback_failure(self, client):
        """Test failed callback processing"""
        callback_data = {
            'Body': {
                'stkCallback': {
                    'MerchantRequestID': 'test_merchant_id',
                    'CheckoutRequestID': 'ws_CO_test123',
                    'ResultCode': 1,
                    'ResultDesc': 'The balance is insufficient for the transaction.'
                }
            }
        }
        
        # Mock MongoDB update
        with patch('app.transactions_collection') as mock_collection:
            mock_collection.update_one.return_value = MagicMock(matched_count=1)
            
            response = client.post('/callback', json=callback_data)
            assert response.status_code == 200
            
            response_data = json.loads(response.data)
            assert response_data['message'] == 'Callback processed successfully'
            assert response_data['status'] == 'FAILED'

class TestTransactions:
    """Test transactions endpoint"""
    
    def test_get_transactions_missing_auth(self, client):
        """Test getting transactions without authentication"""
        response = client.get('/transactions')
        assert response.status_code == 401
    
    def test_get_transactions_success(self, client, auth_headers):
        """Test successful transaction retrieval"""
        # Mock MongoDB find
        with patch('app.transactions_collection') as mock_collection:
            mock_collection.find.return_value.sort.return_value.skip.return_value.limit.return_value.toArray.return_value = []
            mock_collection.count_documents.return_value = 0
            
            response = client.get('/transactions', headers=auth_headers)
            assert response.status_code == 200
            
            response_data = json.loads(response.data)
            assert 'transactions' in response_data
            assert 'count' in response_data
            assert 'total' in response_data

if __name__ == '__main__':
    pytest.main([__file__]) 