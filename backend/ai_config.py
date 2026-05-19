import json
import os
import re

import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")
# Default to Ollama for local chat; set USE_OLLAMA=false to use Groq for chat as well.
USE_OLLAMA = os.getenv("USE_OLLAMA", "true").lower() == "true"

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "mistralai/mistral-7b-instruct-v0.3")
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_CHAT_COMPLETIONS_URL = os.getenv(
    "GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_BACKUP = os.getenv("GEMINI_API_KEY_BACKUP", "AIzaSyB95_DTGGZDjfLM-B2xzw_kywb8iLbubME")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
CEREBRAS_MODEL = os.getenv("CEREBRAS_MODEL", "llama3.1-8b")
CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"


def _extract_ollama_text(payload: dict) -> str:
    text = payload.get("response", "")
    if isinstance(text, str) and text.strip():
        return text.strip()
    message = payload.get("message", {})
    if isinstance(message, dict):
        content = message.get("content", "")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


def _extract_last_student_message(prompt: str) -> str:
    matches = re.findall(r"STUDENT:\s*(.*)", prompt)
    if not matches:
        return ""
    return matches[-1].strip()


def _build_local_tutor_reply(student_message: str) -> str:
    text = (student_message or "").strip()
    lowered = text.lower()
    if not text:
        return "Let's continue. What topic feels most confusing to you right now?"
    if "2x" in lowered or "equation" in lowered or "solve" in lowered:
        return "Great question. To isolate x, what operation should we apply first to remove the constant term?"
    if "density" in lowered:
        return "Think of density as mass packed in a given space. Which is denser: cotton or iron for the same volume?"
    if "fraction" in lowered:
        return "Fractions compare parts of a whole. If pizza is split into 8 equal slices, what does 3/8 represent?"
    if "heat" in lowered or "convection" in lowered:
        return "Nice thinking. When air gets hot it expands; what happens to its density then?"
    if any(question_word in lowered for question_word in ["what", "why", "how", "which", "where", "when", "explain", "understand", "confused", "don't", "cannot", "can't"]):
        return f"Good question. For '{text}', which part is most confusing: the concept, the steps, or the words used?"
    return f"Good start. Since you asked about '{text}', what do you think is the first key idea we should use?"


def _build_local_analysis_json(student_message: str) -> str:
    text = (student_message or "").lower()
    keyword_map = {
        "algebra_basics": ["algebra", "equation", "variable", "2x", "x+"],
        "linear_equations": ["linear equation", "2x", "solve x", "ax+b"],
        "fractions": ["fraction", "1/2", "3/4", "denominator", "numerator"],
        "density": ["density", "mass per volume", "float", "sink"],
        "convection": ["convection", "hot air rises", "warm air"],
        "decimals": ["decimal", "point"],
        "percentage": ["percent", "percentage", "%"],
    }
    detected_concept = None
    for concept, keys in keyword_map.items():
        if any(k in text for k in keys):
            detected_concept = concept
            break
    payload = {
        "detected_concept": detected_concept,
        "gap_status": "suspected" if detected_concept else "none",
        "confidence": 0.35 if detected_concept else 0.2,
    }
    return json.dumps(payload)


def _build_fallback_for_prompt(prompt: str) -> str:
    if "ANALYSIS" in prompt.upper():
        return _build_local_analysis_json(_extract_last_student_message(prompt))
    return _build_local_tutor_reply(_extract_last_student_message(prompt))


async def call_ollama(prompt: str) -> str:
    last_error = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.5,
                            "num_predict": 220,
                        },
                    },
                )
                response.raise_for_status()
                result = response.json()
                text = _extract_ollama_text(result)
                if not text:
                    raise ValueError("Ollama returned an empty response")
                return text
        except Exception as e:
            last_error = e
            print(f"[WARN] Ollama attempt {attempt + 1} failed: {e}")
    raise RuntimeError(f"Ollama failed after retries: {last_error}")


async def call_groq(prompt: str) -> str:
    """Groq OpenAI-compatible chat completions. Env: GROQ_API_KEY, GROQ_MODEL."""
    try:
        key = (GROQ_API_KEY or os.getenv("GROQ_API_KEY") or "").strip()
        if not key:
            print("[WARN] GROQ_API_KEY is not configured, using local fallback")
            return _build_fallback_for_prompt(prompt)

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                GROQ_CHAT_COMPLETIONS_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7, # Higher temperature for variety
                    "max_tokens": 2048,
                },
            )
            if response.status_code != 200:
                print(
                    f"[WARN] Groq returned {response.status_code}, using local fallback. "
                    f"Body: {response.text[:400]}"
                )
                return _build_fallback_for_prompt(prompt)
            data = response.json()
            try:
                text = data["choices"][0]["message"]["content"]
                if isinstance(text, str) and text.strip():
                    return text.strip()
                raise ValueError("Empty Groq message content")
            except Exception as parse_error:
                print(f"[WARN] Groq response parse failed: {parse_error}; using local fallback")
                return _build_fallback_for_prompt(prompt)
    except Exception as e:
        print(f"[WARN] Groq request failed ({e!r}), using local fallback")
        return _build_fallback_for_prompt(prompt)


