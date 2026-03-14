"""Send email via SMTP (e.g. OTP)."""

import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr

from app.core.config import get_settings


def send_email(to: str, subject: str, body_plain: str) -> None:
    """
    Send a plain-text email. Raises if SMTP is not configured or send fails.
    """
    settings = get_settings()
    if not settings.smtp_host:
        raise RuntimeError("SMTP not configured: set SMTP_HOST and related env vars")
    msg = MIMEText(body_plain, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.app_name, settings.smtp_from_email))
    msg["To"] = to
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.sendmail(settings.smtp_from_email, [to], msg.as_string())


def is_email_configured() -> bool:
    """Return True if SMTP is configured enough to send mail."""
    settings = get_settings()
    return bool(settings.smtp_host and settings.smtp_from_email)
