import os
import shutil
import tempfile
import zipfile
import uuid
import sys
import mysql.connector
from mysql.connector import Error
from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Request, Form, Depends
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from main import generate_llm_analysis, create_word_doc
from src.data_loader import load_and_process_data
from auth import router as auth_router, get_current_user, get_db

app = FastAPI(title="ByTE Report Generator API")
app.include_router(auth_router)

# Setup templates and static files
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/assets", StaticFiles(directory="assets"), name="assets")
templates = Jinja2Templates(directory="templates")

# Ensure temporary and persistent directories exist
TEMP_BASE_DIR = os.path.join(tempfile.gettempdir(), "byte_reports")
PERSISTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage", "reports")
os.makedirs(TEMP_BASE_DIR, exist_ok=True)
os.makedirs(PERSISTENT_DIR, exist_ok=True)

def cleanup_files(*paths):
    """Cleanup temporary files and directories."""
    for path in paths:
        try:
            if os.path.isfile(path):
                os.remove(path)
            elif os.path.isdir(path):
                shutil.rmtree(path)
        except Exception as e:
            print(f"Error during cleanup of {path}: {e}")

@app.get("/")
async def root():
    return {"message": "Backend is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/contact")
async def contact(request: Request):
    data = await request.json()
    name = data.get("name")
    email = data.get("email")
    message = data.get("message")
    
    # In a real app, you would send an email or save to a database here.
    # For now, we'll just log it to the console.
    print(f"Contact form submission received:")
    print(f"  Name: {name}")
    print(f"  Email: {email}")
    print(f"  Message: {message}")
    
    return {"status": "success", "message": "Your message has been received. Thank you!"}

@app.post("/generate-reports")
async def generate_reports(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    count: int = Form(None),
    current_user: dict = Depends(get_current_user),
    db: mysql.connector.MySQLConnection = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel or CSV file.")

    # Create a unique request ID and temp folders
    request_id = str(uuid.uuid4())
    request_dir = os.path.join(TEMP_BASE_DIR, request_id)
    input_dir = os.path.join(request_dir, "input")
    output_dir = os.path.join(request_dir, "output")
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    # Save uploaded file
    file_path = os.path.join(input_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Load and process data
        students, class_avg, internal_class = load_and_process_data(file_path)
        if not students:
            raise Exception("No student data found in the uploaded file.")

        # Apply report count limit if specified
        if count is not None and count > 0:
            students = students[:count]

        final_class_name = internal_class if internal_class else os.path.splitext(file.filename)[0]

        # Generate reports (Limited to a few for testing if needed, but here we process all)
        # However, for API we might want to avoid long timeouts. 
        # For now, we process all but you might want to consider async processing if the list is huge.
        for idx, student in enumerate(students, 1):
            name = student.get('name', 'Unknown')
            analysis, meta = generate_llm_analysis(student, name, final_class_name)
            if analysis:
                create_word_doc(name, analysis, final_class_name, student, class_avg, output_dir=output_dir)
            else:
                print(f"Failed to generate analysis for: {name}")

        # Create ZIP file in permanent storage
        zip_filename = f"{final_class_name}_Reports.zip"
        storage_filename = f"{current_user['id']}_{request_id}_{zip_filename}"
        zip_path = os.path.join(PERSISTENT_DIR, storage_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(output_dir):
                for f in files:
                    zipf.write(os.path.join(root, f), f)

        # Connect to DB and save document
        cursor = db.cursor()
        cursor.execute("INSERT INTO reports (user_id, file_name, file_key, file_url) VALUES (%s, %s, %s, %s)", 
                       (current_user['id'], zip_filename, storage_filename, zip_path))
        db.commit()

        # Schedule cleanup only for temps
        background_tasks.add_task(cleanup_files, request_dir)

        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type="application/zip"
        )

    except Exception as e:
        cleanup_files(request_dir)
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/my-reports")
def my_reports(current_user: dict = Depends(get_current_user), db: mysql.connector.MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, file_name as filename, created_at FROM reports WHERE user_id=%s ORDER BY created_at DESC", (current_user['id'],))
    records = cursor.fetchall()
    docs = [{"id": r["id"], "filename": r["filename"], "created_at": r["created_at"]} for r in records]
    return docs

@app.get("/download-report/{doc_id}")
def download_report(doc_id: int, current_user: dict = Depends(get_current_user), db: mysql.connector.MySQLConnection = Depends(get_db)):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM reports WHERE id=%s AND user_id=%s", (doc_id, current_user['id']))
    doc = cursor.fetchone()
    
    if not doc or not os.path.exists(doc["file_url"]):
        raise HTTPException(status_code=404, detail="Document not found or deleted")
        
    return FileResponse(path=doc["file_url"], filename=doc["file_name"], media_type="application/zip")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)