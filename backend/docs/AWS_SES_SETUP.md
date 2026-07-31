# AWS SES Email Service Setup Guide

This guide explains how to set up and deploy the AWS SES email service for Champion Circuit.

## Table of Contents

1. [Overview](#overview)
2. [AWS SES Setup](#aws-ses-setup)
3. [IAM Permissions](#iam-permissions)
4. [Local Development](#local-development)
5. [Testing](#testing)
6. [Render Deployment](#render-deployment)
7. [AWS ECS Deployment](#aws-ecs-deployment)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Overview

Champion Circuit now uses **AWS SES (Simple Email Service)** for sending all transactional emails:

- OTP codes (signup, password reset)
- Welcome emails
- Voucher delivery
- Tournament notifications (registration, bracket, fixtures)

**Benefits of SES:**
- Better deliverability (99% inbox rate)
- Higher sending limits (50,000 emails/day in production)
- Lower cost ($0.10 per 1,000 emails)
- Built-in bounce and complaint handling
- No SMTP relay issues

---

## AWS SES Setup

### 1. Create AWS Account

If you don't have an AWS account:
1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Complete the registration

### 2. Verify Your Sender Email

**IMPORTANT:** You must verify `official@championcircuit.com` before sending emails.

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/) (region: `ap-south-1` - Mumbai)
2. Navigate to **Configuration → Verified identities**
3. Click **Create identity**
4. Choose **Email address**
5. Enter: `official@championcircuit.com`
6. Click **Create identity**
7. Check the email inbox and click the verification link

### 3. Request Production Access

By default, SES is in **Sandbox mode** with limitations:
- Can only send to verified emails
- Limited to 200 emails/day
- 1 email/second sending rate

To remove restrictions:
1. In SES Console, go to **Account dashboard**
2. Click **Request production access**
3. Fill out the form:
   - **Mail type:** Transactional
   - **Website URL:** https://championcircuit.com
   - **Use case description:** 
     ```
     Champion Circuit is a sports & esports tournament platform in India.
     We send transactional emails for:
     - User authentication (OTP codes)
     - Account verification
     - Tournament registration confirmations
     - Match notifications
     - Booking confirmations
     
     All emails are opt-in and user-initiated. We have proper unsubscribe
     handling and bounce management.
     ```
   - **Bounce handling:** We monitor bounce rates and remove invalid emails
   - **Compliance:** We comply with CAN-SPAM and local regulations

4. Submit and wait for approval (usually 24-48 hours)

### 4. Verify Recipient Emails (Sandbox Only)

If testing in sandbox mode:
1. Go to **Verified identities**
2. Add your test email addresses (Gmail, etc.)
3. Verify each one via email link

---

## IAM Permissions

### Option A: IAM User with Access Keys (Render, Local Dev)

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Navigate to **Users → Add users**
3. Username: `champion-circuit-ses`
4. Access type: **Programmatic access** (Access key)
5. Attach policy: **AmazonSESFullAccess** (or use custom policy below)
6. Create user and **save the credentials**:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

**Custom Policy (Minimal Permissions):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
        "ses:SendBulkTemplatedEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### Option B: IAM Role (ECS, EC2, Lambda)

For AWS infrastructure, use IAM roles instead of access keys:

1. Create IAM Role: `ChampionCircuitECSTaskRole`
2. Trust relationship: ECS Tasks
3. Attach policy: `AmazonSESFullAccess`
4. Attach role to your ECS task definition

**Advantage:** No credentials to manage, automatic rotation, more secure.

---

## Local Development

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# AWS SES Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
SES_FROM_EMAIL=official@championcircuit.com
SES_FROM_NAME=Champion Circuit

# Application
ENVIRONMENT=local
```

### 3. Run the Application

```bash
# Activate virtual environment
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Start server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Development Mode Behavior

Without AWS credentials, emails are logged to console:

```
[DEV EMAIL] To: user@example.com | Subject: Your OTP Code | HTML length: 1234 chars
```

With credentials, real emails are sent via SES.

---

## Testing

### Quick Test Script

```bash
cd backend
python test_ses_email.py your-email@gmail.com
```

This will:
1. Display your SES configuration
2. Send 3 test emails:
   - Simple HTML email
   - OTP template
   - Welcome template
3. Show success/failure for each

**Expected Output:**
```
================================================================================
AWS SES CONFIGURATION STATUS
================================================================================
AWS Region:          ap-south-1
SES From Email:      official@championcircuit.com
SES From Name:       Champion Circuit
Environment:         local
SES Configured:      True
AWS Access Key:      AKIAIOSF... (explicit)
================================================================================

TEST 1: Simple HTML Email
--------------------------------------------------------------------------------
✓ Email sent successfully!
  Message ID: 01000184ac04f8cd-c1234567-8901-2345-6789-abcdef012345-000000
  Latency: 342ms
  Request ID: abc123...

TEST 2: Template Email (OTP)
--------------------------------------------------------------------------------
✓ Template email sent successfully!
  Template: otp.html
  Message ID: 01000184ac04f8cd-...
  Latency: 289ms

TEST 3: Welcome Email Template
--------------------------------------------------------------------------------
✓ Welcome email sent successfully!
  Message ID: 01000184ac04f8cd-...
  Latency: 301ms

================================================================================
TEST SUMMARY
================================================================================
✓ PASS  Simple Email
✓ PASS  Template Email (OTP)
✓ PASS  Welcome Email

Results: 3/3 tests passed
================================================================================

🎉 All tests passed! Your SES configuration is working correctly.
```

### Manual API Testing

**Send OTP Email:**
```bash
curl -X POST http://localhost:8000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "purpose": "signup"}'
```

**Check Logs:**
```bash
tail -f logs/app.log | grep EMAIL
```

---

## Render Deployment

### 1. Set Environment Variables

In Render Dashboard:
1. Go to your service → **Environment**
2. Add the following:

```
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
SES_FROM_EMAIL=official@championcircuit.com
SES_FROM_NAME=Champion Circuit
ENVIRONMENT=production
```

### 2. Deploy

```bash
git push origin main
```

Render will automatically deploy with the new environment variables.

### 3. Verify

Check Render logs:
```
[INFO] SES client initialized with explicit credentials
[INFO] Email sent successfully | To: user@example.com | MessageId: ...
```

---

## AWS ECS Deployment

### 1. Create ECS Task Role

```bash
aws iam create-role \
  --role-name ChampionCircuitECSTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ChampionCircuitECSTaskRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSESFullAccess
```

### 2. Update Task Definition

```json
{
  "family": "champion-circuit-backend",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ChampionCircuitECSTaskRole",
  "containerDefinitions": [{
    "name": "backend",
    "image": "your-ecr-repo/champion-circuit:latest",
    "environment": [
      {"name": "AWS_REGION", "value": "ap-south-1"},
      {"name": "SES_FROM_EMAIL", "value": "official@championcircuit.com"},
      {"name": "SES_FROM_NAME", "value": "Champion Circuit"},
      {"name": "ENVIRONMENT", "value": "production"}
    ]
  }]
}
```

**Note:** No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` needed! ECS uses the task role automatically.

### 3. Deploy

```bash
aws ecs update-service \
  --cluster champion-circuit-cluster \
  --service backend \
  --force-new-deployment
```

---

## Monitoring & Troubleshooting

### Check Email Sending Metrics

1. Go to [SES Console](https://console.aws.amazon.com/ses/)
2. Navigate to **Reputation Dashboard**
3. Monitor:
   - **Sends**: Total emails sent
   - **Bounces**: Invalid/rejected emails
   - **Complaints**: Spam reports
   - **Reputation**: Keep above 95% for good standing

### Common Issues

#### Issue: "Email address is not verified"

**Solution:** Verify `official@championcircuit.com` in SES Console.

```
Error: MessageRejected: Email address is not verified
```

#### Issue: "Daily sending quota exceeded"

**Solution:** Request production access (see [Request Production Access](#3-request-production-access)).

```
Error: Daily sending quota exceeded
```

#### Issue: "Credentials not found"

**Solution:** Check environment variables are set correctly.

```python
# In logs
[WARNING] AWS SES not fully configured. Emails will be logged to console only.
```

Verify:
```bash
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

#### Issue: "TemplateNotFound"

**Solution:** Ensure `app/templates/email/` directory exists and contains templates.

```
Error: EmailTemplateError: Email template not found: otp.html
```

#### Issue: High bounce rate

**Causes:**
- Invalid email addresses
- Typos in user input
- Inactive accounts

**Solution:**
- Add email validation on frontend
- Implement double opt-in
- Monitor bounce notifications
- Remove hard bounces from database

### Application Logs

```bash
# Check for email errors
grep "EMAIL ERROR" logs/app.log

# Check successful sends
grep "Email sent successfully" logs/app.log

# Monitor SES initialization
grep "SES client initialized" logs/app.log
```

### AWS CloudWatch

If using ECS:
1. Go to CloudWatch Logs
2. Find log group: `/ecs/champion-circuit-backend`
3. Search for: `Email sent` or `EMAIL ERROR`

---

## Migration Checklist

- [ ] AWS account created
- [ ] SES sender email verified (`official@championcircuit.com`)
- [ ] Production access requested (if needed)
- [ ] IAM user created with SES permissions
- [ ] Access keys generated and saved securely
- [ ] `.env` file configured locally
- [ ] Test script run successfully (`python test_ses_email.py`)
- [ ] Environment variables set in Render/ECS
- [ ] Application deployed and tested
- [ ] Legacy SMTP settings removed from `.env`
- [ ] Monitoring dashboard reviewed

---

## Support

### AWS Support Resources

- [SES Documentation](https://docs.aws.amazon.com/ses/)
- [SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)
- [SES Sending Limits](https://docs.aws.amazon.com/ses/latest/dg/quotas.html)

### Contact

- **Email:** official@championcircuit.com
- **Documentation:** This file
- **Issues:** GitHub Issues (if applicable)

---

## Next Steps

After successful migration:

1. **Monitor**: Watch bounce and complaint rates for first 30 days
2. **Optimize**: Add unsubscribe links to marketing emails
3. **Scale**: Increase sending quotas if needed
4. **Security**: Rotate access keys every 90 days
5. **Backup**: Consider multi-region SES setup for redundancy

**Congratulations! Your email system is now running on AWS SES.** 🎉
