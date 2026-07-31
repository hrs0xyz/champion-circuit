"""
AWS SES Email Service for Champion Circuit.

This service replaces the legacy SMTP implementation with AWS SES using boto3.
Supports HTML emails, plain text fallback, templates, retry logic, and comprehensive logging.

Architecture:
- Dependency injection ready
- Async-friendly (uses thread pool for async compatibility)
- Production-ready error handling and retry logic
- Structured logging with request IDs and latency tracking
"""

import logging
import time
import threading
from typing import Any, Optional
from pathlib import Path

import boto3
from botocore.exceptions import (
    ClientError,
    NoCredentialsError,
    PartialCredentialsError,
    BotoCoreError,
)
from jinja2 import Environment, FileSystemLoader, TemplateNotFound

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailServiceError(Exception):
    """Base exception for email service errors."""
    pass


class EmailValidationError(EmailServiceError):
    """Raised when email validation fails."""
    pass


class EmailTemplateError(EmailServiceError):
    """Raised when template rendering fails."""
    pass


class EmailSendError(EmailServiceError):
    """Raised when email sending fails."""
    pass


class SESEmailService:
    """
    Production-ready AWS SES email service.
    
    Features:
    - HTML and plain text email support
    - Jinja2 template rendering
    - Automatic retry with exponential backoff
    - Comprehensive logging with metrics
    - Support for CC, BCC, Reply-To, and custom headers
    - Thread-safe for async operations
    """

    def __init__(self):
        """Initialize SES client and Jinja2 environment."""
        self._ses_client: Optional[Any] = None
        self._jinja_env: Optional[Environment] = None
        self._initialized = False
        self._lock = threading.Lock()
        
        # Log initialization intent
        logger.info("SESEmailService instance created, will initialize lazily on first use")

    def _initialize(self) -> None:
        """Lazy initialization of SES client and Jinja2 environment."""
        if self._initialized:
            return

        with self._lock:
            if self._initialized:  # Double-check after acquiring lock
                return
            
            import sys
            print(f"[EMAIL SERVICE] _initialize() called from: {sys._getframe(1).f_code.co_name}", file=sys.stderr)
            print(f"[EMAIL SERVICE] Instance ID: {id(self)}", file=sys.stderr)

            # Initialize SES client
            try:
                # boto3 will automatically use credentials in this order:
                # 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
                # 2. Shared credential file (~/.aws/credentials)
                # 3. AWS IAM role (for EC2, ECS, Lambda)
                if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                    self._ses_client = boto3.client(
                        "ses",
                        region_name=settings.AWS_REGION,
                        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    )
                    logger.info("SES client initialized with explicit credentials")
                else:
                    # Use default credential provider chain (IAM roles, etc.)
                    self._ses_client = boto3.client(
                        "ses",
                        region_name=settings.AWS_REGION,
                    )
                    logger.info("SES client initialized with default credential chain (IAM role)")

            except (NoCredentialsError, PartialCredentialsError) as e:
                logger.error(f"AWS credentials not found or incomplete: {e}")
                if settings.is_production:
                    raise EmailServiceError(f"AWS SES credentials missing: {e}") from e
                logger.warning("Running in dev mode without SES credentials - emails will be logged only")

            except Exception as e:
                logger.error(f"Failed to initialize SES client: {e}")
                raise EmailServiceError(f"SES initialization failed: {e}") from e

            # Initialize Jinja2 environment for email templates
            templates_dir = Path(__file__).parent.parent / "templates" / "email"
            
            # Log absolute path for debugging
            abs_templates_dir = templates_dir.absolute()
            logger.info(f"Looking for email templates at: {abs_templates_dir}")
            
            if templates_dir.exists():
                # List templates found
                template_files = list(templates_dir.glob("*.html"))
                logger.info(f"Found {len(template_files)} template files: {[t.name for t in template_files]}")
                
                self._jinja_env = Environment(
                    loader=FileSystemLoader(str(templates_dir)),
                    autoescape=True,
                    trim_blocks=True,
                    lstrip_blocks=True,
                )
                
                # Verify Jinja2 can see the templates
                jinja_templates = self._jinja_env.list_templates()
                logger.info(f"Jinja2 sees {len(jinja_templates)} templates: {sorted(jinja_templates)}")
                
                logger.info(f"Jinja2 environment initialized with template dir: {templates_dir}")
            else:
                logger.error(f"Email templates directory NOT FOUND: {abs_templates_dir}")
                logger.error(f"__file__ resolves to: {Path(__file__).absolute()}")
                logger.error(f"parent: {Path(__file__).parent.absolute()}")
                logger.error(f"parent.parent: {Path(__file__).parent.parent.absolute()}")
                self._jinja_env = None

            self._initialized = True

    @property
    def ses_client(self) -> Any:
        """Lazy-loaded SES client."""
        if not self._initialized:
            self._initialize()
        return self._ses_client

    @property
    def jinja_env(self) -> Optional[Environment]:
        """Lazy-loaded Jinja2 environment."""
        if not self._initialized:
            self._initialize()
        return self._jinja_env

    def _validate_email(self, email: str) -> None:
        """Basic email validation."""
        if not email or "@" not in email or "." not in email.split("@")[1]:
            raise EmailValidationError(f"Invalid email address: {email}")

    def _sanitize_input(self, text: str) -> str:
        """Sanitize text input to prevent injection attacks."""
        if not text:
            return ""
        # Remove null bytes and control characters
        return "".join(char for char in text if char.isprintable() or char in ("\n", "\r", "\t"))

    def _render_template(self, template_name: str, context: dict[str, Any]) -> str:
        """
        Render Jinja2 template with given context.
        
        Args:
            template_name: Name of the template file (e.g., "otp.html")
            context: Dictionary of variables to pass to template
            
        Returns:
            Rendered HTML string
            
        Raises:
            EmailTemplateError: If template not found or rendering fails
        """
        print(f"[_render_template] Called with template_name={template_name}")
        print(f"[_render_template] self.jinja_env is None: {self.jinja_env is None}")
        print(f"[_render_template] self._initialized: {self._initialized}")
        
        if not self.jinja_env:
            # Log detailed path information when env is not initialized
            templates_dir = Path(__file__).parent.parent / "templates" / "email"
            logger.error(f"Jinja2 environment not initialized!")
            logger.error(f"Expected templates at: {templates_dir.absolute()}")
            logger.error(f"Directory exists: {templates_dir.exists()}")
            if templates_dir.exists():
                logger.error(f"Files in directory: {list(templates_dir.glob('*.html'))}")
            raise EmailTemplateError("Jinja2 environment not initialized. Check templates directory.")

        try:
            # Log available templates before attempting to load
            available_templates = self.jinja_env.list_templates()
            logger.info(f"Attempting to load template '{template_name}' from {len(available_templates)} available templates")
            logger.info(f"Available templates: {available_templates}")
            
            template = self.jinja_env.get_template(template_name)
            return template.render(**context)
        except TemplateNotFound as e:
            logger.error(f"Template '{template_name}' not found in Jinja environment")
            logger.error(f"Template search path: {self.jinja_env.loader.searchpath if hasattr(self.jinja_env.loader, 'searchpath') else 'unknown'}")
            raise EmailTemplateError(f"Email template not found: {template_name}") from e
        except Exception as e:
            raise EmailTemplateError(f"Template rendering failed for {template_name}: {e}") from e

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: Optional[str] = None,
        cc: Optional[list[str]] = None,
        bcc: Optional[list[str]] = None,
        reply_to: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        max_retries: int = 3,
    ) -> dict[str, Any]:
        """
        Send an email via AWS SES.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            plain_body: Plain text fallback (auto-generated if not provided)
            cc: List of CC email addresses
            bcc: List of BCC email addresses
            reply_to: Reply-To email address
            from_email: Sender email (defaults to SES_FROM_EMAIL)
            from_name: Sender name (defaults to SES_FROM_NAME)
            max_retries: Maximum retry attempts for transient failures
            
        Returns:
            Dict with 'success', 'message_id', and 'metadata'
            
        Raises:
            EmailValidationError: If email addresses are invalid
            EmailSendError: If sending fails after retries
        """
        start_time = time.time()
        
        # Validate inputs
        self._validate_email(to_email)
        if reply_to:
            self._validate_email(reply_to)
        
        # Sanitize inputs
        subject = self._sanitize_input(subject)
        html_body = self._sanitize_input(html_body)
        if plain_body:
            plain_body = self._sanitize_input(plain_body)

        # Use defaults if not provided
        from_email = from_email or settings.SES_FROM_EMAIL
        from_name = from_name or settings.SES_FROM_NAME
        sender = f"{from_name} <{from_email}>" if from_name else from_email

        # Dev mode: log email instead of sending
        if not settings.ses_configured or not self.ses_client:
            logger.info(
                f"[DEV EMAIL] To: {to_email} | Subject: {subject} | "
                f"HTML length: {len(html_body)} chars"
            )
            return {
                "success": True,
                "message_id": "dev-mode-no-send",
                "metadata": {"mode": "development", "logged_only": True},
            }

        # Prepare destination
        destination = {"ToAddresses": [to_email]}
        if cc:
            destination["CcAddresses"] = cc
        if bcc:
            destination["BccAddresses"] = bcc

        # Prepare message body
        body_data: dict[str, Any] = {"Html": {"Data": html_body, "Charset": "UTF-8"}}
        if plain_body:
            body_data["Text"] = {"Data": plain_body, "Charset": "UTF-8"}

        # Prepare message
        message = {
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": body_data,
        }

        # Prepare parameters
        params: dict[str, Any] = {
            "Source": sender,
            "Destination": destination,
            "Message": message,
        }
        if reply_to:
            params["ReplyToAddresses"] = [reply_to]

        # Send with retry logic
        last_exception: Optional[Exception] = None
        for attempt in range(max_retries):
            try:
                response = self.ses_client.send_email(**params)
                message_id = response.get("MessageId", "unknown")
                latency_ms = int((time.time() - start_time) * 1000)

                logger.info(
                    f"Email sent successfully | To: {to_email} | Subject: {subject} | "
                    f"MessageId: {message_id} | Latency: {latency_ms}ms | Attempt: {attempt + 1}"
                )

                return {
                    "success": True,
                    "message_id": message_id,
                    "metadata": {
                        "recipient": to_email,
                        "subject": subject,
                        "latency_ms": latency_ms,
                        "attempt": attempt + 1,
                        "request_id": response.get("ResponseMetadata", {}).get("RequestId"),
                    },
                }

            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "Unknown")
                error_message = e.response.get("Error", {}).get("Message", str(e))
                last_exception = e

                # Non-retryable errors
                if error_code in (
                    "MessageRejected",
                    "MailFromDomainNotVerified",
                    "ConfigurationSetDoesNotExist",
                    "InvalidParameterValue",
                ):
                    logger.error(
                        f"Email sending failed (non-retryable) | To: {to_email} | "
                        f"Error: {error_code} - {error_message}"
                    )
                    raise EmailSendError(f"SES error [{error_code}]: {error_message}") from e

                # Retryable errors (throttling, temporary failures)
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(
                        f"Email sending failed (retrying) | To: {to_email} | "
                        f"Error: {error_code} | Attempt: {attempt + 1}/{max_retries} | "
                        f"Retrying in {wait_time}s"
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"Email sending failed (max retries exceeded) | To: {to_email} | "
                        f"Error: {error_code} - {error_message}"
                    )

            except (BotoCoreError, Exception) as e:
                last_exception = e
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.warning(
                        f"Email sending error (retrying) | To: {to_email} | "
                        f"Error: {e} | Retrying in {wait_time}s"
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(f"Email sending failed after {max_retries} attempts | To: {to_email} | Error: {e}")

        # All retries exhausted
        raise EmailSendError(
            f"Failed to send email after {max_retries} attempts: {last_exception}"
        ) from last_exception

    def send_template_email(
        self,
        to_email: str,
        subject: str,
        template_name: str,
        context: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Send an email using a Jinja2 template.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            template_name: Name of the template file (e.g., "welcome.html")
            context: Dictionary of variables for template rendering
            **kwargs: Additional arguments passed to send_email()
            
        Returns:
            Dict with send result
            
        Raises:
            EmailTemplateError: If template rendering fails
            EmailSendError: If sending fails
        """
        try:
            html_body = self._render_template(template_name, context)
            return self.send_email(
                to_email=to_email,
                subject=subject,
                html_body=html_body,
                **kwargs,
            )
        except EmailTemplateError:
            raise
        except Exception as e:
            raise EmailSendError(f"Template email sending failed: {e}") from e

    def send_bulk_email(
        self,
        recipients: list[str],
        subject: str,
        html_body: str,
        plain_body: Optional[str] = None,
        max_concurrent: int = 10,
    ) -> dict[str, Any]:
        """
        Send the same email to multiple recipients (one-by-one for personalization).
        
        Note: For true bulk sending with personalization, use SES SendBulkTemplatedEmail.
        This method sends individual emails for simplicity.
        
        Args:
            recipients: List of recipient email addresses
            subject: Email subject
            html_body: HTML email body
            plain_body: Plain text fallback
            max_concurrent: Maximum concurrent sends (not implemented yet)
            
        Returns:
            Dict with success count, failure count, and details
        """
        results = {"total": len(recipients), "success": 0, "failed": 0, "details": []}

        for recipient in recipients:
            try:
                result = self.send_email(
                    to_email=recipient,
                    subject=subject,
                    html_body=html_body,
                    plain_body=plain_body,
                )
                results["success"] += 1
                results["details"].append({"email": recipient, "status": "sent", "message_id": result["message_id"]})
            except Exception as e:
                results["failed"] += 1
                results["details"].append({"email": recipient, "status": "failed", "error": str(e)})
                logger.error(f"Bulk email failed for {recipient}: {e}")

        logger.info(
            f"Bulk email completed | Total: {results['total']} | "
            f"Success: {results['success']} | Failed: {results['failed']}"
        )
        return results


# Global singleton instance
_email_service: Optional[SESEmailService] = None


def get_email_service() -> SESEmailService:
    """
    Get the global email service instance (dependency injection).
    
    Usage in FastAPI routes:
        from fastapi import Depends
        
        @router.post("/send-email")
        def send_email(email_service: SESEmailService = Depends(get_email_service)):
            email_service.send_email(...)
    """
    global _email_service
    if _email_service is None:
        _email_service = SESEmailService()
    return _email_service


# Convenience function for backward compatibility
def send_email_async(fn, *args, **kwargs) -> None:
    """
    Fire-and-forget email send on a daemon thread.
    Maintains backward compatibility with legacy async email pattern.
    
    Usage:
        send_email_async(email_service.send_email, to_email="user@example.com", ...)
    """
    def _run():
        try:
            fn(*args, **kwargs)
        except Exception as exc:
            logger.error(f"Async email send failed: {exc}", exc_info=True)

    threading.Thread(target=_run, daemon=True).start()
