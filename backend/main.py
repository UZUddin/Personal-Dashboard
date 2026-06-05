from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from datetime import datetime, date
from typing import Optional
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Weather (Open-Meteo — no API key needed) ──────────────────────────────────
@app.get("/weather")
async def get_weather(lat: float = 33.749, lon: float = -84.388, city: str = "Atlanta"):
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m,apparent_temperature"
        f"&daily=weathercode,temperature_2m_max,temperature_2m_min"
        f"&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=5&timezone=auto"
    )
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=10)
    if r.status_code != 200:
        raise HTTPException(502, "Weather API error")
    data = r.json()
    cur = data["current"]
    daily = data["daily"]

    wmo_map = {
        0: ("Clear sky", "☀️"), 1: ("Mainly clear", "🌤️"), 2: ("Partly cloudy", "⛅"),
        3: ("Overcast", "☁️"), 45: ("Foggy", "🌫️"), 48: ("Icy fog", "🌫️"),
        51: ("Light drizzle", "🌦️"), 53: ("Drizzle", "🌦️"), 55: ("Heavy drizzle", "🌧️"),
        61: ("Light rain", "🌧️"), 63: ("Rain", "🌧️"), 65: ("Heavy rain", "🌧️"),
        71: ("Light snow", "🌨️"), 73: ("Snow", "❄️"), 75: ("Heavy snow", "❄️"),
        80: ("Rain showers", "🌦️"), 81: ("Showers", "🌧️"), 82: ("Heavy showers", "⛈️"),
        95: ("Thunderstorm", "⛈️"), 96: ("Thunderstorm w/ hail", "⛈️"),
    }

    def wmo(code):
        return wmo_map.get(code, ("Unknown", "🌡️"))

    desc, icon = wmo(cur["weathercode"])
    forecast = []
    for i in range(5):
        d, fi = wmo(daily["weathercode"][i])
        forecast.append({
            "date": daily["time"][i],
            "desc": d,
            "icon": fi,
            "high": round(daily["temperature_2m_max"][i]),
            "low": round(daily["temperature_2m_min"][i]),
        })

    return {
        "city": city,
        "temp": round(cur["temperature_2m"]),
        "feels_like": round(cur["apparent_temperature"]),
        "humidity": cur["relative_humidity_2m"],
        "wind": round(cur["windspeed_10m"]),
        "desc": desc,
        "icon": icon,
        "forecast": forecast,
    }


# ── Prayer Times (Aladhan — no API key needed) ────────────────────────────────
@app.get("/prayer-times")
async def get_prayer_times(lat: float = 33.749, lon: float = -84.388):
    today = date.today()
    url = (
        f"https://api.aladhan.com/v1/timings/{today.day}-{today.month}-{today.year}"
        f"?latitude={lat}&longitude={lon}&method=2"
    )
    async with httpx.AsyncClient() as client:
        r = await client.get(url, timeout=10)
    if r.status_code != 200:
        raise HTTPException(502, "Prayer times API error")
    timings = r.json()["data"]["timings"]
    prayers = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]
    return {
        "date": today.isoformat(),
        "timings": {p: timings[p] for p in prayers},
    }


# ── Quote of the Day (ZenQuotes — free) ──────────────────────────────────────
@app.get("/quote")
async def get_quote():
    async with httpx.AsyncClient() as client:
        r = await client.get("https://zenquotes.io/api/today", timeout=10)
    if r.status_code != 200:
        raise HTTPException(502, "Quote API error")
    data = r.json()[0]
    return {"quote": data["q"], "author": data["a"]}


# ── To-Dos (in-memory, persists per server process) ──────────────────────────
_todos: list[dict] = []
_todo_id = 0

@app.get("/todos")
def get_todos():
    return _todos

@app.post("/todos")
def add_todo(body: dict):
    global _todo_id
    _todo_id += 1
    todo = {"id": _todo_id, "text": body.get("text", ""), "done": False}
    _todos.append(todo)
    return todo

@app.patch("/todos/{todo_id}")
def toggle_todo(todo_id: int):
    for t in _todos:
        if t["id"] == todo_id:
            t["done"] = not t["done"]
            return t
    raise HTTPException(404, "Not found")

@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: int):
    global _todos
    _todos = [t for t in _todos if t["id"] != todo_id]
    return {"ok": True}


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "time": datetime.now().isoformat()}
