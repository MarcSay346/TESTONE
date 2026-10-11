import os, ssl
from urllib.parse import urlparse
from dotenv import load_dotenv
import pg8000.dbapi

load_dotenv()
u = urlparse(os.getenv("DATABASE_URL"))

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE   # still encrypted, just skips cert check (same as sslmode=require)

conn = pg8000.dbapi.connect(
    user=u.username,
    password=u.password,
    host=u.hostname,
    port=u.port,
    database=u.path.lstrip("/"),
    ssl_context=ctx,
)
cur = conn.cursor()
cur.execute("SELECT version();")
print("Connected!", cur.fetchone()[0])
conn.close()