#!/usr/bin/env python3
"""
Send all email templates to specified recipients for preview.

This script sends one of each email template so you can see how they look.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.services.email_service import SESEmailService, EmailServiceError

def send_all_templates(recipients: list[str]):
    """Send all email templates to the specified recipients."""
    
    email_service = SESEmailService()
    email_service._initialize()
    
    print("=" * 80)
    print("SENDING ALL EMAIL TEMPLATES")
    print("=" * 80)
    print(f"Recipients: {', '.join(recipients)}")
    print()
    
    results = []
    
    for recipient in recipients:
        print(f"\n📧 Sending to: {recipient}")
        print("-" * 80)
        
        # 1. OTP Email
        print("1. OTP Email (Signup)...")
        try:
            result = email_service.send_template_email(
                to_email=recipient,
                subject="Your Champion Circuit Signup Code",
                template_name="otp.html",
                context={
                    "otp": "123456",
                    "purpose": "signup",
                    "expiry_minutes": 10,
                },
            )
            print(f"   ✓ Sent (Message ID: {result['message_id'][:40]}...)")
            results.append(("OTP Email", recipient, True))
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results.append(("OTP Email", recipient, False))
        
        # 2. Welcome Email
        print("2. Welcome Email...")
        try:
            result = email_service.send_template_email(
                to_email=recipient,
                subject="Welcome to Champion Circuit! 🏆",
                template_name="welcome.html",
                context={
                    "display_name": "Champion Player",
                    "username": "championplayer",
                },
            )
            print(f"   ✓ Sent (Message ID: {result['message_id'][:40]}...)")
            results.append(("Welcome Email", recipient, True))
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results.append(("Welcome Email", recipient, False))
        
        # 3. Early Access Voucher
        print("3. Early Access Voucher Email...")
        try:
            result = email_service.send_template_email(
                to_email=recipient,
                subject="Your Champion Circuit Early-Access Voucher",
                template_name="voucher_early_access.html",
                context={
                    "code": "EARLY2026",
                    "benefit": "₹500 off your first tournament registration",
                },
            )
            print(f"   ✓ Sent (Message ID: {result['message_id'][:40]}...)")
            results.append(("Early Access Voucher", recipient, True))
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results.append(("Early Access Voucher", recipient, False))
        
        # 4. Voucher Delivery (Multiple)
        print("4. Voucher Delivery Email (Multiple Vouchers)...")
        try:
            result = email_service.send_template_email(
                to_email=recipient,
                subject="Your Champion Circuit Vouchers",
                template_name="voucher_delivery.html",
                context={
                    "buyer_name": "Test User",
                    "vouchers": [
                        {
                            "code": "TURF50",
                            "title": "Turf Booking Discount",
                            "value_label": "₹50 off",
                        },
                        {
                            "code": "FOOD100",
                            "title": "Food & Beverage Voucher",
                            "value_label": "₹100 off",
                        },
                    ],
                    "partner_name": "Champion Circuit Arena",
                },
            )
            print(f"   ✓ Sent (Message ID: {result['message_id'][:40]}...)")
            results.append(("Voucher Delivery", recipient, True))
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results.append(("Voucher Delivery", recipient, False))
        
        # 5. Tournament Registration
        print("5. Tournament Registration Confirmation...")
        try:
            result = email_service.send_template_email(
                to_email=recipient,
                subject="You're registered — BGMI City Championship",
                template_name="tournament_registration.html",
                context={
                    "display_name": "Champion Player",
                    "tournament_name": "BGMI City Championship 2026",
                    "slug": "bgmi-city-championship-2026",
                    "when": "Saturday, Feb 15, 2026 at 10:00 AM IST",
                    "venue_name": "Champion Circuit Sports Arena, Mumbai",
                },
            )
            print(f"   ✓ Sent (Message ID: {result['message_id'][:40]}...)")
            results.append(("Tournament Registration", recipient, True))
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results.append(("Tournament Registration", recipient, False))
        
        # 6. Bracket Published
        print("6. Bracket Published Notification...")
        try:
            result = email_service.send_template_email(
                to_email=recipient,
                subject="The bracket is live — BGMI City Championship",
                template_name="tournament_bracket_published.html",
                context={
                    "display_name": "Champion Player",
                    "tournament_name": "BGMI City Championship 2026",
                    "slug": "bgmi-city-championship-2026",
                },
            )
            print(f"   ✓ Sent (Message ID: {result['message_id'][:40]}...)")
            results.append(("Bracket Published", recipient, True))
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results.append(("Bracket Published", recipient, False))
        
        # 7. Fixture Notification
        print("7. Match Fixture Notification...")
        try:
            result = email_service.send_template_email(
                to_email=recipient,
                subject="Your Quarter Final is set — BGMI City Championship",
                template_name="tournament_fixture.html",
                context={
                    "display_name": "Champion Player",
                    "tournament_name": "BGMI City Championship 2026",
                    "slug": "bgmi-city-championship-2026",
                    "round_label": "Quarter Final",
                    "opponent": "Team Phoenix",
                    "when": "Saturday, Feb 15, 2026 at 2:30 PM IST",
                    "venue_name": "Champion Circuit Sports Arena, Court 2",
                },
            )
            print(f"   ✓ Sent (Message ID: {result['message_id'][:40]}...)")
            results.append(("Match Fixture", recipient, True))
        except Exception as e:
            print(f"   ✗ Failed: {e}")
            results.append(("Match Fixture", recipient, False))
    
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    total = len(results)
    passed = sum(1 for _, _, success in results if success)
    
    print(f"\nTotal emails sent: {passed}/{total}")
    print("\nResults by template:")
    
    template_groups = {}
    for template, recipient, success in results:
        if template not in template_groups:
            template_groups[template] = []
        template_groups[template].append((recipient, success))
    
    for template, outcomes in template_groups.items():
        successes = sum(1 for _, s in outcomes if s)
        print(f"  {template}: {successes}/{len(outcomes)} sent")
    
    print("\n" + "=" * 80)
    print("🎉 All template emails sent!")
    print("\nCheck your inboxes:")
    for recipient in recipients:
        print(f"  - {recipient}")
    print("\nYou should have received 7 emails from each template.")
    print("=" * 80)


if __name__ == "__main__":
    recipients = [
        "Jainnikhil880@gmail.com",
        "paperwithcode@gmail.com",
    ]
    
    try:
        send_all_templates(recipients)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
