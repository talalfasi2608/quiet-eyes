from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped
from app.models import Business, ChatMessage, ChatRole
from app.quota import check_quota, increment_usage
from app.schemas import ChatMessageCreate, ChatMessageOut

router = APIRouter(tags=["chat"])

CANNED_RESPONSES = [
    "I found a few interesting mentions for your business. Check the Recommended tab!",
    "I can help you draft a reply, create an audience segment, or export leads. What would you like?",
    "Here's a tip: review the Needs Approval section regularly to keep your outreach on track.",
    "I'm analyzing your latest mentions. I'll surface the best opportunities shortly.",
]


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

    msg_count = db.query(ChatMessage).filter(ChatMessage.business_id == biz.id).count()
    canned = CANNED_RESPONSES[(msg_count // 2) % len(CANNED_RESPONSES)]

    assistant_msg = ChatMessage(business_id=biz.id, role=ChatRole.ASSISTANT, content=canned)
    db.add(assistant_msg)
    db.commit()

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.business_id == biz.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return history
