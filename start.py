#!/usr/bin/env python3
"""
M-Pesa STK Push Integration Startup Script

This script helps you get started with the M-Pesa STK Push integration.
It will guide you through the setup process and start the application.
"""

import os
import sys
import subprocess
import json
from pathlib import Path

def print_banner():
    """Print the application banner"""
    print("=" * 60)
    print("🚀 M-Pesa STK Push Payment Integration")
    print("=" * 60)
    print("A comprehensive M-Pesa Daraja API integration")
    print("for STK Push payments using Python, Node.js, and MongoDB")
    print("=" * 60)

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8 or higher is required")
        print(f"Current version: {sys.version}")
        return False
    print(f"✅ Python version: {sys.version.split()[0]}")
    return True

def check_nodejs():
    """Check if Node.js is installed"""
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ Node.js version: {result.stdout.strip()}")
            return True
    except FileNotFoundError:
        pass
    
    print("❌ Node.js is not installed")
    print("Please install Node.js 14+ from https://nodejs.org/")
    return False

def check_mongodb():
    """Check if MongoDB is running"""
    try:
        result = subprocess.run(['mongosh', '--eval', 'db.runCommand("ping")'], 
                              capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print("✅ MongoDB is running")
            return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    
    print("⚠️  MongoDB connection failed")
    print("Please ensure MongoDB is running or use MongoDB Atlas")
    return False

def check_env_file():
    """Check if environment file exists"""
    env_file = Path('.env')
    if env_file.exists():
        print("✅ Environment file (.env) exists")
        return True
    else:
        print("❌ Environment file (.env) not found")
        return False

def setup_environment():
    """Guide user through environment setup"""
    print("\n📝 Environment Setup")
    print("-" * 30)
    
    if not check_env_file():
        print("\nLet's create your environment file:")
        
        # Copy from example
        example_file = Path('env.example')
        if example_file.exists():
            with open(example_file, 'r') as f:
                content = f.read()
            
            # Update with user's credentials
            print("\nPlease provide your Safaricom Daraja API credentials:")
            
            consumer_key = input("Consumer Key: ").strip()
            consumer_secret = input("Consumer Secret: ").strip()
            business_shortcode = input("Business Shortcode (or press Enter for default): ").strip() or "174379"
            passkey = input("Passkey (or press Enter for default): ").strip() or "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"
            
            # Update content
            content = content.replace('yg8FcU0VXVDSJt154RiHkJDtYbf4nZMfeEoi6ympGaPYZZJ3', consumer_key)
            content = content.replace('UKx0TYSAT7ARAlLGCo1VbLechDtPy9cuMgfKAQV56WhGAVgaq5DVGMSQDJGAUjqU', consumer_secret)
            content = content.replace('174379', business_shortcode)
            content = content.replace('bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919', passkey)
            
            # Generate API token
            api_token = input("Enter a secret API token for authentication: ").strip()
            if api_token:
                try:
                    from werkzeug.security import generate_password_hash
                    hashed_token = generate_password_hash(api_token)
                    content = content.replace('pbkdf2:sha256:600000$your_hashed_token_here', hashed_token)
                except ImportError:
                    print("⚠️  Install Python dependencies first to generate API token")
            
            # Write .env file
            with open('.env', 'w') as f:
                f.write(content)
            
            print("✅ Environment file created successfully!")
        else:
            print("❌ env.example file not found")
            return False
    
    return True

def install_dependencies():
    """Install Python dependencies"""
    print("\n📦 Installing Python Dependencies")
    print("-" * 35)
    
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'python/requirements.txt'], 
                      check=True)
        print("✅ Python dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install Python dependencies: {e}")
        return False

def setup_mongodb():
    """Setup MongoDB database"""
    print("\n🗄️  Setting up MongoDB")
    print("-" * 25)
    
    try:
        subprocess.run(['node', 'database/mongodb_setup.js'], check=True)
        print("✅ MongoDB setup completed!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ MongoDB setup failed: {e}")
        return False

def start_application():
    """Start the application"""
    print("\n🚀 Starting Application")
    print("-" * 25)
    
    print("Choose your implementation:")
    print("1. Python (Flask)")
    print("2. Node.js (Express)")
    print("3. Both (in separate terminals)")
    
    choice = input("\nEnter your choice (1-3): ").strip()
    
    if choice == '1':
        print("\nStarting Python application...")
        print("Server will be available at: http://localhost:5000")
        print("Press Ctrl+C to stop")
        subprocess.run([sys.executable, 'python/app.py'])
    
    elif choice == '2':
        print("\nStarting Node.js application...")
        print("Server will be available at: http://localhost:3000")
        print("Press Ctrl+C to stop")
        subprocess.run(['node', 'nodejs/app.js'])
    
    elif choice == '3':
        print("\nStarting both applications...")
        print("Python: http://localhost:5000")
        print("Node.js: http://localhost:3000")
        print("Press Ctrl+C to stop")
        
        # Start both in background
        python_process = subprocess.Popen([sys.executable, 'python/app.py'])
        nodejs_process = subprocess.Popen(['node', 'nodejs/app.js'])
        
        try:
            python_process.wait()
        except KeyboardInterrupt:
            print("\nStopping applications...")
            python_process.terminate()
            nodejs_process.terminate()
    
    else:
        print("Invalid choice. Please run the script again.")

def show_testing_info():
    """Show testing information"""
    print("\n🧪 Testing Information")
    print("-" * 25)
    print("Test Phone Number: 254708374149")
    print("Test Amounts: 1-1000 KES")
    print("Environment: Sandbox")
    print("\nFor local testing with callbacks:")
    print("1. Install ngrok: npm install -g ngrok")
    print("2. Start your application")
    print("3. Run: ngrok http 5000 (or 3000 for Node.js)")
    print("4. Update CALLBACK_URL in .env with ngrok URL")

def main():
    """Main function"""
    print_banner()
    
    # Check prerequisites
    print("\n🔍 Checking Prerequisites")
    print("-" * 25)
    
    checks_passed = True
    checks_passed &= check_python_version()
    checks_passed &= check_nodejs()
    checks_passed &= check_mongodb()
    
    if not checks_passed:
        print("\n❌ Some prerequisites are not met. Please fix them and try again.")
        return
    
    # Setup environment
    if not setup_environment():
        print("\n❌ Environment setup failed.")
        return
    
    # Install dependencies
    if not install_dependencies():
        print("\n❌ Dependency installation failed.")
        return
    
    # Setup MongoDB
    if not setup_mongodb():
        print("\n⚠️  MongoDB setup failed. You can still proceed but some features may not work.")
    
    # Show testing info
    show_testing_info()
    
    # Start application
    start_application()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ An error occurred: {e}")
        sys.exit(1) 