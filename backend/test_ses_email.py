#!/usr/bin/env python3
"""
Test script for AWS SES email service.

This script sends test emails to verify your SES configuration.
Run this after setting up your AWS credentials and SES sender verification.

Usage:
    python test_ses_email.py your-email@gmail.com

Requirements:
    - AWS credentials set in .env or environment
    - SES sender email (official@championcircuit.com) verified in AWS Console
    - Recipient email verified (if in SES sandbox mode)
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from app.services.email_service import SESEmailService, EmailServiceError
from app.core.config import settings


def print_config_status():
    """Display current SES configuration status."""
    print("=" * 80)
    print("AWS SES CONFIGURATION STATUS")
    print("=" * 80)
    print(f"AWS Region:          {settings.AWS_REGION}")
    print(f"SES From Email:      {settings.SES_FROM_EMAIL}")
    print(f"SES From Name:       {settings.SES_FROM_NAME}")
    print(f"Environment:         {settings.ENVIRONMENT}")
    print(f"SES Configured:      {settings.ses_configured}")
    
    if settings.AWS_ACCESS_KEY_ID:
        print(f"AWS Access Key:      {settings.AWS_ACCESS_KEY_ID[:8]}... (explicit)")
    else:
        print("AWS Access Key:      (using IAM role or credential chain)")
    
    print("=" * 80)
    print()


def test_simple_email(email_service: SESEmailService, recipient: str):
    """Test basic email sending."""
    print("TEST 1: Simple HTML Email")
    print("-" * 80)
    
    try:
        result = email_service.send_email(
            to_email=recipient,
            subject="Test Email from Champion Circuit",
            html_body="""
                <h2>Hello from Champion Circuit! 🏆</h2>
                <p>This is a test email sent via AWS SES.</p>
                <p>If you're seeing this, your SES configuration is working correctly.</p>
                <p><strong>Test Details:</strong></p>
                <ul>
                    <li>Service: AWS SES</li>
                    <li>Region: ap-south-1</li>
                    <li>From: official@championcircuit.com</li>
                </ul>
            """,
            plain_body="Hello from Champion Circuit! This is a test email sent via AWS SES.",
        )
        
        if result["success"]:
            print(f"✓ Email sent successfully!")
            print(f"  Message ID: {result['message_id']}")
            print(f"  Latency: {result['metadata']['latency_ms']}ms")
            print(f"  Request ID: {result['metadata'].get('request_id', 'N/A')}")
        else:
            print("✗ Email sending failed (no exception, but success=False)")
        
        return True
        
    except EmailServiceError as e:
        print(f"✗ Email Service Error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected Error: {e}")
        return False
    finally:
        print()


def test_template_email(email_service: SESEmailService, recipient: str):
    """Test template-based email sending."""
    print("TEST 2: Template Email (OTP)")
    print("-" * 80)
    
    try:
        result = email_service.send_template_email(
            to_email=recipient,
            subject="Your Test OTP Code",
            template_name="otp.html",
            context={
                "otp": "123456",
                "purpose": "testing",
                "expiry_minutes": 10,
            },
        )
        
        if result["success"]:
            print(f"✓ Template email sent successfully!")
            print(f"  Template: otp.html")
            print(f"  Message ID: {result['message_id']}")
            print(f"  Latency: {result['metadata']['latency_ms']}ms")
        else:
            print("✗ Template email sending failed")
        
        return True
        
    except EmailServiceError as e:
        print(f"✗ Email Service Error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected Error: {e}")
        return False
    finally:
        print()


def test_welcome_email(email_service: SESEmailService, recipient: str):
    """Test welcome email template."""
    print("TEST 3: Welcome Email Template")
    print("-" * 80)
    
    try:
        result = email_service.send_template_email(
            to_email=recipient,
            subject="Welcome to Champion Circuit!",
            template_name="welcome.html",
            context={
                "display_name": "Test User",
                "username": "testuser",
            },
        )
        
        if result["success"]:
            print(f"✓ Welcome email sent successfully!")
            print(f"  Message ID: {result['message_id']}")
            print(f"  Latency: {result['metadata']['latency_ms']}ms")
        else:
            print("✗ Welcome email sending failed")
        
        return True
        
    except EmailServiceError as e:
        print(f"✗ Email Service Error: {e}")
        return False
    except Exception as e:
        print(f"✗ Unexpected Error: {e}")
        return False
    finally:
        print()


def main():
    """Main test execution."""
    if len(sys.argv) < 2:
        print("Error: Recipient email address required")
        print()
        print("Usage:")
        print("  python test_ses_email.py your-email@gmail.com")
        print()
        print("Note: If using SES sandbox mode, the recipient email must be verified in AWS Console.")
        sys.exit(1)
    
    recipient = sys.argv[1]
    
    print()
    print_config_status()
    
    # Validate configuration
    if not settings.ses_configured and not settings.is_development:
        print("ERROR: SES is not properly configured!")
        print()
        print("Required environment variables:")
        print("  - AWS_REGION (currently: {})".format(settings.AWS_REGION or "NOT SET"))
        print("  - SES_FROM_EMAIL (currently: {})".format(settings.SES_FROM_EMAIL or "NOT SET"))
        print("  - AWS_ACCESS_KEY_ID (for explicit credentials)")
        print("  - AWS_SECRET_ACCESS_KEY (for explicit credentials)")
        print()
        print("Alternatively, use IAM roles if running on AWS infrastructure.")
        sys.exit(1)
    
    print(f"Sending test emails to: {recipient}")
    print()
    
    # Initialize email service
    try:
        email_service = SESEmailService()
        email_service._initialize()  # Force initialization to catch credential errors early
        print("✓ Email service initialized successfully")
        print()
    except Exception as e:
        print(f"✗ Failed to initialize email service: {e}")
        print()
        print("Common issues:")
        print("  1. AWS credentials not found or invalid")
        print("  2. SES sender email not verified in AWS Console")
        print("  3. IAM permissions missing (ses:SendEmail, ses:SendRawEmail)")
        print("  4. Network/connectivity issues")
        sys.exit(1)
    
    # Run tests
    results = []
    
    results.append(("Simple Email", test_simple_email(email_service, recipient)))
    results.append(("Template Email (OTP)", test_template_email(email_service, recipient)))
    results.append(("Welcome Email", test_welcome_email(email_service, recipient)))
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}  {test_name}")
    
    print()
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 80)
    print()
    
    if passed == total:
        print("🎉 All tests passed! Your SES configuration is working correctly.")
        print()
        print("Next steps:")
        print("  1. Check your inbox for the test emails")
        print("  2. If using SES sandbox, request production access in AWS Console")
        print("  3. Deploy your application with the same configuration")
    else:
        print("⚠️  Some tests failed. Check the errors above.")
        print()
        print("Troubleshooting:")
        print("  - Verify your AWS credentials are correct")
        print("  - Ensure official@championcircuit.com is verified in SES")
        print("  - If in sandbox mode, verify the recipient email too")
        print("  - Check IAM permissions for SES")
        print("  - Review AWS SES sending limits and quotas")
    
    print()
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
