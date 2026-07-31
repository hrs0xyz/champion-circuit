"""
Email service for Champion Circuit using AWS SES.

This module provides backward-compatible email functions that use the new
SES-based email service. All existing code will continue to work without changes.

Legacy SMTP implementation has been replaced with AWS SES for better
deliverability, scalability, and monitoring.
"""

import logging
import threading
from typing import Optional

from app.core.config import settings
from app.services.email_service import get_email_service, EmailServiceError

logger = logging.getLogger(__name__)

SITE_URL = "https://championcircuit.com"


def _send_async(fn, *args, **kwargs) -> None:
    """
    Fire-and-forget email send on a daemon thread. Email must never block or
    fail the request that triggered it — any exception is logged and swallowed.
    """
    def _run():
        try:
            fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001 — email is best-effort by design
            logger.error(f"[EMAIL ERROR] async {getattr(fn, '__name__', fn)} failed: {exc}", exc_info=True)

    threading.Thread(target=_run, daemon=True).start()


def send_otp_email(to_email: str, otp: str, purpose: str) -> bool:
    """Send an OTP email using AWS SES. Returns True if sent successfully."""
    email_service = get_email_service()
    
    subject_map = {
        "signup": "Your Champion Circuit signup code",
        "password reset": "Reset your Champion Circuit password",
    }
    subject = subject_map.get(purpose, f"Champion Circuit {purpose} code")

    try:
        email_service.send_template_email(
            to_email=to_email,
            subject=subject,
            template_name="otp.html",
            context={
                "otp": otp,
                "purpose": purpose,
                "expiry_minutes": 10,
            },
        )
        logger.info(f"OTP email sent successfully to {to_email} for {purpose}")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send OTP email to {to_email}: {e}")
        # Fallback: log to console in development
        if settings.is_development:
            logger.info(f"[DEV OTP FALLBACK] {purpose} for {to_email}: {otp}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending OTP email to {to_email}: {e}", exc_info=True)
        return False


def send_voucher_email(to_email: str, code: str, benefit: str) -> bool:
    """Send an early-access voucher email using AWS SES."""
    email_service = get_email_service()
    
    try:
        email_service.send_template_email(
            to_email=to_email,
            subject="Your Champion Circuit early-access voucher",
            template_name="voucher_early_access.html",
            context={
                "code": code,
                "benefit": benefit,
            },
        )
        logger.info(f"Early-access voucher email sent to {to_email}")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send voucher email to {to_email}: {e}")
        if settings.is_development:
            logger.info(f"[DEV VOUCHER FALLBACK] {to_email} → code: {code} | benefit: {benefit}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending voucher email to {to_email}: {e}", exc_info=True)
        return False


def send_voucher_delivery_email(
    to_email: str,
    buyer_name: str,
    vouchers: list[tuple[str, str, str]],  # (code, title, value_label)
    partner_name: str,
) -> bool:
    """Send purchased voucher codes to the buyer using AWS SES."""
    email_service = get_email_service()
    
    # Transform vouchers tuple list to dict list for template
    voucher_list = [
        {"code": code, "title": title, "value_label": value_label}
        for code, title, value_label in vouchers
    ]
    
    try:
        email_service.send_template_email(
            to_email=to_email,
            subject="Your Champion Circuit voucher",
            template_name="voucher_delivery.html",
            context={
                "buyer_name": buyer_name,
                "vouchers": voucher_list,
                "partner_name": partner_name,
            },
        )
        logger.info(f"Voucher delivery email sent to {to_email} with {len(vouchers)} voucher(s)")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send voucher delivery email to {to_email}: {e}")
        if settings.is_development:
            for code, title, value_label in vouchers:
                logger.info(f"[DEV VOUCHER DELIVERY FALLBACK] {to_email} → {title} | {value_label} | code: {code}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending voucher delivery email to {to_email}: {e}", exc_info=True)
        return False


