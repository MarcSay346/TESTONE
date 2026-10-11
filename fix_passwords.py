import os, ssl
from urllib.parse import urlparse
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import pg8000.dbapi

load_dotenv()
u = urlparse(os.getenv("DATABASE_URL"))
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

conn = pg8000.dbapi.connect(user=u.username, password=u.password, host=u.hostname,
                            port=u.port, database=u.path.lstrip("/"), ssl_context=ctx)
cur = conn.cursor()
cur.execute("UPDATE accounts SET password_hash = %s WHERE password_hash = 'test'",
            (generate_password_hash("test"),))
print("Updated", cur.rowcount, "accounts")
conn.commit()
conn.close()