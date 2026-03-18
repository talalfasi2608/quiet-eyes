import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.database import Base
from app.models import *  # noqa: F401,F403


# Monkey-patch PostgreSQL ENUM to always check if the type exists before
# creating it. This prevents "type already exists" errors when multiple
# migrations define the same enum types via sa.Enum in create_table.
from sqlalchemy.dialects.postgresql.named_types import ENUM as _PG_ENUM
_orig_create = _PG_ENUM.create
def _safe_create(self, bind=None, checkfirst=True):
    return _orig_create(self, bind=bind, checkfirst=True)
_PG_ENUM.create = _safe_create

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

db_url = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))
config.set_main_option("sqlalchemy.url", db_url)

target_metadata = Base.metadata


def run_migrations_offline():
    context.configure(url=db_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
