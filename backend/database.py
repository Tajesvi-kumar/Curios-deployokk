import uuid
import random
import json
import os
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from datetime import datetime, timedelta
from supabase_config import supabase

_SUPABASE_TIMEOUT = 3  # seconds — fail fast if Supabase is unreachable

def _sb(fn):
    """Run a Supabase call with a hard timeout. Returns None on timeout/error."""
    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            future = ex.submit(fn)
            return future.result(timeout=_SUPABASE_TIMEOUT)
    except (FuturesTimeoutError, Exception) as e:
        print(f"[WARN] Supabase call skipped ({type(e).__name__}). Using local data.")
        return None

# ─────────────────────────────────────────────────────────────────────────────
# LOCAL PERSISTENT FALLBACK DATABASE (JSON file-backed)
# ─────────────────────────────────────────────────────────────────────────────
_DB_FILE = os.path.join(os.path.dirname(__file__), "local_db.json")

def _load_local_db():
    if os.path.exists(_DB_FILE):
        try:
            with open(_DB_FILE, "r") as f:
                data = json.load(f)
                return (
                    data.get("sessions", []),
                    data.get("gaps", []),
                    data.get("chat_messages", []),
                    data.get("quiz_attempts", []),
                    data.get("quiz_answers", []),
                )
        except Exception:
            pass
    return [], [], [], [], []

def _save_local_db():
    try:
        with open(_DB_FILE, "w") as f:
            json.dump({
                "sessions": LOCAL_SESSIONS,
                "gaps": LOCAL_GAPS,
                "chat_messages": LOCAL_CHAT_MESSAGES,
                "quiz_attempts": LOCAL_QUIZ_ATTEMPTS,
                "quiz_answers": LOCAL_QUIZ_ANSWERS,
            }, f, indent=2)
    except Exception as e:
        print(f"[WARN] Could not persist local_db.json: {e}")

_s, _g, _c, _qa, _qans = _load_local_db()
LOCAL_SESSIONS = _s
LOCAL_GAPS = _g
LOCAL_CHAT_MESSAGES = _c
LOCAL_QUIZ_ATTEMPTS = _qa
LOCAL_QUIZ_ANSWERS = _qans

