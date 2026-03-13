"""
CLI for manual operations. Run via: python -m app.cli <command> [args]
"""

import asyncio
import json
import sys
import uuid


def cmd_ingest(business_id_str: str):
    from app.ingestion.engine import ingest_for_business

    bid = uuid.UUID(business_id_str)
    result = asyncio.run(ingest_for_business(bid))
    print(json.dumps(result, indent=2))


def cmd_ingest_all():
    from app.ingestion.engine import ingest_all_businesses

    results = asyncio.run(ingest_all_businesses())
    print(json.dumps(results, indent=2))


def cmd_generate_leads(business_id_str: str):
    from app.database import SessionLocal
    from app.ingestion.lead_engine import generate_leads_for_business

    bid = uuid.UUID(business_id_str)
    db = SessionLocal()
    try:
        result = generate_leads_for_business(db, bid)
        print(json.dumps(result, indent=2))
    finally:
        db.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.cli <command> [args]")
        print("Commands: ingest <id>, ingest-all, generate-leads <id>")
        sys.exit(1)

    command = sys.argv[1]
    if command == "ingest":
        if len(sys.argv) < 3:
            print("Usage: python -m app.cli ingest <business-uuid>")
            sys.exit(1)
        cmd_ingest(sys.argv[2])
    elif command == "ingest-all":
        cmd_ingest_all()
    elif command == "generate-leads":
        if len(sys.argv) < 3:
            print("Usage: python -m app.cli generate-leads <business-uuid>")
            sys.exit(1)
        cmd_generate_leads(sys.argv[2])
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
