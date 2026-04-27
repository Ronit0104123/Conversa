import httpx
import asyncio

async def main():
    async with httpx.AsyncClient(follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as client:
        response = await client.get("https://100x.bot")
        print(f"Status: {response.status_code}")
        print(f"Length: {len(response.text)}")
        with open("test_100x.html", "w") as f:
            f.write(response.text)

asyncio.run(main())
