# M-Pesa STK Push Setup Guide

This guide provides step-by-step instructions for setting up the M-Pesa STK Push payment integration.

## Prerequisites

### 1. Safaricom Daraja API Account

1. **Register at Safaricom Developer Portal**
   - Go to [https://developer.safaricom.co.ke](https://developer.safaricom.co.ke)
   - Create an account and verify your email

2. **Create an App**
   - Log in to the Daraja portal
   - Click "Create App"
   - Fill in the required details:
     - App Name: `MpesaSTKPush`
     - App Description: `M-Pesa STK Push Payment Integration`
     - App Type: `Web Application`

3. **Map API Products**
   - In your app dashboard, go to the "APIs" tab
   - **Required**: Select "Lipa na M-Pesa Online" (for STK Push)
   - **Optional**: Select additional APIs based on your needs:
     - C2B (Customer to Business)
     - B2C (Business to Customer)
     - Transaction Status
     - Account Balance

4. **Get Credentials**
   - Note down your:
     - Consumer Key
     - Consumer Secret
     - Business Shortcode (if you have one)
     - Passkey (if you have one)

5. **Request Business Shortcode**
   - If you don't have a business shortcode, contact Safaricom
   - Call 2222 or email [email protected]
   - Provide business documentation as required

### 2. MongoDB Setup

#### Option A: Local MongoDB Installation

1. **Install MongoDB**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install mongodb

   # macOS (using Homebrew)
   brew install mongodb-community

   # Windows
   # Download from https://www.mongodb.com/try/download/community
   ```

2. **Start MongoDB Service**
   ```bash
   # Ubuntu/Debian
   sudo systemctl start mongodb
   sudo systemctl enable mongodb

   # macOS
   brew services start mongodb-community

   # Windows
   # Start MongoDB service from Services
   ```

3. **Verify Installation**
   ```bash
   mongosh --eval "db.runCommand('ping')"
   ```

#### Option B: MongoDB Atlas (Cloud)

1. **Create Atlas Account**
   - Go to [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
   - Sign up for a free account

2. **Create Cluster**
   - Click "Build a Database"
   - Choose "FREE" tier
   - Select cloud provider and region
   - Click "Create"

3. **Set Up Database Access**
   - Go to "Database Access"
   - Click "Add New Database User"
   - Create username and password
   - Select "Read and write to any database"

4. **Set Up Network Access**
   - Go to "Network Access"
   - Click "Add IP Address"
   - Add your IP or use "0.0.0.0/0" for all IPs

5. **Get Connection String**
   - Go to "Database"
   - Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string

### 3. Development Environment

#### Python Setup
```bash
# Install Python 3.8+
python3 --version

# Install pip
sudo apt install python3-pip  # Ubuntu/Debian
# or download from https://pip.pypa.io/en/stable/installation/
```

#### Node.js Setup
```bash
# Install Node.js 14+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

#### ngrok Setup (for local testing)
```bash
# Install ngrok
npm install -g ngrok

# Or download from https://ngrok.com/download
```

## Installation

### 1. Clone and Setup Project

```bash
# Clone the repository
git clone <repository-url>
cd Mpesa_PaySTK

# Copy environment template
cp env.example .env
```

### 2. Configure Environment Variables

Edit the `.env` file with your credentials:

```env
# Safaricom Daraja API Configuration
CONSUMER_KEY=your_consumer_key_here
CONSUMER_SECRET=your_consumer_secret_here
BUSINESS_SHORTCODE=your_shortcode_here
PASSKEY=your_passkey_here

# Callback URL (update with your ngrok URL for testing)
CALLBACK_URL=https://your-ngrok-url.ngrok.io/callback

# API Environment
API_ENVIRONMENT=sandbox

# Security (generate this)
API_TOKEN=your_hashed_api_token_here

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/mpesa_transactions
# For Atlas: mongodb+srv://username:password@cluster.mongodb.net/mpesa_transactions

# Server Configuration
PORT=5000
HOST=0.0.0.0

# Logging
LOG_LEVEL=INFO
LOG_FILE=mpesa_logs.log
```

### 3. Generate API Token

#### Python
```bash
cd python
python3 -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('your_secret_token'))"
```

#### Node.js
```bash
cd nodejs
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your_secret_token', 10));"
```

### 4. Setup MongoDB

```bash
# Install MongoDB dependencies
cd nodejs
npm install

# Run MongoDB setup
node ../database/mongodb_setup.js
```

### 5. Install Dependencies

#### Python
```bash
cd python
pip install -r requirements.txt
```

#### Node.js
```bash
cd nodejs
npm install
```

## Testing Setup

### 1. Start the Application

#### Python
```bash
cd python
python app.py
```

#### Node.js
```bash
cd nodejs
npm start
```

### 2. Expose Local Server with ngrok

```bash
# In a new terminal
ngrok http 5000  # For Python
# or
ngrok http 3000  # For Node.js
```

### 3. Update Callback URL

Copy the ngrok URL and update your `.env` file:
```env
CALLBACK_URL=https://your-ngrok-url.ngrok.io/callback
```

### 4. Test the Integration

#### Health Check
```bash
curl http://localhost:5000/health
```

#### Generate API Token for Testing
```bash
# Python
python3 -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('test_token'))"

# Node.js
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('test_token', 10));"
```

#### Test Payment Initiation
```bash
curl -X POST http://localhost:5000/initiate_payment \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254708374149",
    "amount": 100,
    "account_reference": "Test Payment",
    "transaction_desc": "Testing M-Pesa integration"
  }'
```

## Production Deployment

### 1. Environment Configuration

```env
# Switch to production
API_ENVIRONMENT=production
API_URL=https://api.safaricom.co.ke

# Use production MongoDB
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/mpesa_transactions

# Security
DEBUG=false
LOG_LEVEL=WARNING

# Use HTTPS callback URL
CALLBACK_URL=https://your-domain.com/callback
```

### 2. Server Setup

#### Python (Gunicorn)
```bash
# Install Gunicorn
pip install gunicorn

# Create systemd service
sudo nano /etc/systemd/system/mpesa-python.service
```

Service file content:
```ini
[Unit]
Description=M-Pesa Python API
After=network.target

[Service]
User=your-user
WorkingDirectory=/path/to/Mpesa_PaySTK/python
Environment=PATH=/path/to/venv/bin
ExecStart=/path/to/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable mpesa-python
sudo systemctl start mpesa-python
```

#### Node.js (PM2)
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
nano ecosystem.config.js
```

Ecosystem file content:
```javascript
module.exports = {
  apps: [{
    name: 'mpesa-nodejs',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:5000;  # or 3000 for Node.js
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

### 5. Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow application port (if not using reverse proxy)
sudo ufw allow 5000  # or 3000
```

## Monitoring and Maintenance

### 1. Log Monitoring

```bash
# View application logs
tail -f mpesa_logs.log

# View system logs
sudo journalctl -u mpesa-python -f  # For Python
pm2 logs mpesa-nodejs  # For Node.js
```

### 2. Database Monitoring

```bash
# Check MongoDB status
sudo systemctl status mongodb

# Monitor MongoDB performance
mongosh --eval "db.stats()"
```

### 3. Health Checks

```bash
# Set up automated health checks
curl -f http://localhost:5000/health || echo "Service down"
```

### 4. Backup Strategy

```bash
# MongoDB backup
mongodump --db mpesa_transactions --out /backup/$(date +%Y%m%d)

# Application backup
tar -czf /backup/app-$(date +%Y%m%d).tar.gz /path/to/Mpesa_PaySTK
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check MongoDB service
   sudo systemctl status mongodb
   
   # Check connection string
   mongosh "mongodb://localhost:27017"
   ```

2. **API Authentication Failed**
   - Verify Consumer Key and Secret
   - Check API token format
   - Ensure proper Bearer token format

3. **Callback Not Received**
   - Verify callback URL is public
   - Check ngrok tunnel is active
   - Ensure URL is HTTPS in production

4. **Rate Limiting**
   - Check request frequency
   - Implement proper caching
   - Contact Safaricom for limits increase

### Support Contacts

- **Safaricom Daraja**: 2222 or [email protected]
- **MongoDB Atlas**: [https://support.mongodb.com](https://support.mongodb.com)
- **Application Issues**: Check logs and documentation

## Security Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Store environment variables securely
- [ ] Implement proper API token authentication
- [ ] Enable MongoDB authentication
- [ ] Set up firewall rules
- [ ] Regular security updates
- [ ] Monitor for suspicious activity
- [ ] Backup data regularly
- [ ] Use strong passwords
- [ ] Implement rate limiting

## Performance Optimization

- [ ] Use MongoDB indexes
- [ ] Implement caching
- [ ] Monitor database performance
- [ ] Use load balancers
- [ ] Optimize queries
- [ ] Set up monitoring alerts
- [ ] Regular performance testing 