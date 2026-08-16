from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"msg": "ok"}

client = TestClient(app)
response = client.options("/", headers={"Origin": "https://random-domain.com", "Access-Control-Request-Method": "GET"})
print("OPTIONS status:", response.status_code)
print("OPTIONS headers:", response.headers.get("access-control-allow-origin"))

response2 = client.get("/", headers={"Origin": "https://random-domain.com"})
print("GET status:", response2.status_code)
print("GET headers:", response2.headers.get("access-control-allow-origin"))