def init_local_db():
    """Pre-populates high-fidelity NCERT classroom analytics for offline fallback."""
    global LOCAL_SESSIONS, LOCAL_GAPS, LOCAL_CHAT_MESSAGES, LOCAL_QUIZ_ATTEMPTS, LOCAL_QUIZ_ANSWERS
    if LOCAL_SESSIONS:
        return

    print("[INFO] Initializing CuriOS In-Memory Fallback Database...")

    mock_students = [
        {"name": "Rahul Sharma", "class": 7, "subject": "Mathematics", "mastery": 38, "gaps": [("fractions", "root"), ("decimals", "confirmed"), ("algebra_basics", "confirmed"), ("linear_equations", "confirmed")]},
        {"name": "Priya Patel", "class": 6, "subject": "Science", "mastery": 56, "gaps": [("density", "root"), ("convection", "confirmed"), ("photosynthesis", "suspected")]},
        {"name": "Amit Verma", "class": 8, "subject": "Science", "mastery": 88, "gaps": [("conduction", "fixed"), ("radiation", "fixed")]},
        {"name": "Sneha Reddy", "class": 5, "subject": "Mathematics", "mastery": 42, "gaps": [("fractions", "root"), ("decimals", "confirmed")]},
        {"name": "Vikram Singh", "class": 9, "subject": "Science", "mastery": 65, "gaps": [("conduction", "confirmed"), ("convection", "suspected")]},
        {"name": "Ananya Gupta", "class": 7, "subject": "English", "mastery": 92, "gaps": [("nouns", "fixed")]},
        {"name": "Rohan Das", "class": 10, "subject": "Social Science", "mastery": 74, "gaps": [("democracy", "suspected")]},
        {"name": "Divya Nair", "class": 8, "subject": "Mathematics", "mastery": 32, "gaps": [("linear_equations", "root"), ("algebra_basics", "confirmed"), ("fractions", "suspected")]},
        {"name": "Karan Malhotra", "class": 6, "subject": "Mathematics", "mastery": 78, "gaps": [("decimals", "fixed")]},
        {"name": "Meera Iyer", "class": 7, "subject": "Science", "mastery": 82, "gaps": [("convection", "fixed")]},
        {"name": "Arjun Rao", "class": 7, "subject": "Mathematics", "mastery": 48, "gaps": [("fractions", "root"), ("decimals", "confirmed"), ("linear_equations", "suspected")]},
        {"name": "Aditi Joshi", "class": 8, "subject": "Science", "mastery": 50, "gaps": [("density", "root"), ("convection", "confirmed")]},
        {"name": "Siddharth Sen", "class": 9, "subject": "Mathematics", "mastery": 70, "gaps": [("algebra_basics", "confirmed")]},
        {"name": "Kavya Menon", "class": 6, "subject": "Science", "mastery": 35, "gaps": [("density", "root"), ("fractions", "root")]},
        {"name": "Yash Vardhan", "class": 10, "subject": "Mathematics", "mastery": 60, "gaps": [("linear_equations", "confirmed")]},
        {"name": "Tanvi Hegde", "class": 7, "subject": "English", "mastery": 85, "gaps": []},
        {"name": "Rishabh Goel", "class": 8, "subject": "Social Science", "mastery": 90, "gaps": []},
        {"name": "Ishita Saxena", "class": 5, "subject": "Mathematics", "mastery": 58, "gaps": [("fractions", "confirmed")]},
        {"name": "Pranav Shah", "class": 6, "subject": "Science", "mastery": 68, "gaps": [("convection", "confirmed")]},
        {"name": "Riya Kapoor", "class": 7, "subject": "Hindi", "mastery": 95, "gaps": []},
        {"name": "Nikhil Bose", "class": 9, "subject": "Science", "mastery": 40, "gaps": [("density", "root"), ("fractions", "confirmed")]},
        {"name": "Shreya Ghosh", "class": 8, "subject": "Mathematics", "mastery": 75, "gaps": [("algebra_basics", "confirmed")]},
        {"name": "Varun Mehta", "class": 7, "subject": "Science", "mastery": 52, "gaps": [("density", "confirmed"), ("convection", "confirmed")]},
        {"name": "Nehal Chawla", "class": 6, "subject": "Mathematics", "mastery": 80, "gaps": [("fractions", "fixed")]}
    ]

    for s in mock_students:
        session_id = str(uuid.uuid4())
        days_ago = random.randint(3, 10)
        created_at = (datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 23))).isoformat()
        updated_at = (datetime.utcnow() - timedelta(minutes=random.randint(15, 2000))).isoformat()

        session_data = {
            "id": session_id,
            "student_name": s["name"],
            "student_class": s["class"],
            "subject": s["subject"],
            "language": "English" if random.random() > 0.15 else "Hindi",
            "mastery_score": s["mastery"],
            "created_at": created_at,
            "updated_at": updated_at
        }
        LOCAL_SESSIONS.append(session_data)

        # Gaps Seeding
        for g_id, status in s["gaps"]:
            gap_data = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "concept_id": g_id,
                "concept_label": g_id.replace("_", " ").capitalize(),
                "status": status,
                "detected_at": (datetime.fromisoformat(created_at) + timedelta(hours=random.randint(1, 10))).isoformat()
            }
            LOCAL_GAPS.append(gap_data)

        # Chat History Seeding
        chat_samples = [
            ("student", f"Namaste! I am struggling to understand {s['subject']} concepts like {s['gaps'][0][0].replace('_', ' ') if s['gaps'] else 'this chapter'}."),
            ("curios", f"Namaste! Don't worry, let's learn it step-by-step. What do you think is the first rule we apply here?"),
            ("student", "I think we just try to solve it, but my calculation keeps going wrong."),
            ("curios", f"Ah, that usually happens if the core concept is unclear. Let's practice with an example! If we have {s['gaps'][0][0].replace('_', ' ') if s['gaps'] else 'a core term'}, how would you explain it in your own words?")
        ]
        for idx, (role, content) in enumerate(chat_samples):
            msg_data = {
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "role": role,
                "content": content,
                "created_at": (datetime.fromisoformat(created_at) + timedelta(minutes=5 + idx * 5)).isoformat()
            }
            LOCAL_CHAT_MESSAGES.append(msg_data)

        # Quiz Attempts Seeding
        num_quizzes = random.randint(1, 3)
        for attempt_idx in range(num_quizzes):
            attempt_id = str(uuid.uuid4())
            score = random.randint(3, 9)
            total = 10
            pct = (score / total) * 100

            ch_title = f"Chapter {attempt_idx + 1}: Foundations"
            attempt_data = {
                "id": attempt_id,
                "session_id": session_id,
                "chapter_id": f"ch_{attempt_idx + 1}",
                "chapter_title": ch_title,
                "subject": s["subject"],
                "score": score,
                "total_questions": total,
                "percentage": pct,
                "concept_analysis": {g[0]: ("mastered" if random.random() > 0.4 else "gap") for g in s["gaps"]} if s["gaps"] else {"general": "mastered"},
                "new_gaps_detected": [g[0] for g in s["gaps"] if random.random() > 0.6] if s["gaps"] else [],
                "created_at": (datetime.fromisoformat(created_at) + timedelta(days=1, hours=attempt_idx)).isoformat(),
                "completed_at": (datetime.fromisoformat(created_at) + timedelta(days=1, hours=attempt_idx)).isoformat()
            }
            LOCAL_QUIZ_ATTEMPTS.append(attempt_data)

            # Answers seeding
            for q_idx in range(total):
                is_correct = (q_idx < score)
                concept = s["gaps"][q_idx % len(s["gaps"])][0] if s["gaps"] else "general"
                ans_data = {
                    "id": str(uuid.uuid4()),
                    "attempt_id": attempt_id,
                    "question_text": f"Mock Question {q_idx + 1} regarding {concept}",
                    "question_type": "mcq",
                    "student_answer": "Option A" if is_correct else "Option B",
                    "correct_answer": "Option A",
                    "is_correct": is_correct,
                    "concept_tested": concept,
                    "created_at": attempt_data["created_at"]
                }
                LOCAL_QUIZ_ANSWERS.append(ans_data)

    print(f"[SUCCESS] pre-populated {len(LOCAL_SESSIONS)} mock students locally.")

# Auto-initialize
init_local_db()


# ─────────────────────────────────────────────────────────────────────────────
# RESILIENT DATABASE UTILITIES (FAILS OVER TO IN-MEMORY BACKUP)
# ─────────────────────────────────────────────────────────────────────────────

def get_chapters(class_no: int, subject: str):
    """Fetches chapters from Supabase, with an robust offline fallback."""
    try:
        response = (
            supabase.table("chapters")
            .select("*")
            .eq("class_no", class_no)
            .eq("subject", subject)
            .order("chapter_no")
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"[WARN] get_chapters failed ({e}). Returning local mock chapters.")
        return [
            {"id": f"ch_{class_no}_1", "class_no": class_no, "subject": subject, "chapter_no": 1, "title": "Fundamental Concepts", "topics": ["basics", "core understanding"]},
            {"id": f"ch_{class_no}_2", "class_no": class_no, "subject": subject, "chapter_no": 2, "title": "Intermediate Diagnostics", "topics": ["methods", "applications"]},
            {"id": f"ch_{class_no}_3", "class_no": class_no, "subject": subject, "chapter_no": 3, "title": "Advanced Mastery", "topics": ["synthesis", "evaluation"]}
        ]

