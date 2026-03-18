"""
AI-powered outbound draft generator.

Generates channel-specific outbound messages based on lead data,
business context, and optional user prompts.
"""

from app.models import Business, Lead, OutboundChannel


# ── Templates by channel ──

_EMAIL_TEMPLATES = {
    "PURCHASE": {
        "subject": "Quick question about {category}",
        "body": (
            "Hi {name},\n\n"
            "I noticed you were looking into {category} solutions. "
            "At {biz_name}, we specialize in exactly that — and I'd love to "
            "share how we've helped similar businesses.\n\n"
            "Would you be open to a brief chat this week?\n\n"
            "Best,\n{biz_name} Team"
        ),
    },
    "COMPARISON": {
        "subject": "Comparing {category} options? Here's what makes us different",
        "body": (
            "Hi {name},\n\n"
            "I saw you're comparing {category} providers. We get it — it's a big decision. "
            "Here's a quick overview of what sets {biz_name} apart:\n\n"
            "- Proven results in {category}\n"
            "- Dedicated support team\n"
            "- Flexible pricing\n\n"
            "Happy to answer any questions.\n\n"
            "Cheers,\n{biz_name} Team"
        ),
    },
    "DEFAULT": {
        "subject": "{biz_name} — Let's connect about {category}",
        "body": (
            "Hi {name},\n\n"
            "I came across your interest in {category} and thought you might benefit "
            "from what we do at {biz_name}.\n\n"
            "Would love to share more — feel free to reply to this email.\n\n"
            "Best,\n{biz_name} Team"
        ),
    },
}

_WHATSAPP_TEMPLATES = {
    "PURCHASE": (
        "Hey {name}! 👋 This is {biz_name}. "
        "I saw you were interested in {category} — we'd love to help. "
        "Can I send you a quick overview?"
    ),
    "DEFAULT": (
        "Hi {name}! This is {biz_name}. "
        "We noticed your interest in {category} and wanted to reach out. "
        "Let us know if you'd like to learn more!"
    ),
}

_LINKEDIN_TEMPLATES = {
    "PURCHASE": (
        "Hi {name},\n\n"
        "I noticed your activity around {category} and thought it'd be worth connecting. "
        "At {biz_name}, we work with professionals like you to deliver results "
        "in this space.\n\n"
        "Would love to exchange ideas. Let's connect!"
    ),
    "DEFAULT": (
        "Hi {name},\n\n"
        "I see we share an interest in {category}. "
        "I'm with {biz_name} — we help businesses in this area grow strategically.\n\n"
        "Let's connect!"
    ),
}

_CONTENT_TEMPLATES = {
    "DEFAULT": (
        "📈 {biz_name} Insights: {category}\n\n"
        "Here's what we're seeing in the {category} space right now:\n\n"
        "- Growing demand for personalized solutions\n"
        "- Businesses are looking for faster results\n"
        "- Data-driven approaches are winning\n\n"
        "At {biz_name}, we're helping businesses navigate these trends. "
        "What are you seeing in your market?\n\n"
        "#business #{category_tag} #growth"
    ),
}

_CRM_TEMPLATES = {
    "DEFAULT": (
        "CRM Follow-up Note for {name}:\n\n"
        "Lead showed {intent} intent in {category}. "
        "Score: {score}/100, Confidence: {confidence}%.\n\n"
        "Recommended next step: Schedule a discovery call focused on their "
        "specific {category} needs. Reference their original inquiry for context."
    ),
}


