#!/usr/bin/env python3
"""Test connection to Supabase database."""

import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("Error: supabase package not installed")
    print("Run: pip install supabase")
    sys.exit(1)


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY environment variables required")
        print()
        print("Set them with:")
        print("  export SUPABASE_URL='https://xxxxx.supabase.co'")
        print("  export SUPABASE_KEY='eyJ...'")
        sys.exit(1)

    print(f"Connecting to: {url}")
    
    try:
        client = create_client(url, key)
        
        # Test by querying settings table
        result = client.table("settings").select("*").execute()
        
        print("✓ Connection successful!")
        print(f"  Found {len(result.data)} settings")
        
        # Show neighborhoods
        neighborhoods = client.table("neighborhoods").select("*").execute()
        print(f"  Found {len(neighborhoods.data)} neighborhoods")
        
        for n in neighborhoods.data:
            status = "active" if n.get("is_active") else "inactive"
            print(f"    - {n.get('name')} ({status})")
        
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