def get_chapter_by_id(chapter_id: str):
    try:
        response = supabase.table("chapters").select("*").eq("id", chapter_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"[WARN] get_chapter_by_id failed ({e}). Searching local fallback.")
        return {"id": chapter_id, "title": "Diagnostic Chapter", "class_no": 7, "subject": "Science", "topics": []}

def create_session(student_name: str, student_class: int, subject: str, language: str):
    """Creates a learning session in Supabase, falling back to local memory if offline."""
    try:
        data = {
            "student_name": student_name,
            "student_class": student_class,
            "subject": subject,
            "language": language,
            "mastery_score": 100
        }
        response = supabase.table("sessions").insert(data).execute()
        if response.data:
            return response.data[0]["id"]
        return None
    except Exception as e:
        print(f"[WARN] create_session failed ({e}). Creating session in local database.")
        session_id = str(uuid.uuid4())
        session_data = {
            "id": session_id,
            "student_name": student_name,
            "student_class": student_class,
            "subject": subject,
            "language": language,
            "mastery_score": 100,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        LOCAL_SESSIONS.append(session_data)
        _save_local_db()
        return session_id

def update_mastery(session_id: str, mastery: int):
    try:
        data = {
            "mastery_score": mastery,
            "updated_at": datetime.utcnow().isoformat()
        }
        response = supabase.table("sessions").update(data).eq("id", session_id).execute()
        return response.data
    except Exception as e:
        print(f"[WARN] update_mastery failed ({e}). Updating local memory.")
        for s in LOCAL_SESSIONS:
            if s["id"] == session_id:
                s["mastery_score"] = mastery
                s["updated_at"] = datetime.utcnow().isoformat()
                _save_local_db()
                return [s]
        return []

def get_session(session_id: str):
    res = _sb(lambda: supabase.table("sessions").select("*").eq("id", session_id).execute())
    if res and res.data:
        return res.data[0]
    for s in LOCAL_SESSIONS:
        if s["id"] == session_id:
            return s
    return None

def upsert_gap(session_id: str, concept_id: str, concept_label: str, status: str):
    try:
        allowed_status = {"untested", "suspected", "confirmed", "root", "fixed"}
        if status not in allowed_status:
            raise ValueError(f"Invalid status '{status}'. Allowed: {sorted(allowed_status)}")

        # Check if gap exists
        response = (
            supabase.table("gaps")
            .select("*")
            .eq("session_id", session_id)
            .eq("concept_id", concept_id)
            .execute()
        )

        data = {
            "session_id": session_id,
            "concept_id": concept_id,
            "concept_label": concept_label,
            "status": status,
            "detected_at": datetime.utcnow().isoformat()
        }

        if response.data:
            # Update existing gap
            gap_id = response.data[0]["id"]
            update_res = supabase.table("gaps").update(data).eq("id", gap_id).execute()
            return update_res.data
        else:
            # Insert new gap
            insert_res = supabase.table("gaps").insert(data).execute()
            return insert_res.data
    except Exception as e:
        print(f"[WARN] upsert_gap failed ({e}). Saving gap to local fallback.")
        for g in LOCAL_GAPS:
            if g["session_id"] == session_id and g["concept_id"] == concept_id:
                g["status"] = status
                g["concept_label"] = concept_label
                g["detected_at"] = datetime.utcnow().isoformat()
                return [g]
        new_gap = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "concept_id": concept_id,
            "concept_label": concept_label,
            "status": status,
            "detected_at": datetime.utcnow().isoformat()
        }
        LOCAL_GAPS.append(new_gap)
        _save_local_db()
        return [new_gap]

def get_session_gaps(session_id: str):
    res = _sb(lambda: supabase.table("gaps").select("*").eq("session_id", session_id).execute())
    if res and res.data:
        return res.data
    return [g for g in LOCAL_GAPS if g["session_id"] == session_id]

def save_quiz_attempt(session_id: str, chapter_id: str, chapter_title: str, subject: str, score: int, total: int, concept_analysis: dict, new_gaps: list):
    try:
        percentage = (score / total) * 100 if total > 0 else 0
        data = {
            "session_id": session_id,
            "chapter_id": chapter_id,
            "chapter_title": chapter_title,
            "subject": subject,
            "score": score,
            "total_questions": total,
            "percentage": percentage,
            "concept_analysis": concept_analysis,
            "new_gaps_detected": new_gaps
        }
        response = supabase.table("quiz_attempts").insert(data).execute()
        if response.data:
            return response.data[0]["id"]
        return None
    except Exception as e:
        print(f"[WARN] save_quiz_attempt failed ({e}). Storing in local database.")
        attempt_id = str(uuid.uuid4())
        pct = (score / total) * 100 if total > 0 else 0
        new_attempt = {
            "id": attempt_id,
            "session_id": session_id,
            "chapter_id": chapter_id,
            "chapter_title": chapter_title,
            "subject": subject,
            "score": score,
            "total_questions": total,
            "percentage": pct,
            "concept_analysis": concept_analysis,
            "new_gaps_detected": new_gaps,
            "created_at": datetime.utcnow().isoformat()
        }
        LOCAL_QUIZ_ATTEMPTS.append(new_attempt)
        _save_local_db()
        return attempt_id

