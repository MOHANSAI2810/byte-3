import streamlit as st
import os
import sys
import shutil
import zipfile
import tempfile
import threading
import queue
import time
from datetime import datetime
from io import BytesIO

# ─────────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="Student Report Generator",
    page_icon="📋",
    layout="centered"
)

# ─────────────────────────────────────────────
# STYLING
# ─────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');

    html, body, [class*="css"] {
        font-family: 'DM Sans', sans-serif;
    }

    .main { background-color: #f7f8fa; }

    .block-container {
        padding-top: 2.5rem;
        padding-bottom: 2.5rem;
        max-width: 720px;
    }

    h1 {
        font-size: 1.8rem !important;
        font-weight: 600 !important;
        color: #1a1f36 !important;
        letter-spacing: -0.5px;
    }

    .subtitle {
        color: #6b7280;
        font-size: 0.95rem;
        margin-top: -0.5rem;
        margin-bottom: 2rem;
    }

    .section-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.2rem;
    }

    .section-label {
        font-size: 0.78rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #9ca3af;
        margin-bottom: 0.6rem;
    }

    .log-box {
        background: #0f1117;
        border-radius: 8px;
        padding: 1rem 1.2rem;
        font-family: 'DM Mono', monospace;
        font-size: 0.78rem;
        color: #a3e635;
        min-height: 120px;
        max-height: 300px;
        overflow-y: auto;
        white-space: pre-wrap;
        line-height: 1.6;
    }

    .status-badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .status-ready   { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
    .status-running { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
    .status-done    { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
    .status-error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

    .stButton > button {
        background: #1a1f36 !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 0.55rem 1.4rem !important;
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 500 !important;
        font-size: 0.9rem !important;
        width: 100%;
        transition: opacity 0.2s;
    }

    .stButton > button:hover { opacity: 0.85; }

    .stDownloadButton > button {
        background: #2563eb !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 0.55rem 1.4rem !important;
        font-family: 'DM Sans', sans-serif !important;
        font-weight: 500 !important;
        width: 100%;
    }

    .stFileUploader {
        border: 2px dashed #d1d5db !important;
        border-radius: 10px !important;
        background: #fafafa !important;
    }

    div[data-testid="stFileUploader"] label { display: none; }

    hr { border: none; border-top: 1px solid #f3f4f6; margin: 1.2rem 0; }
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def zip_folder(folder_path: str) -> BytesIO:
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in os.listdir(folder_path):
            fpath = os.path.join(folder_path, fname)
            if os.path.isfile(fpath):
                zf.write(fpath, arcname=fname)
    buf.seek(0)
    return buf


def run_generation(input_path: str, output_base: str, log_queue: queue.Queue):
    """Runs in a background thread. Puts log lines into log_queue."""
    try:
        # Patch sys.path so imports work
        script_dir = os.path.dirname(os.path.abspath(__file__))
        if script_dir not in sys.path:
            sys.path.insert(0, script_dir)

        # Redirect logging to queue
        import logging

        class QueueHandler(logging.Handler):
            def emit(self, record):
                log_queue.put(self.format(record))

        # Import main module functions
        import importlib.util
        main_path = os.path.join(script_dir, "main.py")
        spec = importlib.util.spec_from_file_location("main_module", main_path)
        main_module = importlib.util.module_from_spec(spec)

        # Inject queue handler before loading
        q_handler = QueueHandler()
        q_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

        # Patch the root logger
        root_logger = logging.getLogger()
        root_logger.addHandler(q_handler)

        spec.loader.exec_module(main_module)

        # Override output folder to our temp session folder
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_folder = os.path.join(output_base, session_id)
        os.makedirs(session_folder, exist_ok=True)

        # Copy input file to expected input folder
        input_folder = os.path.join(script_dir, "input")
        os.makedirs(input_folder, exist_ok=True)
        dest = os.path.join(input_folder, os.path.basename(input_path))
        shutil.copy2(input_path, dest)

        # Run main
        main_module.main()

        log_queue.put("__DONE__:" + session_folder)

    except Exception as e:
        log_queue.put(f"[ERROR] {e}")
        log_queue.put("__ERROR__")


# ─────────────────────────────────────────────
# SESSION STATE
# ─────────────────────────────────────────────
for key, default in {
    "logs": [],
    "status": "idle",
    "zip_buf": None,
    "zip_name": None,
}.items():
    if key not in st.session_state:
        st.session_state[key] = default


# ─────────────────────────────────────────────
# HEADER
# ─────────────────────────────────────────────
st.markdown("# 📋 Student Report Generator")
st.markdown('<p class="subtitle">Upload your class data file and generate co-curricular reports for every student.</p>', unsafe_allow_html=True)


# ─────────────────────────────────────────────
# UPLOAD SECTION
# ─────────────────────────────────────────────
st.markdown('<div class="section-card">', unsafe_allow_html=True)
st.markdown('<div class="section-label">Step 1 — Upload Data File</div>', unsafe_allow_html=True)

uploaded_file = st.file_uploader(
    label="Upload file",
    type=["xlsx", "xls", "csv"],
    label_visibility="collapsed"
)

if uploaded_file:
    st.success(f"✓ **{uploaded_file.name}** uploaded ({uploaded_file.size // 1024} KB)")

st.markdown('</div>', unsafe_allow_html=True)


# ─────────────────────────────────────────────
# GENERATE SECTION
# ─────────────────────────────────────────────
st.markdown('<div class="section-card">', unsafe_allow_html=True)
st.markdown('<div class="section-label">Step 2 — Generate Reports</div>', unsafe_allow_html=True)

# Status badge
status_map = {
    "idle":    ("Ready", "status-ready"),
    "running": ("Processing…", "status-running"),
    "done":    ("Complete", "status-done"),
    "error":   ("Error", "status-error"),
}
label, css = status_map[st.session_state.status]
st.markdown(f'<span class="status-badge {css}">{label}</span>', unsafe_allow_html=True)
st.markdown("<br>", unsafe_allow_html=True)

generate_clicked = st.button(
    "⚡ Generate Reports",
    disabled=(uploaded_file is None or st.session_state.status == "running")
)

st.markdown('</div>', unsafe_allow_html=True)


# ─────────────────────────────────────────────
# RUN LOGIC
# ─────────────────────────────────────────────
if generate_clicked and uploaded_file:
    st.session_state.status = "running"
    st.session_state.logs = ["Starting report generation…"]
    st.session_state.zip_buf = None

    # Save uploaded file to temp location
    tmp_dir = tempfile.mkdtemp()
    input_path = os.path.join(tmp_dir, uploaded_file.name)
    with open(input_path, "wb") as f:
        f.write(uploaded_file.getbuffer())

    output_base = os.path.join(tmp_dir, "output")
    os.makedirs(output_base, exist_ok=True)

    log_q = queue.Queue()
    t = threading.Thread(
        target=run_generation,
        args=(input_path, output_base, log_q),
        daemon=True
    )
    t.start()

    # Stream logs live
    log_placeholder = st.empty()
    session_folder = None

    while t.is_alive() or not log_q.empty():
        while not log_q.empty():
            line = log_q.get()
            if line.startswith("__DONE__:"):
                session_folder = line.split(":", 1)[1]
                st.session_state.status = "done"
            elif line == "__ERROR__":
                st.session_state.status = "error"
            else:
                st.session_state.logs.append(line)

        log_placeholder.markdown(
            f'<div class="log-box">' +
            "\n".join(st.session_state.logs[-40:]) +
            '</div>',
            unsafe_allow_html=True
        )
        time.sleep(0.3)

    # Build ZIP
    if session_folder and os.path.exists(session_folder):
        st.session_state.zip_buf = zip_folder(session_folder)
        st.session_state.zip_name = f"reports_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

    st.rerun()


# ─────────────────────────────────────────────
# LOG OUTPUT (persistent after run)
# ─────────────────────────────────────────────
if st.session_state.logs:
    st.markdown('<div class="section-card">', unsafe_allow_html=True)
    st.markdown('<div class="section-label">Run Log</div>', unsafe_allow_html=True)
    st.markdown(
        '<div class="log-box">' + "\n".join(st.session_state.logs[-60:]) + '</div>',
        unsafe_allow_html=True
    )
    st.markdown('</div>', unsafe_allow_html=True)


# ─────────────────────────────────────────────
# DOWNLOAD SECTION
# ─────────────────────────────────────────────
if st.session_state.zip_buf and st.session_state.status == "done":
    st.markdown('<div class="section-card">', unsafe_allow_html=True)
    st.markdown('<div class="section-label">Step 3 — Download Reports</div>', unsafe_allow_html=True)
    st.markdown("All reports are packaged into a single ZIP file, ready to download.")

    st.download_button(
        label="⬇️ Download All Reports (.zip)",
        data=st.session_state.zip_buf,
        file_name=st.session_state.zip_name,
        mime="application/zip"
    )
    st.markdown('</div>', unsafe_allow_html=True)