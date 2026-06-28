from email.message import EmailMessage
import smtplib

from app.core.config import settings


def send_otp_email(to_email: str, otp: str, purpose: str) -> bool:
    """Send an OTP email. Returns True if sent via SMTP, False if printed to console (dev mode)."""
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"[DEV OTP] {purpose} for {to_email}: {otp}")
        return False

    subject_map = {
        "signup": "Your Champion Circuit signup code",
        "password reset": "Reset your Champion Circuit password",
    }
    subject = subject_map.get(purpose, f"Champion Circuit {purpose} code")

    plain = (
        f"Your Champion Circuit {purpose} code is: {otp}\n\n"
        f"This code expires in 10 minutes. Do not share it with anyone."
    )

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#000;font-family:'DM Sans',system-ui,sans-serif;color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:40px auto;background:#0a0a0a;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(245,245,245,0.5);">Champion Circuit</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 8px;font-size:15px;color:rgba(245,245,245,0.7);">Your {purpose} code</p>
        <p style="margin:0 0 24px;font-size:40px;font-weight:800;letter-spacing:0.25em;color:#ffffff;">{otp}</p>
        <p style="margin:0;font-size:14px;color:rgba(245,245,245,0.5);line-height:1.6;">
          This code expires in <strong style="color:#f5f5f5;">10 minutes</strong>.<br>
          If you didn't request this, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0;font-size:12px;color:rgba(245,245,245,0.3);">&copy; 2026 Champion Circuit Private Limited</p>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"Champion Circuit <{settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME}>"
    message["To"] = to_email
    message.set_content(plain)
    message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] Failed to send {purpose} OTP to {to_email}: {exc}")
        print(f"[DEV OTP FALLBACK] {purpose} for {to_email}: {otp}")
        return False


def send_voucher_email(to_email: str, code: str, benefit: str) -> bool:
    """Send an early-access voucher email."""
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"[DEV VOUCHER] {to_email} → code: {code} | benefit: {benefit}")
        return False

    plain = (
        f"Welcome to Champion Circuit!\n\n"
        f"Your early-access voucher code is: {code}\n"
        f"Benefit: {benefit}\n\n"
        f"Use this code when booking your first turf slot or registering for a tournament.\n\n"
        f"See you on the circuit.\n"
        f"— Champion Circuit Team\n"
        f"contact@championcircuit.com"
    )

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#000;font-family:'DM Sans',system-ui,sans-serif;color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;background:#0a0a0a;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(245,245,245,0.45);">Champion Circuit</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">You're in. 🎉</p>
        <p style="margin:0 0 28px;font-size:15px;color:rgba(245,245,245,0.6);line-height:1.6;">
          Here's your early-access voucher for Champion Circuit.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.14);border-radius:12px;margin-bottom:24px;">
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(245,245,245,0.4);">Your voucher code</p>
              <p style="margin:0 0 12px;font-size:28px;font-weight:800;letter-spacing:0.2em;color:#ffffff;font-family:monospace;">{code}</p>
              <p style="margin:0;font-size:14px;color:rgba(245,245,245,0.7);">{benefit}</p>
            </td>
          </tr>
        </table>

        <p style="margin:0;font-size:14px;color:rgba(245,245,245,0.5);line-height:1.7;">
          Use this code when you book your first turf slot or register for a tournament.<br>
          We'll remind you when we go live.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0;font-size:12px;color:rgba(245,245,245,0.3);">
          &copy; 2026 Champion Circuit Private Limited &nbsp;·&nbsp;
          <a href="mailto:contact@championcircuit.com" style="color:rgba(245,245,245,0.4);text-decoration:none;">contact@championcircuit.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    message = EmailMessage()
    message["Subject"] = "Your Champion Circuit early-access voucher"
    message["From"] = f"Champion Circuit <{settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME}>"
    message["To"] = to_email
    message.set_content(plain)
    message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] Failed to send voucher to {to_email}: {exc}")
        print(f"[DEV VOUCHER FALLBACK] {to_email} → code: {code}")
        return False


def send_voucher_delivery_email(
    to_email: str,
    buyer_name: str,
    vouchers: list[tuple[str, str, str]],  # (code, title, value_label)
    partner_name: str,
) -> bool:
    """Send purchased voucher codes to the buyer."""
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        for code, title, value_label in vouchers:
            print(f"[DEV VOUCHER DELIVERY] {to_email} → {title} | {value_label} | code: {code}")
        return False

    greeting = f"Hi {buyer_name}," if buyer_name else "Hi there,"
    voucher_rows = "".join(
        f"""
        <tr>
          <td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 4px;font-size:13px;color:rgba(245,245,245,0.5);">{title}</p>
            <p style="margin:0 0 8px;font-size:24px;font-weight:800;letter-spacing:0.18em;color:#fff;font-family:monospace;">{code}</p>
            <p style="margin:0;font-size:13px;color:rgba(245,245,245,0.6);">{value_label} · Redeemable at {partner_name}</p>
          </td>
        </tr>
        """
        for code, title, value_label in vouchers
    )

    plain = f"{greeting}\n\nYour Champion Circuit voucher(s):\n\n"
    for code, title, value_label in vouchers:
        plain += f"  {title}\n  Code: {code}\n  {value_label} at {partner_name}\n\n"
    plain += "Show this code (or QR) at the venue to redeem.\n\ncontact@championcircuit.com"

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#000;font-family:'DM Sans',system-ui,sans-serif;color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;background:#0a0a0a;border:1px solid rgba(255,255,255,0.12);border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px 18px;border-bottom:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(245,245,245,0.4);">Champion Circuit</p>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px;">
        <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#fff;">Your voucher is ready 🎟</p>
        <p style="margin:0 0 20px;font-size:14px;color:rgba(245,245,245,0.55);">{greeting}</p>
      </td>
    </tr>
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid rgba(255,255,255,0.08);">
          {voucher_rows}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 28px;">
        <p style="margin:0;font-size:13px;color:rgba(245,245,245,0.45);line-height:1.7;">
          Show this code or QR at the venue to redeem.<br>
          Questions? <a href="mailto:contact@championcircuit.com" style="color:rgba(245,245,245,0.6);">contact@championcircuit.com</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);">
        <p style="margin:0;font-size:11px;color:rgba(245,245,245,0.25);">&copy; 2026 Champion Circuit Private Limited</p>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    message = EmailMessage()
    message["Subject"] = "Your Champion Circuit voucher"
    message["From"] = f"Champion Circuit <{settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME}>"
    message["To"] = to_email
    message.set_content(plain)
    message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] Voucher delivery to {to_email}: {exc}")
        return False