def save_quiz_answers(attempt_id: str, answers: list):
    try:
        # Prepare bulk insert
        data_to_insert = []
        for ans in answers:
            data_to_insert.append({
                "attempt_id": attempt_id,
                "question_text": ans.get("question_text", ""),
                "question_type": ans.get("type", "MCQ"),
                "student_answer": ans.get("student_answer", ""),
                "correct_answer": ans.get("correct_answer", ""),
                "is_correct": ans.get("is_correct", False),
                "concept_tested": ans.get("concept_tested", "")
            })
        if data_to_insert:
            response = supabase.table("quiz_answers").insert(data_to_insert).execute()
            return response.data
        return []
    except Exception as e:
        print(f"[WARN] save_quiz_answers failed ({e}). Storing in local database.")
        local_inserted = []
        for ans in answers:
            ans_data = {
                "id": str(uuid.uuid4()),
                "attempt_id": attempt_id,
                "question_text": ans.get("question_text", ""),
                "question_type": ans.get("type", "MCQ"),
                "student_answer": ans.get("student_answer", ""),
                "correct_answer": ans.get("correct_answer", ""),
                "is_correct": ans.get("is_correct", False),
                "concept_tested": ans.get("concept_tested", ""),
                "created_at": datetime.utcnow().isoformat()
            }
            LOCAL_QUIZ_ANSWERS.append(ans_data)
            local_inserted.append(ans_data)
        _save_local_db()
        return local_inserted

def save_chat_message(session_id: str, role: str, content: str):
    """Persist a single chat message, falling back to local memory if offline."""
    try:
        data = {
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": datetime.utcnow().isoformat(),
        }
        response = supabase.table("chat_messages").insert(data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        print(f"[WARN] save_chat_message failed ({e}). Saving in local memory.")
        msg = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "role": role,
            "content": content,
            "created_at": datetime.utcnow().isoformat()
        }
        LOCAL_CHAT_MESSAGES.append(msg)
        return msg

def get_chat_messages(session_id: str):
    """Return all messages for a session ordered by time."""
    try:
        response = (
            supabase.table("chat_messages")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"[WARN] get_chat_messages failed ({e}). Returning local chat history.")
        return sorted([m for m in LOCAL_CHAT_MESSAGES if m["session_id"] == session_id], key=lambda x: x["created_at"])

