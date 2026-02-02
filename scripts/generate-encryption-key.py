#!/usr/bin/env python3
"""Generate a Fernet encryption key for session cookie encryption."""

from cryptography.fernet import Fernet

if __name__ == "__main__":
    key = Fernet.generate_key()
    print("Generated Fernet encryption key:")
    print(key.decode())
    print()
    print("Add this to your GitHub Secrets as SESSION_ENCRYPTION_KEY")
