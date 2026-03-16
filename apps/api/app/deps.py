import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import decode_token
from app.database import get_db
from app.models import Business, BusinessAccess, Permission, RolePermission, User, UserRole

bearer_scheme = HTTPBearer()

# Default permissions per role (used when no org-specific overrides exist)
DEFAULT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    UserRole.OWNER.value: {p.value for p in Permission},
    UserRole.ADMIN.value: {p.value for p in Permission},
    UserRole.MEMBER.value: {
        Permission.VIEW_FEED.value,
        Permission.MANAGE_CAMPAIGNS.value,
        Permission.MANAGE_PLAYBOOKS.value,
    },
    UserRole.ANALYST.value: {
        Permission.VIEW_FEED.value,
    },
    UserRole.MARKETING_MANAGER.value: {
        Permission.VIEW_FEED.value,
        Permission.MANAGE_CAMPAIGNS.value,
        Permission.MANAGE_PLAYBOOKS.value,
        Permission.MANAGE_AUTOPILOT.value,
    },
    UserRole.APPROVER.value: {
        Permission.VIEW_FEED.value,
        Permission.APPROVE_ACTIONS.value,
    },
    UserRole.BILLING_ADMIN.value: {
        Permission.VIEW_FEED.value,
        Permission.MANAGE_BILLING.value,
    },
    UserRole.CLIENT_VIEWER.value: {
        Permission.VIEW_FEED.value,
    },
}


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_business_scoped(
    business_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Business:
    biz = db.get(Business, business_id)
    if not biz or biz.org_id != user.org_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    # OWNER and ADMIN have access to all businesses in their org
    if user.role in (UserRole.OWNER, UserRole.ADMIN):
        return biz

    # Other roles need explicit access grant
    has_access = (
        db.query(BusinessAccess)
        .filter(
            BusinessAccess.user_id == user.id,
            BusinessAccess.business_id == biz.id,
        )
        .first()
    )
    if not has_access:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this business")

    return biz


def require_role(*roles: UserRole):
    """Dependency factory: raises 403 if user role is not in the allowed set."""
    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role {user.role.value} not permitted",
            )
        return user
    return _check


def _get_user_permissions(db: Session, user: User) -> set[str]:
    """Get effective permissions for a user: org overrides > defaults."""
    org_perms = (
        db.query(RolePermission.permission)
        .filter(
            RolePermission.org_id == user.org_id,
            RolePermission.role == user.role.value,
        )
        .all()
    )
    if org_perms:
        return {row[0] for row in org_perms}
    return DEFAULT_ROLE_PERMISSIONS.get(user.role.value, set())


def require_permission(*permissions: Permission):
    """Dependency factory: raises 403 if user doesn't have the required permission."""
    def _check(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_perms = _get_user_permissions(db, user)
        required = {p.value for p in permissions}
        if not required.issubset(user_perms):
            missing = required - user_perms
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {', '.join(missing)}",
            )
        return user
    return _check