def ensure_db_session(session_id: str, student_name: str, student_class: int, subject: str, language: str) -> bool:
    try:
        existing = supabase.table("sessions").select("id").eq("id", session_id).execute()
        if existing.data:
            return True
        data = {
            "id": session_id,
            "student_name": student_name,
            "student_class": student_class,
            "subject": subject,
            "language": language,
            "mastery_score": 100,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        supabase.table("sessions").insert(data).execute()
        return True
    except Exception as e:
        print(f"[WARN] ensure_db_session failed ({e}). Registering local session.")
        for s in LOCAL_SESSIONS:
            if s["id"] == session_id:
                return True
        LOCAL_SESSIONS.append({
            "id": session_id,
            "student_name": student_name,
            "student_class": student_class,
            "subject": subject,
            "language": language,
            "mastery_score": 100,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        })
        _save_local_db()
        return True

def get_chapter_attempts(session_id: str):
    try:
        response = (
            supabase.table("quiz_attempts")
            .select("chapter_id, chapter_title, score, percentage")
            .eq("session_id", session_id)
            .execute()
        )
        return response.data
    except Exception as e:
        print(f"[WARN] get_chapter_attempts failed ({e}). Returning local attempts.")
        return [
            {"chapter_id": q["chapter_id"], "chapter_title": q["chapter_title"], "score": q["score"], "percentage": q["percentage"]}
            for q in LOCAL_QUIZ_ATTEMPTS if q["session_id"] == session_id
        ]


# ─────────────────────────────────────────────────────────────────────────────
# TEACHER DASHBOARD API ENDPOINT AGGREGATORS (OFFLINE RESILIENT)
# ─────────────────────────────────────────────────────────────────────────────

def get_teacher_overview_data():
    """Fetches high-level class summary metrics — queries Supabase first, falls back and merges with local JSON/memory."""
    sessions = None
    gaps = None
    attempts = None

    try:
        sessions_res = _sb(lambda: supabase.table("sessions").select("*").execute())
        if sessions_res and sessions_res.data is not None:
            sessions = sessions_res.data
            
            gaps_res = _sb(lambda: supabase.table("gaps").select("*").execute())
            if gaps_res and gaps_res.data is not None:
                gaps = gaps_res.data
                
            attempts_res = _sb(lambda: supabase.table("quiz_attempts").select("*").execute())
            if attempts_res and attempts_res.data is not None:
                attempts = attempts_res.data
    except Exception as e:
        print(f"[WARN] Supabase fetch in get_teacher_overview_data failed: {e}")

    # Merge sessions
    if sessions is None:
        sessions = LOCAL_SESSIONS
    else:
        supabase_ids = {s["id"] for s in sessions}
        for ls in LOCAL_SESSIONS:
            if ls["id"] not in supabase_ids:
                sessions.append(ls)

    # Merge gaps
    if gaps is None:
        gaps = LOCAL_GAPS
    else:
        supabase_gap_ids = {g["id"] for g in gaps if "id" in g}
        for lg in LOCAL_GAPS:
            if lg.get("id") not in supabase_gap_ids:
                gaps.append(lg)

    # Merge attempts
    if attempts is None:
        attempts = LOCAL_QUIZ_ATTEMPTS
    else:
        supabase_attempt_ids = {a["id"] for a in attempts if "id" in a}
        for la in LOCAL_QUIZ_ATTEMPTS:
            if la.get("id") not in supabase_attempt_ids:
                attempts.append(la)

    total_students = len(sessions)
    total_quizzes = len(attempts)
    critical_gaps = sum(1 for g in gaps if g.get("status") in ["confirmed", "root"])
    avg_mastery = round(sum(s.get("mastery_score", 100) or 100 for s in sessions) / total_students) if total_students > 0 else 100

    gap_counts = {}
    for g in gaps:
        if g.get("status") in ["confirmed", "root"]:
            concept = g.get("concept_id", "general")
            gap_counts[concept] = gap_counts.get(concept, 0) + 1

    common_gaps = [{"concept": k.replace("_", " ").capitalize(), "count": v} for k, v in gap_counts.items()]
    common_gaps = sorted(common_gaps, key=lambda x: x["count"], reverse=True)[:10]

    priority_topics = []
    for idx, item in enumerate(common_gaps):
        cnt = item["count"]
        ratio = cnt / total_students if total_students > 0 else 0
        severity = "critical" if ratio > 0.5 else "high" if ratio > 0.3 else "medium"
        priority_topics.append({
            "id": idx + 1,
            "concept": item["concept"],
            "count": cnt,
            "total": total_students,
            "severity": severity
        })

    return {
        "total_students": total_students,
        "total_quizzes": total_quizzes,
        "critical_gaps": critical_gaps,
        "avg_mastery": avg_mastery,
        "common_gaps": common_gaps,
        "priority_topics": priority_topics
    }

def get_all_student_sessions():
    """Fetches all learning sessions with aggregate counts — queries Supabase first, falls back and merges with local JSON/memory."""
    sessions = None
    gaps = None
    attempts = None

    try:
        sessions_res = _sb(lambda: supabase.table("sessions").select("*").execute())
        if sessions_res and sessions_res.data is not None:
            sessions = sessions_res.data
            
            gaps_res = _sb(lambda: supabase.table("gaps").select("*").execute())
            if gaps_res and gaps_res.data is not None:
                gaps = gaps_res.data
                
            attempts_res = _sb(lambda: supabase.table("quiz_attempts").select("*").execute())
            if attempts_res and attempts_res.data is not None:
                attempts = attempts_res.data
    except Exception as e:
        print(f"[WARN] Supabase fetch in get_all_student_sessions failed: {e}")

    # Merge sessions
    if sessions is None:
        sessions = LOCAL_SESSIONS
    else:
        supabase_ids = {s["id"] for s in sessions}
        for ls in LOCAL_SESSIONS:
            if ls["id"] not in supabase_ids:
                sessions.append(ls)

    # Merge gaps
    if gaps is None:
        gaps = LOCAL_GAPS
    else:
        supabase_gap_ids = {g["id"] for g in gaps if "id" in g}
        for lg in LOCAL_GAPS:
            if lg.get("id") not in supabase_gap_ids:
                gaps.append(lg)

    # Merge attempts
    if attempts is None:
        attempts = LOCAL_QUIZ_ATTEMPTS
    else:
        supabase_attempt_ids = {a["id"] for a in attempts if "id" in a}
        for la in LOCAL_QUIZ_ATTEMPTS:
            if la.get("id") not in supabase_attempt_ids:
                attempts.append(la)

    sessions = sorted(sessions, key=lambda x: x.get("updated_at") or x.get("created_at") or "", reverse=True)

    gap_counts = {}
    for g in gaps:
        sid = g.get("session_id")
        if g.get("status") in ["confirmed", "root"]:
            gap_counts[sid] = gap_counts.get(sid, 0) + 1

    quiz_counts = {}
    for a in attempts:
        sid = a.get("session_id")
        quiz_counts[sid] = quiz_counts.get(sid, 0) + 1

    result = []
    for s in sessions:
        sid = s["id"]
        result.append({
            "id": sid,
            "student_name": s.get("student_name", "Student"),
            "student_class": s.get("student_class", 7),
            "subject": s.get("subject", "Mathematics"),
            "language": s.get("language", "English"),
            "mastery_score": s.get("mastery_score", 100),
            "created_at": s.get("created_at"),
            "updated_at": s.get("updated_at"),
            "gap_count": gap_counts.get(sid, 0),
            "quiz_count": quiz_counts.get(sid, 0)
        })
    return result

def get_student_detail_data(session_id: str):
    """Fetches detailed analytics profile for a single student."""
    try:
        # Get session from local first, then try Supabase
        session = next((s for s in LOCAL_SESSIONS if s["id"] == session_id), None)
        if not session:
            res = _sb(lambda: supabase.table("sessions").select("*").eq("id", session_id).execute())
            session = (res.data[0] if res and res.data else None)
        if not session:
            return None

        # Gaps — local first
        gaps = [g for g in LOCAL_GAPS if g["session_id"] == session_id]
        if not gaps:
            res = _sb(lambda: supabase.table("gaps").select("*").eq("session_id", session_id).execute())
            gaps = (res.data if res else None) or []

        # Attempts — local first
        attempts = sorted(
            [q for q in LOCAL_QUIZ_ATTEMPTS if q["session_id"] == session_id],
            key=lambda x: x.get("completed_at") or x.get("created_at", ""),
            reverse=True
        )
        if not attempts:
            res = _sb(lambda: supabase.table("quiz_attempts").select("*").eq("session_id", session_id).execute())
            attempts = sorted(
                (res.data if res else None) or [],
                key=lambda x: x.get("completed_at") or x.get("created_at", ""),
                reverse=True
            )

        # Normalize date field
        for a in attempts:
            if "completed_at" in a and a["completed_at"]:
                a["created_at"] = a["completed_at"]
            if "created_at" not in a or not a["created_at"]:
                a["created_at"] = session.get("created_at") or datetime.utcnow().isoformat()

        # Answers — local first
        attempt_ids = {a["id"] for a in attempts}
        answers = [ans for ans in LOCAL_QUIZ_ANSWERS if ans.get("attempt_id") in attempt_ids]
        if not answers and attempt_ids:
            res = _sb(lambda: supabase.table("quiz_answers").select("*").in_("attempt_id", list(attempt_ids)).execute())
            answers = (res.data if res else None) or []

        # Chat messages — local first
        chat_messages = [
            {"role": m["role"], "content": m["content"], "created_at": m.get("created_at", session.get("updated_at"))}
            for m in LOCAL_CHAT_MESSAGES if m.get("session_id") == session_id
        ]
        if not chat_messages:
            res = _sb(lambda: supabase.table("chat_messages").select("*").eq("session_id", session_id).execute())
            chat_messages = (res.data if res else None) or []

        # Timeline logic
        timeline = []
        start_date = session.get("created_at")
        if start_date:
            timeline.append({"date": start_date[:10], "mastery": 100})
        
        points = []
        for g in gaps:
            points.append({
                "date": g.get("detected_at", start_date)[:10],
                "type": "gap",
                "status": g.get("status")
            })
        for a in attempts:
            points.append({
                "date": a.get("created_at", start_date)[:10],
                "type": "quiz",
                "score": a.get("percentage", 100)
            })
        
        points = sorted(points, key=lambda x: x["date"])
        
        curr_mastery = 100
        active_gap_ids = set()
        for p in points:
            if p["type"] == "gap":
                if p["status"] in ["confirmed", "root"]:
                    active_gap_ids.add(p["status"])
                    curr_mastery = max(20, 100 - (len(active_gap_ids) * 12))
            elif p["type"] == "quiz":
                weight = 0.4
                curr_mastery = round(curr_mastery * (1 - weight) + p["score"] * weight)
            
            timeline.append({"date": p["date"], "mastery": min(100, max(0, curr_mastery))})

        timeline.append({"date": session.get("updated_at", datetime.utcnow().isoformat())[:10], "mastery": session.get("mastery_score", 100)})
        timeline = sorted(timeline, key=lambda x: x["date"])
        unique_timeline = []
        seen_dates = set()
        for pt in timeline:
            if pt["date"] not in seen_dates:
                seen_dates.add(pt["date"])
                unique_timeline.append(pt)

        return {
            "profile": {
                "id": session_id,
                "student_name": session.get("student_name", "Student"),
                "student_class": session.get("student_class", 7),
                "subject": session.get("subject", "Mathematics"),
                "language": session.get("language", "English"),
                "mastery_score": session.get("mastery_score", 100),
                "created_at": session.get("created_at"),
                "updated_at": session.get("updated_at")
            },
            "gaps": gaps,
            "quiz_attempts": attempts,
            "quiz_answers": answers,
            "mastery_timeline": unique_timeline,
            "chat_messages": chat_messages
        }
    except Exception as e:
        print(f"[ERROR] get_student_detail_data failed: {e}")
        return None

def get_quiz_analytics_data():
    """Fetches quiz analytics, falling back to local memory on Supabase connectivity failure."""
    try:
        try:
            try:
                attempts_res = supabase.table("quiz_attempts").select("*").order("completed_at", desc=True).execute()
                attempts = attempts_res.data or []
            except Exception:
                attempts_res = supabase.table("quiz_attempts").select("*").execute()
                attempts = attempts_res.data or []
                if attempts and "completed_at" in attempts[0]:
                    attempts = sorted(attempts, key=lambda x: x.get("completed_at", ""), reverse=True)
        except Exception:
            attempts = sorted(LOCAL_QUIZ_ATTEMPTS, key=lambda x: x.get("created_at", ""), reverse=True)

        for a in attempts:
            if "completed_at" in a:
                a["created_at"] = a["completed_at"]
            if "created_at" not in a or not a["created_at"]:
                a["created_at"] = datetime.utcnow().isoformat()

        if not attempts:
            return {"attempts": [], "hardest_concepts": [], "avg_by_chapter": {}, "concept_heatmap": {}}

        # Fetch student names
        try:
            sessions_res = supabase.table("sessions").select("id, student_name, student_class").execute()
            sess_map = {s["id"]: s for s in sessions_res.data or []}
        except Exception:
            sess_map = {s["id"]: s for s in LOCAL_SESSIONS}

        attempts_joined = []
        for a in attempts:
            sid = a.get("session_id")
            s_info = sess_map.get(sid, {})
            attempts_joined.append({
                **a,
                "student_name": s_info.get("student_name", "Student"),
                "student_class": s_info.get("student_class", 7)
            })

        # Fetch answers
        attempt_ids = [a["id"] for a in attempts]
        answers = []
        if attempt_ids:
            try:
                answers_res = supabase.table("quiz_answers").select("*").in_("attempt_id", attempt_ids).execute()
                answers = answers_res.data or []
            except Exception:
                answers = [ans for ans in LOCAL_QUIZ_ANSWERS if ans["attempt_id"] in attempt_ids]

        concept_stats = {}
        for ans in answers:
            concept = ans.get("concept_tested", "general")
            if not concept:
                continue
            is_correct = ans.get("is_correct", False)
            stats = concept_stats.setdefault(concept, {"correct": 0, "total": 0})
            stats["total"] += 1
            if is_correct:
                stats["correct"] += 1

        hardest_concepts = []
        for c, stats in concept_stats.items():
            wrong = stats["total"] - stats["correct"]
            failure_rate = (wrong / stats["total"]) * 100 if stats["total"] > 0 else 0
            hardest_concepts.append({
                "concept": c.replace("_", " ").capitalize(),
                "total_questions": stats["total"],
                "failed_count": wrong,
                "failure_rate": round(failure_rate)
            })
        hardest_concepts = sorted(hardest_concepts, key=lambda x: x["failure_rate"], reverse=True)

        chapter_groups = {}
        for a in attempts:
            ch_title = a.get("chapter_title", "General diagnostic")
            ch_data = chapter_groups.setdefault(ch_title, {"score": 0, "count": 0})
            ch_data["score"] += a.get("percentage", 100)
            ch_data["count"] += 1
        
        avg_by_chapter = {k: round(v["score"] / v["count"]) for k, v in chapter_groups.items()}

        student_concepts = {}
        all_concepts = set()
        for ans in answers:
            aid = ans.get("attempt_id")
            attempt_obj = next((x for x in attempts if x["id"] == aid), None)
            if not attempt_obj:
                continue
            sid = attempt_obj.get("session_id")
            s_name = sess_map.get(sid, {}).get("student_name", "Student")
            concept = ans.get("concept_tested", "general")
            all_concepts.add(concept)

            s_data = student_concepts.setdefault(s_name, {})
            is_correct = ans.get("is_correct", False)
            s_data[concept] = "mastered" if is_correct else "gap"

        return {
            "attempts": attempts_joined,
            "hardest_concepts": hardest_concepts,
            "avg_by_chapter": avg_by_chapter,
            "concept_heatmap": {
                "concepts": sorted(list(all_concepts)),
                "matrix": student_concepts
            }
        }
    except Exception as e:
        print(f"[ERROR] get_quiz_analytics_data failed: {e}")
        return {"attempts": [], "hardest_concepts": [], "avg_by_chapter": {}, "concept_heatmap": {}}

def get_gap_heatmap_data():
    """Generates a student-to-concept gaps heatmap matrix resilient to connectivity issues."""
    try:
        try:
            seed_mock_classroom_data()
        except Exception:
            pass

        try:
            sessions_res = supabase.table("sessions").select("id, student_name, student_class").order("student_name").execute()
            students = sessions_res.data or []
        except Exception:
            students = sorted([{"id": s["id"], "student_name": s["student_name"], "student_class": s["student_class"]} for s in LOCAL_SESSIONS], key=lambda x: x["student_name"])

        try:
            gaps_res = supabase.table("gaps").select("*").execute()
            gaps = gaps_res.data or []
        except Exception:
            gaps = LOCAL_GAPS

        concepts = sorted(list(set(g.get("concept_id") for g in gaps if g.get("concept_id"))))
        if not concepts:
            concepts = ["density", "fractions", "convection", "photosynthesis", "decimals", "algebra_basics", "linear_equations"]

        heatmap = {}
        for s in students:
            heatmap[s["id"]] = {c: None for c in concepts}

        for g in gaps:
            sid = g.get("session_id")
            cid = g.get("concept_id")
            status = g.get("status")
            if sid in heatmap and cid in heatmap[sid]:
                heatmap[sid][cid] = status

        return {
            "students": students,
            "concepts": [{"id": c, "label": c.replace("_", " ").capitalize()} for c in concepts],
            "heatmap": heatmap
        }
    except Exception as e:
        print(f"[ERROR] get_gap_heatmap_data failed: {e}")
        return {"students": [], "concepts": [], "heatmap": {}}


# ─────────────────────────────────────────────────────────────────────────────
# ORIGINAL SUPABASE SEEDER CHECK
# ─────────────────────────────────────────────────────────────────────────────

def seed_mock_classroom_data():
    """Seeds the Supabase database with classroom metrics if connectivity permits and database is empty."""
    try:
        # Check if Priya Patel already exists in DB
        existing = supabase.table("sessions").select("id").eq("student_name", "Priya Patel").limit(1).execute()
        if existing.data and len(existing.data) > 0:
            return

        print("[INFO] Remote Database is empty! Seeding beautiful classroom analytics...")

        mock_students = [
            {"name": "Rahul Sharma", "class": 7, "subject": "Mathematics", "mastery": 38, "gaps": [("fractions", "root"), ("decimals", "confirmed"), ("algebra_basics", "confirmed"), ("linear_equations", "confirmed")]},
            {"name": "Priya Patel", "class": 6, "subject": "Science", "mastery": 56, "gaps": [("density", "root"), ("convection", "confirmed"), ("photosynthesis", "suspected")]},
            {"name": "Amit Verma", "class": 8, "subject": "Science", "mastery": 88, "gaps": [("conduction", "fixed"), ("radiation", "fixed")]},
            {"name": "Sneha Reddy", "class": 5, "subject": "Mathematics", "mastery": 42, "gaps": [("fractions", "root"), ("decimals", "confirmed")]},
            {"name": "Vikram Singh", "class": 9, "subject": "Science", "mastery": 65, "gaps": [("conduction", "confirmed"), ("convection", "suspected")]},
            {"name": "Ananya Gupta", "class": 7, "subject": "English", "mastery": 92, "gaps": [("nouns", "fixed")]},
            {"name": "Rohan Das", "class": 10, "subject": "Social Science", "mastery": 74, "gaps": [("democracy", "suspected")]},
            {"name": "Divya Nair", "class": 8, "subject": "Mathematics", "mastery": 32, "gaps": [("linear_equations", "root"), ("algebra_basics", "confirmed"), ("fractions", "suspected")]},
            {"name": "Karan Malhotra", "class": 6, "subject": "Mathematics", "mastery": 78, "gaps": [("decimals", "fixed")]},
            {"name": "Meera Iyer", "class": 7, "subject": "Science", "mastery": 82, "gaps": [("convection", "fixed")]},
            {"name": "Arjun Rao", "class": 7, "subject": "Mathematics", "mastery": 48, "gaps": [("fractions", "root"), ("decimals", "confirmed"), ("linear_equations", "suspected")]},
            {"name": "Aditi Joshi", "class": 8, "subject": "Science", "mastery": 50, "gaps": [("density", "root"), ("convection", "confirmed")]},
            {"name": "Siddharth Sen", "class": 9, "subject": "Mathematics", "mastery": 70, "gaps": [("algebra_basics", "confirmed")]},
            {"name": "Kavya Menon", "class": 6, "subject": "Science", "mastery": 35, "gaps": [("density", "root"), ("fractions", "root")]},
            {"name": "Yash Vardhan", "class": 10, "subject": "Mathematics", "mastery": 60, "gaps": [("linear_equations", "confirmed")]},
            {"name": "Tanvi Hegde", "class": 7, "subject": "English", "mastery": 85, "gaps": []},
            {"name": "Rishabh Goel", "class": 8, "subject": "Social Science", "mastery": 90, "gaps": []},
            {"name": "Ishita Saxena", "class": 5, "subject": "Mathematics", "mastery": 58, "gaps": [("fractions", "confirmed")]},
            {"name": "Pranav Shah", "class": 6, "subject": "Science", "mastery": 68, "gaps": [("convection", "confirmed")]},
            {"name": "Riya Kapoor", "class": 7, "subject": "Hindi", "mastery": 95, "gaps": []},
            {"name": "Nikhil Bose", "class": 9, "subject": "Science", "mastery": 40, "gaps": [("density", "root"), ("fractions", "confirmed")]},
            {"name": "Shreya Ghosh", "class": 8, "subject": "Mathematics", "mastery": 75, "gaps": [("algebra_basics", "confirmed")]},
            {"name": "Varun Mehta", "class": 7, "subject": "Science", "mastery": 52, "gaps": [("density", "confirmed"), ("convection", "confirmed")]},
            {"name": "Nehal Chawla", "class": 6, "subject": "Mathematics", "mastery": 80, "gaps": [("fractions", "fixed")]}
        ]

        for s in mock_students:
            session_id = str(uuid.uuid4())
            days_ago = random.randint(3, 10)
            created_at = (datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0, 23))).isoformat()
            updated_at = (datetime.utcnow() - timedelta(minutes=random.randint(15, 2000))).isoformat()

            session_data = {
                "id": session_id,
                "student_name": s["name"],
                "student_class": s["class"],
                "subject": s["subject"],
                "language": "English" if random.random() > 0.15 else "Hindi",
                "mastery_score": s["mastery"],
                "created_at": created_at,
                "updated_at": updated_at
            }
            supabase.table("sessions").insert(session_data).execute()

            # Gaps Seeding
            for g_id, status in s["gaps"]:
                gap_data = {
                    "session_id": session_id,
                    "concept_id": g_id,
                    "concept_label": g_id.replace("_", " ").capitalize(),
                    "status": status,
                    "detected_at": (datetime.fromisoformat(created_at) + timedelta(hours=random.randint(1, 10))).isoformat()
                }
                supabase.table("gaps").insert(gap_data).execute()

            # Chat History Seeding
            chat_samples = [
                ("student", f"Namaste! I am struggling to understand {s['subject']} concepts like {s['gaps'][0][0].replace('_', ' ') if s['gaps'] else 'this chapter'}."),
                ("curios", f"Namaste! Don't worry, let's learn it step-by-step. What do you think is the first rule we apply here?"),
                ("student", "I think we just try to solve it, but my calculation keeps going wrong."),
                ("curios", f"Ah, that usually happens if the core concept is unclear. Let's practice with an example! If we have {s['gaps'][0][0].replace('_', ' ') if s['gaps'] else 'a core term'}, how would you explain it in your own words?")
            ]
            for idx, (role, content) in enumerate(chat_samples):
                msg_data = {
                    "session_id": session_id,
                    "role": role,
                    "content": content,
                    "created_at": (datetime.fromisoformat(created_at) + timedelta(minutes=5 + idx * 5)).isoformat()
                }
                try:
                    supabase.table("chat_messages").insert(msg_data).execute()
                except Exception:
                    pass

            # Fetch valid chapters
            ch_list = []
            try:
                ch_res = supabase.table("chapters").select("id, title").eq("class_no", s["class"]).eq("subject", s["subject"]).execute()
                ch_list = ch_res.data or []
            except Exception:
                pass

            # Quiz attempts seeding
            num_quizzes = random.randint(1, 3)
            for attempt_idx in range(num_quizzes):
                attempt_id = str(uuid.uuid4())
                score = random.randint(3, 9)
                total = 10
                pct = (score / total) * 100

                ch_id = None
                ch_title = f"Chapter {attempt_idx + 1}: Foundations"
                if ch_list:
                    ch_obj = ch_list[attempt_idx % len(ch_list)]
                    ch_id = ch_obj["id"]
                    ch_title = ch_obj["title"]

                attempt_data = {
                    "id": attempt_id,
                    "session_id": session_id,
                    "chapter_id": ch_id,
                    "chapter_title": ch_title,
                    "subject": s["subject"],
                    "score": score,
                    "total_questions": total,
                    "percentage": pct,
                    "concept_analysis": {g[0]: "gap" if g[1] in ["root", "confirmed"] else "mastered" for g in s["gaps"]},
                    "new_gaps_detected": [g[0] for g in s["gaps"] if g[1] in ["root", "confirmed"]],
                    "completed_at": (datetime.fromisoformat(created_at) + timedelta(days=attempt_idx + 1, hours=random.randint(1, 5))).isoformat()
                }
                supabase.table("quiz_attempts").insert(attempt_data).execute()

                # Quiz Answers
                answers_list = []
                for q_idx in range(1, 11):
                    correct = q_idx <= score
                    concept_tested = s["gaps"][q_idx % len(s["gaps"])][0] if s["gaps"] else "general"
                    answers_list.append({
                        "attempt_id": attempt_id,
                        "question_text": f"Evaluate standard case for {concept_tested.replace('_', ' ')} question {q_idx}",
                        "question_type": "mcq" if q_idx % 2 == 0 else "true_false",
                        "student_answer": "Option A" if correct else "Incorrect Option B",
                        "correct_answer": "Option A",
                        "is_correct": correct,
                        "concept_tested": concept_tested,
                        "answered_at": attempt_data["completed_at"]
                    })
                supabase.table("quiz_answers").insert(answers_list).execute()

        print("[SUCCESS] Real NCERT mock classroom data populated successfully in Supabase!")
    except Exception as e:
        print(f"[WARN] Seeding database failed: {e}. Falling back to in-memory local data.")