def _ai_generate_draft(
    channel: OutboundChannel,
    biz_name: str,
    category: str,
    intent: str,
    name: str,
    prompt: str | None,
    metadata: dict | None = None,
) -> dict | None:
    """Try to generate a draft using OpenAI. Returns None on failure."""
    from app.ai import chat_completion

    metadata = metadata or {}

    channel_instructions = {
        OutboundChannel.EMAIL: "Write a professional outbound email with a subject line. Keep it concise (3-5 sentences body).",
        OutboundChannel.WHATSAPP: "Write a short, friendly WhatsApp message (2-3 sentences). Casual but professional.",
        OutboundChannel.LINKEDIN: "Write a LinkedIn connection/message (2-4 sentences). Professional networking tone.",
        OutboundChannel.CONTENT: "Write a social media post with hashtags. Engaging, thought-leadership style.",
        OutboundChannel.CRM: "Write an internal CRM follow-up note with recommended next steps.",
    }

    tone = metadata.get("tone", "")
    tone_instruction = f" Use a {tone} tone." if tone else ""

    system = (
        "You are a marketing copywriter for the business. "
        "Write compelling, personalized outbound messages. Be concise and action-oriented."
        f"{tone_instruction}"
    )

    user_msg = (
        f"Business: {biz_name}\nIndustry: {category}\n"
        f"Channel: {channel.value}\nRecipient name: {name}\n"
        f"Lead intent: {intent}\n"
        f"Instructions: {channel_instructions.get(channel, 'Write an appropriate message.')}\n"
    )
    if metadata.get("description"):
        user_msg += f"Business description: {metadata['description']}\n"
    if metadata.get("differentiation"):
        user_msg += f"What makes us different: {metadata['differentiation']}\n"
    if metadata.get("ideal_customer"):
        user_msg += f"Ideal customer: {metadata['ideal_customer']}\n"
    if metadata.get("services"):
        user_msg += f"Services/products: {metadata['services']}\n"
    if prompt:
        user_msg += f"Additional guidance: {prompt}\n"

    if channel == OutboundChannel.EMAIL:
        user_msg += "\nReturn the subject on the first line prefixed with 'Subject: ', then a blank line, then the body."

    result = chat_completion(system, user_msg, max_tokens=512, temperature=0.7)
    if not result:
        return None

    subject = None
    body = result.strip()
    if channel == OutboundChannel.EMAIL and body.lower().startswith("subject:"):
        lines = body.split("\n", 2)
        subject = lines[0].split(":", 1)[1].strip()
        body = "\n".join(lines[1:]).strip()

    return {"subject": subject, "body": body}


def generate_draft(
    channel: OutboundChannel,
    biz: Business,
    lead: Lead | None = None,
    prompt: str | None = None,
) -> dict:
    """
    Generate an outbound draft for the given channel.
    Uses OpenAI when available, falls back to templates.

    Returns dict with keys: subject (optional), body, reason, evidence_url,
    recipient_name, recipient_handle.
    """
    # Context vars
    name = "there"
    intent = "OTHER"
    score = 0
    confidence = 0
    evidence_url = None
    recipient_handle = None

    if lead:
        intent = lead.intent.value
        score = lead.score
        confidence = lead.confidence
        if lead.mention:
            evidence_url = lead.mention.url
            name = lead.mention.title or "there"

    category = biz.category or "your industry"
    category_tag = category.lower().replace(" ", "").replace("&", "and")
    biz_name = biz.name

    reason = f"AI-generated based on {intent} lead signal (score: {score}, confidence: {confidence}%)"
    if prompt:
        reason += f". User guidance: {prompt}"

    # Try OpenAI first
    metadata = biz.client_metadata or {}
    ai_draft = _ai_generate_draft(channel, biz_name, category, intent, name, prompt, metadata)
    if ai_draft:
        return {
            "subject": ai_draft.get("subject"),
            "body": ai_draft["body"],
            "reason": reason,
            "evidence_url": evidence_url,
            "recipient_name": name if name != "there" else None,
            "recipient_handle": recipient_handle,
        }

    # Fallback to templates
    fmt = {
        "name": name,
        "biz_name": biz_name,
        "category": category,
        "category_tag": category_tag,
        "intent": intent,
        "score": score,
        "confidence": confidence,
    }

    subject = None

    if channel == OutboundChannel.EMAIL:
        tpl = _EMAIL_TEMPLATES.get(intent, _EMAIL_TEMPLATES["DEFAULT"])
        subject = tpl["subject"].format(**fmt)
        body = tpl["body"].format(**fmt)
    elif channel == OutboundChannel.WHATSAPP:
        tpl = _WHATSAPP_TEMPLATES.get(intent, _WHATSAPP_TEMPLATES["DEFAULT"])
        body = tpl.format(**fmt)
    elif channel == OutboundChannel.LINKEDIN:
        tpl = _LINKEDIN_TEMPLATES.get(intent, _LINKEDIN_TEMPLATES["DEFAULT"])
        body = tpl.format(**fmt)
    elif channel == OutboundChannel.CONTENT:
        body = _CONTENT_TEMPLATES["DEFAULT"].format(**fmt)
        reason = f"Content draft for {category} — building thought leadership"
    elif channel == OutboundChannel.CRM:
        body = _CRM_TEMPLATES["DEFAULT"].format(**fmt)
        reason = f"CRM follow-up automation for {intent} lead"
    else:
        body = f"Outbound message for {channel.value}"

    if prompt:
        body = body.rstrip() + f"\n\n---\nContext: {prompt}"

    return {
        "subject": subject,
        "body": body,
        "reason": reason,
        "evidence_url": evidence_url,
        "recipient_name": name if name != "there" else None,
        "recipient_handle": recipient_handle,
    }
