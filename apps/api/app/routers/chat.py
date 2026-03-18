"""
System-aware AI chat — grounded in real-time business data.

The chat queries live DB state (leads, trends, competitors, approvals, reviews)
and injects a data snapshot into the LLM context so every response references
real numbers, real items, and real opportunities.
"""

import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import get_business_scoped
from app.models import (
    Approval,
    ApprovalStatus,
    Business,
    Campaign,
    ChatMessage,
    ChatRole,
    Competitor,
    CompetitorEvent,
    Lead,
    LeadIntent,
    LeadStatus,
    Mention,
    OutboundAction,
    Review,
    ReviewSentiment,
    Trend,
)
from app.quota import check_quota, increment_usage
from app.schemas import ChatMessageCreate, ChatMessageOut

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


# ── Data snapshot builder ──


def _build_system_snapshot(db: Session, biz: Business) -> str:
    """Query real-time data and build a concise snapshot for the LLM."""
    bid = biz.id
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    sections: list[str] = []

    # --- Leads summary ---
    total_leads = db.query(func.count(Lead.id)).filter(Lead.business_id == bid).scalar() or 0
    new_leads = (
        db.query(func.count(Lead.id))
        .filter(Lead.business_id == bid, Lead.status == LeadStatus.NEW)
        .scalar() or 0
    )
    if total_leads > 0:
        # Top 5 leads by score
        top_leads = (
            db.query(Lead)
            .filter(Lead.business_id == bid)
            .order_by(Lead.score.desc())
            .limit(5)
            .all()
        )
        lead_lines = [f"Total leads: {total_leads} ({new_leads} new)"]
        for i, l in enumerate(top_leads, 1):
            mention_title = ""
            if l.mention_id:
                m = db.get(Mention, l.mention_id)
                if m:
                    mention_title = (m.title or m.snippet or "")[:80]
            lead_lines.append(
                f"  {i}. [{l.intent.value}] score={l.score} conf={l.confidence}% "
                f"| {mention_title}"
            )
        # Intent breakdown
        intent_counts = (
            db.query(Lead.intent, func.count(Lead.id))
            .filter(Lead.business_id == bid)
            .group_by(Lead.intent)
            .all()
        )
        if intent_counts:
            breakdown = ", ".join(f"{intent.value}={cnt}" for intent, cnt in intent_counts)
            lead_lines.append(f"Intent breakdown: {breakdown}")
        sections.append("LEADS:\n" + "\n".join(lead_lines))

    # --- Trends ---
    trends = (
        db.query(Trend)
        .filter(Trend.business_id == bid, Trend.created_at >= week_ago)
        .order_by(Trend.spike_score.desc())
        .limit(5)
        .all()
    )
    if trends:
        trend_lines = [f"Active trends (last 7 days): {len(trends)}"]
        for t in trends:
            urls = (t.evidence_urls or [])[:2]
            trend_lines.append(
                f"  - \"{t.topic}\" spike={t.spike_score} "
                f"evidence={len(t.evidence_urls or [])} links"
            )
        sections.append("TRENDS:\n" + "\n".join(trend_lines))

    # --- Competitor events ---
    comp_events = (
        db.query(CompetitorEvent)
        .filter(CompetitorEvent.business_id == bid, CompetitorEvent.created_at >= week_ago)
        .order_by(CompetitorEvent.created_at.desc())
        .limit(5)
        .all()
    )
    competitors = db.query(Competitor).filter(Competitor.business_id == bid).all()
    if comp_events or competitors:
        comp_lines = []
        if competitors:
            comp_lines.append(f"Tracked competitors: {', '.join(c.name for c in competitors)}")
        if comp_events:
            comp_lines.append(f"Recent competitor events: {len(comp_events)}")
            for e in comp_events:
                comp_lines.append(f"  - [{e.event_type.value}] {e.summary[:100]}")
        sections.append("COMPETITORS:\n" + "\n".join(comp_lines))

    # --- Reviews / Reputation ---
    reviews = (
        db.query(Review)
        .filter(Review.business_id == bid, Review.created_at >= week_ago)
        .order_by(Review.created_at.desc())
        .limit(5)
        .all()
    )
    if reviews:
        sent_counts = {}
        for r in reviews:
            sent_counts[r.sentiment.value] = sent_counts.get(r.sentiment.value, 0) + 1
        review_lines = [
            f"Recent reviews: {len(reviews)} "
            f"(POS={sent_counts.get('POS', 0)}, NEU={sent_counts.get('NEU', 0)}, NEG={sent_counts.get('NEG', 0)})"
        ]
        for r in reviews[:3]:
            text_preview = (r.text or "")[:80]
            review_lines.append(f"  - [{r.sentiment.value}] {text_preview}")
        sections.append("REVIEWS:\n" + "\n".join(review_lines))

    # --- Pending approvals ---
    pending = (
        db.query(Approval)
        .options(joinedload(Approval.action))
        .filter(Approval.business_id == bid, Approval.status == ApprovalStatus.PENDING)
        .all()
    )
    if pending:
        type_counts: dict[str, int] = {}
        for a in pending:
            if a.action:
                atype = a.action.type.value
            else:
                atype = "UNKNOWN"
            type_counts[atype] = type_counts.get(atype, 0) + 1
        approval_lines = [f"Pending approvals: {len(pending)}"]
        for atype, cnt in type_counts.items():
            approval_lines.append(f"  - {atype}: {cnt}")
        high_conf = [a for a in pending if a.confidence >= 80]
        if high_conf:
            approval_lines.append(f"High-confidence (>=80%): {len(high_conf)} items ready for approval")
        sections.append("PENDING APPROVALS:\n" + "\n".join(approval_lines))

    # --- Campaigns ---
    campaign_count = db.query(func.count(Campaign.id)).filter(Campaign.business_id == bid).scalar() or 0
    if campaign_count > 0:
        sections.append(f"CAMPAIGNS: {campaign_count} total")

    # --- Mentions ---
    mention_count = db.query(func.count(Mention.id)).filter(Mention.business_id == bid).scalar() or 0
    recent_mentions = (
        db.query(func.count(Mention.id))
        .filter(Mention.business_id == bid, Mention.fetched_at >= week_ago)
        .scalar() or 0
    )
    if mention_count > 0:
        sections.append(f"MENTIONS: {mention_count} total, {recent_mentions} from last 7 days")

    if not sections:
        return "\n\nSYSTEM STATE: No data yet. The user needs to run a market scan first."

    return "\n\nCURRENT SYSTEM STATE (real-time data):\n" + "\n\n".join(sections)