def send_welcome_email(to_email: str, username: str, name: str = "") -> bool:
    """Send a welcome email after successful signup using AWS SES."""
    email_service = get_email_service()
    display = name or username

    try:
        email_service.send_template_email(
            to_email=to_email,
            subject=f"Welcome to Champion Circuit, {display}! 🏆",
            template_name="welcome.html",
            context={
                "display_name": display,
                "username": username,
            },
        )
        logger.info(f"Welcome email sent to {to_email} for @{username}")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send welcome email to {to_email}: {e}")
        if settings.is_development:
            logger.info(f"[DEV WELCOME FALLBACK] Welcome email to {to_email} for @{username}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending welcome email to {to_email}: {e}", exc_info=True)
        return False


# ── Tournament emails ─────────────────────────────────────────────────────────
# All tournament emails now use Jinja2 templates via SES


def send_tournament_registration_email(
    to_email: str, display: str, tournament_name: str, slug: str,
    when: str = "", venue_name: str = "",
) -> bool:
    """Send tournament registration confirmation email using AWS SES."""
    email_service = get_email_service()
    
    try:
        email_service.send_template_email(
            to_email=to_email,
            subject=f"You're registered — {tournament_name}",
            template_name="tournament_registration.html",
            context={
                "display_name": display,
                "tournament_name": tournament_name,
                "slug": slug,
                "when": when,
                "venue_name": venue_name,
            },
        )
        logger.info(f"Tournament registration email sent to {to_email} for {tournament_name}")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send tournament registration email to {to_email}: {e}")
        if settings.is_development:
            logger.info(f"[DEV TOURNAMENT REG FALLBACK] {to_email} — {tournament_name}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending tournament registration email: {e}", exc_info=True)
        return False


def send_bracket_published_email(
    to_email: str, display: str, tournament_name: str, slug: str,
) -> bool:
    """Send bracket published notification email using AWS SES."""
    email_service = get_email_service()
    
    try:
        email_service.send_template_email(
            to_email=to_email,
            subject=f"The bracket is live — {tournament_name}",
            template_name="tournament_bracket_published.html",
            context={
                "display_name": display,
                "tournament_name": tournament_name,
                "slug": slug,
            },
        )
        logger.info(f"Bracket published email sent to {to_email} for {tournament_name}")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send bracket email to {to_email}: {e}")
        if settings.is_development:
            logger.info(f"[DEV BRACKET FALLBACK] {to_email} — {tournament_name}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending bracket email: {e}", exc_info=True)
        return False


def send_fixture_email(
    to_email: str, display: str, tournament_name: str, slug: str,
    round_label: str, when: str = "", venue_name: str = "", opponent: str = "",
) -> bool:
    """Send fixture notification email using AWS SES."""
    email_service = get_email_service()
    
    try:
        email_service.send_template_email(
            to_email=to_email,
            subject=f"Your {round_label} is set — {tournament_name}",
            template_name="tournament_fixture.html",
            context={
                "display_name": display,
                "tournament_name": tournament_name,
                "slug": slug,
                "round_label": round_label,
                "when": when,
                "venue_name": venue_name,
                "opponent": opponent,
            },
        )
        logger.info(f"Fixture email sent to {to_email} for {tournament_name} - {round_label}")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send fixture email to {to_email}: {e}")
        if settings.is_development:
            logger.info(f"[DEV FIXTURE FALLBACK] {to_email} — {tournament_name} — {round_label}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending fixture email: {e}", exc_info=True)
        return False



def send_checkin_reminder_email(
    to_email: str, display: str, tournament_name: str, slug: str,
    checkin_code: str, when: str = "", venue_name: str = "",
) -> bool:
    """Send check-in reminder email using AWS SES."""
    email_service = get_email_service()
    
    try:
        email_service.send_template_email(
            to_email=to_email,
            subject=f"⏰ Check-in Reminder — {tournament_name}",
            template_name="checkin_reminder.html",
            context={
                "display_name": display,
                "tournament_name": tournament_name,
                "slug": slug,
                "checkin_code": checkin_code,
                "when": when,
                "venue_name": venue_name,
            },
        )
        logger.info(f"Check-in reminder sent to {to_email} for {tournament_name}")
        return True
    except EmailServiceError as e:
        logger.error(f"Failed to send check-in reminder to {to_email}: {e}")
        if settings.is_development:
            logger.info(f"[DEV CHECKIN REMINDER] {to_email} — {tournament_name} — Code: {checkin_code}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending check-in reminder: {e}", exc_info=True)
        return False
