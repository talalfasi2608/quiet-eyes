"""
Phone number formatting utilities for Israeli numbers.

Storage format:  972XXXXXXXXX  (WhatsApp / E.164 digits only)
Twilio format:   +972XXXXXXXXX (E.164 with plus)
Display format:  05X-XXXXXXX   (Israeli local)
"""

import re


def format_for_whatsapp(phone: str) -> str:
    """
    Convert any Israeli phone to +972XXXXXXXXX format for Twilio/WhatsApp.

    Handles:
      05X-XXXXXXX  -> +972XXXXXXXXX
      972XXXXXXXXX -> +972XXXXXXXXX
      +972XXXXXXXXX -> +972XXXXXXXXX
    """
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("972"):
        return f"+{digits}"
    if digits.startswith("0"):
        return f"+972{digits[1:]}"
    return f"+972{digits}"


def format_for_display(phone: str) -> str:
    """Convert any Israeli phone to 05X-XXXXXXX display format."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("972"):
        local = "0" + digits[3:]
    elif digits.startswith("0"):
        local = digits
    else:
        local = "0" + digits
    if len(local) >= 4:
        return local[:3] + "-" + local[3:]
    return local


def is_valid_israeli_mobile(phone: str) -> bool:
    """Check if a phone looks like a valid Israeli mobile number."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("972") and len(digits) == 12 and digits[3] == "5":
        return True
    if digits.startswith("05") and len(digits) == 10:
        return True
    return False