def send_welcome_email(to_email: str, username: str, name: str = "") -> bool:
    """Send a welcome email after successful signup."""
    display = name or username

    if not settings.SMTP_HOST or not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        print(f"[DEV WELCOME] Welcome email to {to_email} for @{username}")
        return False

    plain = (
        f"Hey {display},\n\n"
        f"Welcome to Champion Circuit! 🏆\n\n"
        f"You're now part of a community built for serious players and passionate sports fans.\n\n"
        f"Here's what you can do right now:\n"
        f"  → Browse and book sports venues near you\n"
        f"  → Filter by your sport — Cricket, Badminton, Football, Esports, and more\n"
        f"  → Join or create tournaments\n"
        f"  → Climb the leaderboard\n\n"
        f"Your profile is live at: https://championcircuit.com/profile\n\n"
        f"See you on the circuit.\n"
        f"— The Champion Circuit Team\n"
        f"contact@championcircuit.com"
    )

    html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#060d1a;font-family:'DM Sans',system-ui,sans-serif;color:#e8f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;">
    <!-- Header -->
    <tr>
      <td style="background:#0a1628;border:1px solid rgba(10,191,188,0.2);border-radius:16px 16px 0 0;padding:28px 32px 24px;text-align:center;border-bottom:none;">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#0abfbc;">CHAMPION CIRCUIT</p>
      </td>
    </tr>
    <!-- Hero -->
    <tr>
      <td style="background:#0a1628;border:1px solid rgba(10,191,188,0.2);border-left:1px solid rgba(10,191,188,0.2);border-right:1px solid rgba(10,191,188,0.2);border-top:none;border-bottom:none;padding:36px 32px 28px;">
        <p style="margin:0 0 10px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">
          Welcome to the circuit, {display}. 🏆
        </p>
        <p style="margin:0 0 28px;font-size:15px;color:rgba(232,244,244,0.65);line-height:1.7;">
          You're now part of a community built for serious players, passionate fans, and future champions.
        </p>

        <!-- Feature list -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="padding:10px 16px;background:rgba(10,191,188,0.06);border:1px solid rgba(10,191,188,0.15);border-radius:10px;margin-bottom:8px;display:block;">
              <p style="margin:0;font-size:14px;color:#e8f4f4;">🏸 <strong>Book a turf</strong> — Find and reserve venues for Cricket, Badminton, Football, and more</p>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>
          <tr>
            <td style="padding:10px 16px;background:rgba(10,191,188,0.06);border:1px solid rgba(10,191,188,0.15);border-radius:10px;">
              <p style="margin:0;font-size:14px;color:#e8f4f4;">🎮 <strong>Esports pods</strong> — Book PS5, PC gaming, and more at partner venues</p>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>
          <tr>
            <td style="padding:10px 16px;background:rgba(10,191,188,0.06);border:1px solid rgba(10,191,188,0.15);border-radius:10px;">
              <p style="margin:0;font-size:14px;color:#e8f4f4;">🏆 <strong>Tournaments</strong> — Compete in city-level tournaments and climb the leaderboard</p>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>
          <tr>
            <td style="padding:10px 16px;background:rgba(10,191,188,0.06);border:1px solid rgba(10,191,188,0.15);border-radius:10px;">
              <p style="margin:0;font-size:14px;color:#e8f4f4;">🎟 <strong>Vouchers</strong> — Exclusive deals and discounts from partner venues</p>
            </td>
          </tr>
        </table>

        <!-- CTA -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align:center;">
              <a href="https://championcircuit.com/turf"
                 style="display:inline-block;background:#0abfbc;color:#060d1a;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.02em;">
                Browse Venues →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background:#060d1a;border:1px solid rgba(10,191,188,0.2);border-top:none;border-radius:0 0 16px 16px;padding:18px 32px;">
        <p style="margin:0;font-size:12px;color:rgba(232,244,244,0.35);line-height:1.6;">
          You received this because you signed up at Champion Circuit.<br>
          &copy; 2026 Champion Circuit Private Limited &nbsp;·&nbsp;
          <a href="mailto:contact@championcircuit.com" style="color:rgba(232,244,244,0.5);text-decoration:none;">contact@championcircuit.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    message = EmailMessage()
    message["Subject"] = f"Welcome to Champion Circuit, {display}! 🏆"
    message["From"] = f"Champion Circuit <{settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME}>"
    message["To"] = to_email
    message.set_content(plain)
    message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] Welcome email to {to_email}: {exc}")
        return False
