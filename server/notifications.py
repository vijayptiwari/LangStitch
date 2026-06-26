"""Email notifications for the marketplace review workflow.

When SMTP is configured (``LANGSTITCH_SMTP_*``) messages are sent over SMTP;
otherwise they are logged so the platform keeps working in dev without a mail
server. Sending is always best-effort — a failed email never breaks the request.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from typing import Any

from .config import settings

logger = logging.getLogger("langstitch.notifications")


def send_email(to: str, subject: str, body_text: str, body_html: str | None = None) -> bool:
    """Send an email. Returns True if it was dispatched (or logged in dev)."""
    if not settings.smtp_configured:
        logger.info(
            "Email not sent (SMTP not configured). To=%s Subject=%s\n%s",
            to,
            subject,
            body_text,
        )
        return False

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                if settings.smtp_user:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
                if settings.smtp_use_tls:
                    server.starttls()
                if settings.smtp_user:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 - notifications must never break the API
        logger.exception("Failed to send email to %s", to)
        return False


def _field(label: str, value: Any) -> str:
    return f"{label}:\n{value or '—'}\n"


def submission_email(plugin: dict[str, Any], approve_url: str, reject_url: str) -> tuple[str, str, str]:
    """Build (subject, text_body, html_body) for a new submission review email."""
    subject = f"[LangStitch] Connector review: {plugin['name']} by {plugin['submitter_name']}"

    text = "\n".join(
        [
            "A new connector has been submitted for review.",
            "",
            _field("Submitted by", f"{plugin['submitter_name']} <{plugin['submitter_email']}>"),
            _field("Name", plugin["name"]),
            _field("Kind", plugin["kind"]),
            _field("Version", plugin["version"]),
            _field("Extension ID", plugin["extension_id"]),
            _field("Download URL", plugin["download_url"]),
            _field("Summary", plugin["summary"]),
            _field("Description", plugin["description"]),
            _field("Purpose", plugin["purpose"]),
            _field("Input schema", plugin["input_schema"]),
            _field("Output schema", plugin["output_schema"]),
            "",
            f"Approve: {approve_url}",
            f"Reject:  {reject_url}",
        ]
    )

    def esc(v: Any) -> str:
        from html import escape

        return escape(str(v)) if v else "&mdash;"

    rows = "".join(
        f"<tr><td style='padding:4px 12px;color:#6b7280;vertical-align:top'>{label}</td>"
        f"<td style='padding:4px 12px'><pre style='margin:0;white-space:pre-wrap;font-family:inherit'>{esc(value)}</pre></td></tr>"
        for label, value in [
            ("Submitted by", f"{plugin['submitter_name']} <{plugin['submitter_email']}>"),
            ("Name", plugin["name"]),
            ("Kind", plugin["kind"]),
            ("Version", plugin["version"]),
            ("Extension ID", plugin["extension_id"]),
            ("Download URL", plugin["download_url"]),
            ("Summary", plugin["summary"]),
            ("Description", plugin["description"]),
            ("Purpose", plugin["purpose"]),
            ("Input schema", plugin["input_schema"]),
            ("Output schema", plugin["output_schema"]),
        ]
    )
    html = f"""\
<div style="font-family:system-ui,Arial,sans-serif;max-width:640px">
  <h2 style="margin:0 0 4px">New connector submitted for review</h2>
  <p style="color:#6b7280;margin:0 0 16px">Review the details below and choose an action.</p>
  <table style="border-collapse:collapse;width:100%;font-size:14px">{rows}</table>
  <div style="margin-top:20px">
    <a href="{approve_url}" style="background:#16a34a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;margin-right:8px">Approve &amp; publish</a>
    <a href="{reject_url}" style="background:#dc2626;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px">Reject</a>
  </div>
</div>"""
    return subject, text, html


def decision_email(submitter_email: str, plugin_name: str, approved: bool, notes: str | None) -> tuple[str, str, str]:
    """Notify the publisher that their submission was approved or rejected."""
    verb = "approved and published" if approved else "rejected"
    subject = f"[LangStitch] Your connector \"{plugin_name}\" was {verb}"
    note_line = f"\nReviewer notes:\n{notes}\n" if notes else ""
    text = (
        f"Hi,\n\nYour connector \"{plugin_name}\" was {verb}.\n{note_line}\n"
        "— The LangStitch team"
    )
    html = (
        f"<div style='font-family:system-ui,Arial,sans-serif'>"
        f"<p>Your connector <strong>{plugin_name}</strong> was {verb}.</p>"
        + (f"<p style='color:#6b7280'>Reviewer notes: {notes}</p>" if notes else "")
        + "<p>— The LangStitch team</p></div>"
    )
    return subject, text, html
