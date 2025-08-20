from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import io, uuid, asyncio
from datetime import datetime
from PIL import Image, ImageEnhance, ImageFilter

app = FastAPI(title="AI Image Enhancement API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # set specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

processing_jobs = {}
enhanced_images = {}

def enhance_image(image: Image.Image) -> Image.Image:
    max_size = 2048
    if max(image.size) > max_size:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    img = image.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
    img = ImageEnhance.Contrast(img).enhance(1.2)
    img = ImageEnhance.Color(img).enhance(1.1)
    img = ImageEnhance.Brightness(img).enhance(1.05)
    return img

async def process_with_progress(job_id: str, image: Image.Image):
    processing_jobs[job_id] = {"status":"analyzing","progress":10,"message":"Analyzing image...","created_at":datetime.now().isoformat()}
    await asyncio.sleep(1)
    processing_jobs[job_id].update({"status":"enhancing","progress":45,"message":"Enhancing quality..."})
    await asyncio.sleep(1.5)
    processing_jobs[job_id].update({"status":"finalizing","progress":80,"message":"Applying AI enhancements..."})
    enhanced = enhance_image(image)
    await asyncio.sleep(0.8)
    buf = io.BytesIO()
    enhanced.save(buf, format="PNG", quality=95)
    buf.seek(0)
    enhanced_images[job_id] = buf.getvalue()
    processing_jobs[job_id].update({"status":"completed","progress":100,"message":"Done"})

@app.get("/health")
async def health():
    return {"status":"healthy","timestamp":datetime.now().isoformat()}

@app.post("/api/refine")
async def refine(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    if image.mode != "RGB":
        image = image.convert("RGB")
    job_id = str(uuid.uuid4())
    asyncio.create_task(process_with_progress(job_id, image))
    return {"job_id":job_id,"status":"started","message":"Image enhancement started"}

@app.get("/api/status/{job_id}")
async def status(job_id: str):
    if job_id not in processing_jobs:
        raise HTTPException(404,"Job not found")
    return processing_jobs[job_id]

@app.get("/api/result/{job_id}")
async def result(job_id: str):
    if job_id not in processing_jobs:
        raise HTTPException(404,"Job not found")
    if processing_jobs[job_id]["status"] != "completed":
        raise HTTPException(400,"Processing not completed yet")
    data = enhanced_images.get(job_id)
    if not data:
        raise HTTPException(404,"Enhanced image not found")
    return StreamingResponse(io.BytesIO(data), media_type="image/png", headers={"Content-Disposition":"attachment; filename=enhanced.png"})
