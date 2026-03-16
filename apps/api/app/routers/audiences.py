import csv
import hashlib
import io
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_business_scoped, get_current_user
from app.quota import check_quota, increment_usage
from app.models import (
    Action,
    ActionType,
    Approval,
    ApprovalStatus,
    Audience,
    AuditLog,
    Business,
    Export,
    ExportStatus,
    ExportType,
    Lead,
    RiskLevel,
    User,
)
from app.schemas import (
    AudienceDraftRequest,
    AudienceOut,
    ApprovalOut,
    ExportCreateRequest,
    ExportOut,
)

router = APIRouter(tags=["audiences"])

EXPORT_DIR = os.environ.get("EXPORT_DIR", "/tmp/quieteyes_exports")


# ── Audience draft ──


@router.post(
    "/businesses/{business_id}/audiences/draft",
    response_model=ApprovalOut,
    status_code=201,
)
def create_audience_draft(
    body: AudienceDraftRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    audience = Audience(
        business_id=biz.id,
        name=body.name,
        definition=body.definition,
    )
    db.add(audience)
    db.flush()

    action = Action(
        business_id=biz.id,
        type=ActionType.AUDIENCE_DRAFT,
        payload={
            "audience_id": str(audience.id),
            "audience_name": body.name,
            "definition": body.definition,
        },
    )
    db.add(action)
    db.flush()

    approval = Approval(
        business_id=biz.id,
        action_id=action.id,
        status=ApprovalStatus.PENDING,
        risk=RiskLevel.MEDIUM,
        cost_impact=0,
        confidence=80,
        requires_human=True,
    )
    db.add(approval)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="ACTION_CREATED",
        entity_type="action",
        entity_id=action.id,
        meta={"action_type": "AUDIENCE_DRAFT", "audience_name": body.name},
    ))

    db.commit()
    db.refresh(approval)
    approval.action = action
    return approval


@router.get(
    "/businesses/{business_id}/audiences",
    response_model=list[AudienceOut],
)
def list_audiences(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(Audience)
        .filter(Audience.business_id == biz.id)
        .order_by(Audience.created_at.desc())
        .limit(50)
        .all()
    )


# ── Export ──


@router.post(
    "/businesses/{business_id}/exports",
    response_model=ApprovalOut,
    status_code=201,
)
def create_export(
    body: ExportCreateRequest,
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    check_quota(db, biz.org_id, "export")
    # Validate audience if provided
    if body.audience_id:
        aud = db.get(Audience, body.audience_id)
        if not aud or aud.business_id != biz.id:
            raise HTTPException(status_code=404, detail="Audience not found")

    export = Export(
        business_id=biz.id,
        audience_id=body.audience_id,
        type=body.type,
        status=ExportStatus.PENDING,
    )
    db.add(export)
    db.flush()

    action = Action(
        business_id=biz.id,
        type=ActionType.EXPORT,
        payload={
            "export_id": str(export.id),
            "export_type": body.type.value,
            "audience_id": str(body.audience_id) if body.audience_id else None,
        },
    )
    db.add(action)
    db.flush()

    approval = Approval(
        business_id=biz.id,
        action_id=action.id,
        status=ApprovalStatus.PENDING,
        risk=RiskLevel.LOW,
        cost_impact=0,
        confidence=90,
        requires_human=True,
    )
    db.add(approval)

    db.add(AuditLog(
        org_id=biz.org_id,
        user_id=user.id,
        event_type="ACTION_CREATED",
        entity_type="action",
        entity_id=action.id,
        meta={"action_type": "EXPORT", "export_id": str(export.id)},
    ))

    db.commit()
    db.refresh(approval)
    approval.action = action
    return approval


@router.get(
    "/businesses/{business_id}/exports",
    response_model=list[ExportOut],
)
def list_exports(
    biz: Business = Depends(get_business_scoped),
    db: Session = Depends(get_db),
):
    return (
        db.query(Export)
        .filter(Export.business_id == biz.id)
        .order_by(Export.created_at.desc())
        .limit(50)
        .all()
    )


@router.get("/exports/{export_id}/download")
def download_export(
    export_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    export = db.get(Export, export_id)
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")
    biz = db.get(Business, export.business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=404, detail="Export not found")
    if export.status != ExportStatus.READY or not export.file_path:
        raise HTTPException(status_code=400, detail="Export is not ready")

    if not os.path.isfile(export.file_path):
        raise HTTPException(status_code=404, detail="Export file not found")

    def iter_file():
        with open(export.file_path, "rb") as f:
            while chunk := f.read(8192):
                yield chunk

    filename = os.path.basename(export.file_path)
    return StreamingResponse(
        iter_file(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Export execution (called from approval flow) ──


def _sha256_hash(value: str) -> str:
    return hashlib.sha256(value.strip().lower().encode()).hexdigest()


def execute_export(db: Session, export_id: uuid.UUID) -> None:
    """Generate the CSV file for an approved export."""
    export = db.get(Export, export_id)
    if not export:
        return

    os.makedirs(EXPORT_DIR, exist_ok=True)

    # Gather leads for this business (optionally filtered by audience definition)
    query = db.query(Lead).filter(Lead.business_id == export.business_id)

    if export.audience_id:
        audience = db.get(Audience, export.audience_id)
        if audience and audience.definition:
            defn = audience.definition
            if "intents" in defn:
                query = query.filter(Lead.intent.in_(defn["intents"]))
            if "min_score" in defn:
                query = query.filter(Lead.score >= defn["min_score"])
            if "min_confidence" in defn:
                query = query.filter(Lead.confidence >= defn["min_confidence"])

    leads = query.order_by(Lead.score.desc()).limit(1000).all()

    is_hashed = export.type == ExportType.HASHED_CSV

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["lead_id", "intent", "score", "confidence", "title", "snippet", "url"])

    for lead in leads:
        mention = lead.mention
        title = mention.title if mention else ""
        snippet = mention.snippet if mention else ""
        url = mention.url if mention else ""

        if is_hashed:
            title = _sha256_hash(title or "")
            snippet = _sha256_hash(snippet or "")
            url = _sha256_hash(url or "")

        writer.writerow([
            str(lead.id),
            lead.intent.value,
            lead.score,
            lead.confidence,
            title,
            snippet,
            url,
        ])

    filename = f"{export.business_id}_{export.id}.csv"
    filepath = os.path.join(EXPORT_DIR, filename)
    with open(filepath, "w", newline="") as f:
        f.write(buf.getvalue())

    export.file_path = filepath
    export.status = ExportStatus.READY

    # Increment export usage counter
    biz = db.get(Business, export.business_id)
    if biz:
        increment_usage(db, biz.org_id, "export")

    db.commit()