# ── Business context builder ──


def _build_business_context(biz: Business) -> str:
    """Build business profile context from model fields and client_metadata."""
    parts = [f"Business: {biz.name}"]
    if biz.category:
        parts.append(f"Industry: {biz.category}")
    if biz.location_text:
        parts.append(f"Location: {biz.location_text}")

    metadata = biz.client_metadata or {}
    if metadata.get("description"):
        parts.append(f"Description: {metadata['description']}")
    if metadata.get("services"):
        parts.append(f"Services: {metadata['services']}")
    if metadata.get("ideal_customer"):
        parts.append(f"Ideal customer: {metadata['ideal_customer']}")
    if metadata.get("differentiation"):
        parts.append(f"Differentiator: {metadata['differentiation']}")
    if metadata.get("tone"):
        parts.append(f"Preferred tone: {metadata['tone']}")
    if metadata.get("target_locations"):
        parts.append(f"Target locations: {metadata['target_locations']}")
    if metadata.get("keywords"):
        parts.append(f"Keywords: {metadata['keywords']}")
    if metadata.get("acquisition_channels"):
        parts.append(f"Growth channels: {', '.join(metadata['acquisition_channels'])}")

    return "\n".join(parts)


# ── System prompt ──


SYSTEM_PROMPT = """You are QuietEyes AI — an intelligent marketing operator for the business described below.

BUSINESS PROFILE:
{business_context}

{system_snapshot}

INSTRUCTIONS:
- You have access to REAL system data shown above. Always reference it in your answers.
- When asked about leads, trends, competitors, reviews — cite specific items, scores, and counts from the data above.
- When suggesting actions, be specific: "Approve the 3 high-confidence items" or "Create a campaign targeting PURCHASE leads with score > 60".
- Include relevant numbers: lead counts, scores, confidence percentages, trend spike scores.
- If the user asks to create something (campaign, audience, draft), explain what you would create and suggest they use the appropriate dashboard section.
- If no data exists yet, tell the user to run a market scan first.
- Be concise but data-rich. Use bullet points for lists.
- Match the business's preferred tone when possible.
- You can respond in the same language the user writes in (English or Hebrew).
- Never make up data. Only reference what is in CURRENT SYSTEM STATE above.
"""


CANNED_RESPONSES = [
    "I found a few interesting mentions for your business. Check the Recommended tab!",
    "I can help you draft a reply, create an audience segment, or export leads. What would you like?",
    "Here's a tip: review the Needs Approval section regularly to keep your outreach on track.",
    "I'm analyzing your latest mentions. I'll surface the best opportunities shortly.",
]


def _build_ai_response(biz: Business, db: Session, user_content: str) -> str:
    """Build a data-grounded AI response."""
    from app.ai import chat_completion

    # Build conversation history
    recent_msgs = (
        db.query(ChatMessage)
        .filter(ChatMessage.business_id == biz.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
        .all()
    )
    recent_msgs.reverse()

    # Build context
    business_context = _build_business_context(biz)
    system_snapshot = _build_system_snapshot(db, biz)

    system = SYSTEM_PROMPT.format(
        business_context=business_context,
        system_snapshot=system_snapshot,
    )

    # Build conversation for OpenAI
    messages_text = ""
    for msg in recent_msgs:
        role = "User" if msg.role == ChatRole.USER else "Assistant"
        messages_text += f"{role}: {msg.content}\n"
    messages_text += f"User: {user_content}"

    result = chat_completion(
        system,
        messages_text,
        max_tokens=800,
        temperature=0.5,  # Lower temp for more factual responses
    )
    if result:
        return result

    # Fallback
    msg_count = len(recent_msgs) + 1
    return CANNED_RESPONSES[(msg_count // 2) % len(CANNED_RESPONSES)]


# ── Endpoint ──


@router.post(
    "/businesses/{business_id}/chat",
    response_model=list[ChatMessageOut],
)
def chat(
    body: ChatMessageCreate,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    check_quota(db, biz.org_id, "chat")
    increment_usage(db, biz.org_id, "chat")

    user_msg = ChatMessage(business_id=biz.id, role=ChatRole.USER, content=body.content)
    db.add(user_msg)
    db.flush()

    response_text = _build_ai_response(biz, db, body.content)

    assistant_msg = ChatMessage(business_id=biz.id, role=ChatRole.ASSISTANT, content=response_text)
    db.add(assistant_msg)
    db.commit()

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.business_id == biz.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return history