async def call_gemini(prompt: str) -> str:
    """Google Gemini API call — tries primary key, then backup key, then Groq."""
    for key in [GEMINI_API_KEY, GEMINI_API_KEY_BACKUP]:
        key = (key or "").strip()
        if not key:
            continue
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={key}"
            async with httpx.AsyncClient(timeout=15.0) as client:  # 15s max, not 60s
                response = await client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "temperature": 0.7,
                            "maxOutputTokens": 512,  # shorter = faster
                        }
                    },
                )
                if response.status_code != 200:
                    print(f"[WARN] Gemini key ...{key[-6:]} error {response.status_code}, trying next key")
                    continue
                data = response.json()
                try:
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
                except Exception:
                    print(f"[WARN] Gemini key ...{key[-6:]} bad response structure, trying next key")
                    continue
        except Exception as e:
            print(f"[WARN] Gemini key ...{key[-6:]} failed: {e}, trying next key")
            continue

    print("[WARN] All Gemini keys failed, falling back to Groq")
    return await call_groq(prompt)


async def call_nvidia(prompt: str, model: str = None) -> str:
    """NVIDIA NIM API call using specified model or default Mistral Medium 3.5."""
    try:
        key = (NVIDIA_API_KEY or os.getenv("NVIDIA_API_KEY") or "").strip()
        if not key:
            print("[WARN] NVIDIA_API_KEY is not configured, falling back to Groq")
            return await call_groq(prompt)

        # Log masked key for debugging
        print(f"NVIDIA API Key loaded: {key[:8]}...{key[-4:]}")

        model_name = model or os.getenv("NVIDIA_MODEL", "mistralai/mistral-medium-3.5-128b")
        print(f"Calling NVIDIA NIM with model: {model_name}")
        
        # Adjust tokens based on task
        is_analysis = "ANALYSIS" in prompt.upper()
        is_quiz = "QUIZ" in prompt.upper() or "QUESTIONS" in prompt.upper()
        
        if is_analysis:
            max_tokens = 150
            timeout = 10.0 # Faster timeout for analysis
        elif is_quiz:
            max_tokens = 2500 
            timeout = 60.0
        else:
            max_tokens = 1024 
            timeout = 30.0

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                NVIDIA_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1 if is_analysis else 0.7, # Higher temperature for quiz variety
                    "max_tokens": max_tokens,
                    "top_p": 0.7,
                },
            )
            
            if response.status_code != 200:
                print(f"[WARN] NVIDIA API error {response.status_code}: {response.text[:500]}")
                return await call_groq(prompt)
            
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"].strip()
                # Remove potential thinking or reasoning tags if model adds them
                content = re.sub(r'<thought>.*?</thought>', '', content, flags=re.DOTALL)
                return content.strip()
            
            raise ValueError("Invalid response structure from NVIDIA API")
            
    except Exception as e:
        import traceback
        print(f"[ERROR] NVIDIA API request failed: {type(e).__name__}: {e}")
        traceback.print_exc()
        return await call_groq(prompt)


async def call_cerebras(prompt: str, model: str = None) -> str:
    """Cerebras Cloud Inference API call — fastest response ~0.5s."""
    try:
        key = (CEREBRAS_API_KEY or os.getenv("CEREBRAS_API_KEY") or "").strip()
        if not key:
            print("[WARN] CEREBRAS_API_KEY is not configured, falling back to Gemini")
            return await call_gemini(prompt)

        model_name = model or os.getenv("CEREBRAS_MODEL", "llama-3.3-70b")
        print(f"[Cerebras] Calling model: {model_name}")

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                CEREBRAS_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                    "max_tokens": 512,
                },
            )
            
            if response.status_code != 200:
                print(f"[WARN] Cerebras error {response.status_code}: {response.text[:300]}, falling back to Gemini")
                return await call_gemini(prompt)
            
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"].strip()
                content = re.sub(r'<thought>.*?</thought>', '', content, flags=re.DOTALL)
                return content.strip()
            
            raise ValueError("Invalid response structure from Cerebras API")
            
    except Exception as e:
        print(f"[ERROR] Cerebras failed ({type(e).__name__}: {e}), falling back to Gemini")
        return await call_gemini(prompt)


async def call_ai(prompt: str, model: str = None) -> str:
    """Main AI call — Groq (fast, free) → Gemini → local fallback."""
    # Groq first — fast and reliable
    try:
        return await call_groq(prompt)
    except Exception as e:
        print(f"[WARN] Groq failed: {e}, trying Gemini")

    # Gemini fallback
    try:
        return await call_gemini(prompt)
    except Exception as e:
        print(f"[WARN] Gemini failed: {e}, using local fallback")
        return _build_fallback_for_prompt(prompt)


def extract_json(text: str) -> dict:
    import re, json

    print("RAW ANALYSIS RESPONSE:", text)
    print("PARSING TEXT:", text[-500:])

    try:
        if "<ANALYSIS>" in text:
            start = text.index("<ANALYSIS>") + 10
            end = text.index("</ANALYSIS>")
            return json.loads(text[start:end].strip())
    except Exception:
        pass

    try:
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
    except Exception:
        pass

    try:
        matches = re.findall(r'\{[^{}]*\}', text, re.DOTALL)
        if matches:
            for m in reversed(matches):
                try:
                    return json.loads(m)
                except Exception:
                    continue
    except Exception:
        pass

    return {
        "detected_concept": None,
        "gap_status": "none",
        "response_to_student": text,
    }
