import base64
import os
import hashlib
from cryptography.fernet import Fernet

# Derive a consistent Fernet key from an app secret or environment
_SECRET = os.environ.get("AEGIS_ENCRYPTION_SECRET", "aegis_tilt_master_broker_encryption_secret_2026")
_KEY = base64.urlsafe_b64encode(hashlib.sha256(_SECRET.encode()).digest())
_cipher = Fernet(_KEY)

def encrypt_credential(plain_text: str) -> str:
    """Encrypts sensitive broker credential (API key, token, TOTP) using AES-128-CBC via Fernet."""
    if not plain_text:
        return ""
    try:
        return _cipher.encrypt(plain_text.encode('utf-8')).decode('utf-8')
    except Exception as e:
        return plain_text

def decrypt_credential(cipher_text: str) -> str:
    """Decrypts encrypted credential back to plaintext."""
    if not cipher_text:
        return ""
    try:
        return _cipher.decrypt(cipher_text.encode('utf-8')).decode('utf-8')
    except Exception:
        # If decryption fails (e.g. unencrypted mock key in dev), return as-is
        return cipher_text

def mask_credential(credential: str) -> str:
    """Masks a credential for UI display, e.g. 'dhan_sec_...9f4'"""
    if not credential:
        return ""
    if len(credential) <= 8:
        return "••••••••"
    return f"{credential[:4]}••••••••{credential[-4:]}"
