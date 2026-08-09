import os
import json
import logging
import random
from openai import AsyncOpenAI
from dotenv import load_dotenv
import hashlib
import re

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Initialize API clients
clients = {}

# 1. Groq (Primary)
groq_api_key = os.getenv("GROQ_API_KEY")
if groq_api_key:
    clients["groq"] = AsyncOpenAI(api_key=groq_api_key, base_url="https://api.groq.com/openai/v1")
    logger.info("Groq API initialized.")
else:
    logger.warning("GROQ_API_KEY not found.")

# 2. Gemini (Secondary)
gemini_api_key = os.getenv("GEMINI_API_KEY")
if gemini_api_key:
    clients["gemini"] = AsyncOpenAI(api_key=gemini_api_key, base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
    logger.info("Gemini API initialized.")
else:
    logger.warning("GEMINI_API_KEY not found.")

# 3. OpenRouter (Tertiary)
openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
if openrouter_api_key:
    clients["openrouter"] = AsyncOpenAI(api_key=openrouter_api_key, base_url="https://openrouter.ai/api/v1")
    logger.info("OpenRouter API initialized.")
else:
    logger.warning("OPENROUTER_API_KEY not found.")

# Provider and Model configurations in order of priority
FALLBACK_CONFIGS = [
    # Groq (Primary & Fast Fallbacks)
    {"provider": "groq", "model": "llama-3.3-70b-versatile"},
    {"provider": "groq", "model": "llama-3.1-8b-instant"},
    {"provider": "groq", "model": "llama-3.2-3b-preview"},
    
    # Gemini (Secondary Fallbacks)
    {"provider": "gemini", "model": "gemini-1.5-flash"},
    {"provider": "gemini", "model": "gemini-1.5-pro"},
    {"provider": "gemini", "model": "gemini-2.5-flash"},
    
    # OpenRouter (Tertiary Fallbacks)
    {"provider": "openrouter", "model": "meta-llama/llama-3.3-70b-instruct"},
    {"provider": "openrouter", "model": "meta-llama/llama-3.1-8b-instruct"},
    {"provider": "openrouter", "model": "google/gemma-2-9b-it"},
    {"provider": "openrouter", "model": "google/gemma-4-31b-it:free"},
    {"provider": "openrouter", "model": "openai/gpt-oss-20b:free"}
]
AI_REQUEST_TIMEOUT_SECONDS = int(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "45"))

def preprocess_extracted_text(text: str) -> str:
    if not text:
        return ""
    
    lines = text.split('\n')
    cleaned_lines = []
    seen_lines = set()
    
    structure_patterns = [
        r'^\s*page\s+\d+\s*of\s*\d+\s*$', 
        r'^\s*page\s+\d+\s*$',            
        r'^\s*\d+\s*$',                   
        r'^\s*table\s+of\s+contents\s*$',  
        r'^\s*contents\s*$',              
        r'^\s*index\s*$',                 
        r'^\s*unit\s+\d+\s*$',            
        r'^\s*chapter\s+\d+\s*$',         
        r'^\s*heading\s*$',               
        r'^\s*page\s+no\.?\s*$',          
    ]
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
            
        is_structure = False
        for pattern in structure_patterns:
            if re.match(pattern, stripped, re.IGNORECASE):
                is_structure = True
                break
        if is_structure:
            continue
            
        if re.search(r'\.{3,}\s*\d+', stripped) or re.search(r'_{3,}\s*\d+', stripped):
            continue
            
        if len(stripped) < 3 and not stripped.isalnum():
            continue
            
        lower_line = stripped.lower()
        if lower_line in seen_lines:
            if len(stripped) > 20:
                continue
        else:
            seen_lines.add(lower_line)
            
        cleaned_lines.append(line)
        
    return "\n".join(cleaned_lines)

def _word_overlap_ratio(q1: str, q2: str) -> float:
    stop_overlap = {"the", "and", "for", "are", "was", "has", "had", "but", "not", "all", "can", "its", "may", "per", "see", "two", "way", "use", "new", "also", "each", "than", "any", "how", "why", "who", "which", "what", "this", "that", "with", "from", "into", "they", "were", "when", "where", "will", "have", "been", "would", "should", "could", "about", "their", "there", "these", "those", "being", "while", "after", "before", "between", "through", "during"}
    words1 = set(w.strip(".,;:!?").lower() for w in q1.split() if len(w) >= 3 and w.strip(".,;:!?").lower() not in stop_overlap)
    words2 = set(w.strip(".,;:!?").lower() for w in q2.split() if len(w) >= 3 and w.strip(".,;:!?").lower() not in stop_overlap)
    if not words1 or not words2:
        return 0.0
    intersection = words1 & words2
    return len(intersection) / max(len(words1), len(words2))

def validate_and_clean_questions(data: dict, text: str = "") -> dict:
    invalid_keywords = {"contents", "page no", "page number", "index", "table of contents", "formatting", "unit", "chapter", "heading"}
    
    # 1. Written Test
    if "short_questions" in data and isinstance(data["short_questions"], list):
        seen_exact = set()
        seen_semantic = []
        cleaned_sq = []
        for q in data["short_questions"]:
            q_str = str(q).strip()
            q_lower = q_str.lower()
            if not q_str:
                continue
            if q_lower in seen_exact:
                continue
            if any(kw in q_lower for kw in invalid_keywords):
                continue
            is_duplicate = False
            for existing in seen_semantic:
                if _word_overlap_ratio(q_str, existing) >= 0.50:
                    is_duplicate = True
                    break
            if is_duplicate:
                continue
            seen_exact.add(q_lower)
            seen_semantic.append(q_str)
            cleaned_sq.append(q_str)
        if len(cleaned_sq) < 10 and text:
            terms = _keywords(text, 20)
            fallback_templates = [
                "Explain the significance and key principles of {t} as discussed in the material.",
                "Analyze the role of {t} within the broader context of the subject.",
                "Describe how {t} contributes to the overall understanding of the topic.",
                "Compare and contrast {t} with related concepts from the material.",
                "Discuss the practical applications and implications of {t}.",
                "Evaluate the importance of {t} based on the information provided.",
                "Trace the development or process of {t} as outlined in the source.",
                "What are the fundamental characteristics and functions of {t}?",
                "Summarize the key points about {t} and explain why they matter.",
                "How does {t} relate to other major concepts presented in the material?",
            ]
            used_terms = set()
            for q in cleaned_sq:
                for word in q.split():
                    cleaned = word.strip(".,;:!?").lower()
                    if len(cleaned) > 3:
                        used_terms.add(cleaned)
            for template in fallback_templates:
                if len(cleaned_sq) >= 10:
                    break
                for term in terms[:20]:
                    if term.lower() in used_terms:
                        continue
                    fallback_q = template.replace("{t}", term)
                    fallback_lower = fallback_q.lower()
                    if fallback_lower in seen_exact:
                        continue
                    if any(kw in fallback_lower for kw in invalid_keywords):
                        continue
                    is_dup = any(_word_overlap_ratio(fallback_q, ex) >= 0.50 for ex in seen_semantic)
                    if is_dup:
                        continue
                    seen_exact.add(fallback_lower)
                    seen_semantic.append(fallback_q)
                    cleaned_sq.append(fallback_q)
                    used_terms.add(term.lower())
                    break
        data["short_questions"] = cleaned_sq[:10]
        
    # 2. Fill-in-the-Blank
    if "fill_blanks" in data and isinstance(data["fill_blanks"], list):
        cleaned_fb = []
        seen_sentences = set()
        seen_words = set()
        for fb in data["fill_blanks"]:
            if not isinstance(fb, dict):
                continue
            sentence = str(fb.get("sentence", "")).strip()
            blank_word = str(fb.get("blank_word", "")).strip()
            
            sent_lower = sentence.lower()
            word_lower = blank_word.lower()
            
            if not sentence or not blank_word or len(blank_word) < 2:
                continue
            if sent_lower in seen_sentences or word_lower in seen_words:
                continue
            if any(kw in sent_lower or kw in word_lower for kw in invalid_keywords):
                continue
            if "____" not in sentence:
                pattern = re.compile(rf"\b{re.escape(blank_word)}\b", re.IGNORECASE)
                if pattern.search(sentence):
                    sentence = pattern.sub("____", sentence, count=1)
                else:
                    continue
            
            sentence = re.sub(r'(_{2,}(?:\s+_{2,})*)', '____', sentence)
            
            seen_sentences.add(sent_lower)
            seen_words.add(word_lower)
            cleaned_fb.append({
                "sentence": sentence,
                "blank_word": blank_word
            })
        data["fill_blanks"] = cleaned_fb[:15]
        
    # 3. True/False
    if "true_false" in data and isinstance(data["true_false"], list):
        seen_exact = set()
        seen_semantic = []
        cleaned_tf = []
        true_count = 0
        false_count = 0
        for tf in data["true_false"]:
            if not isinstance(tf, dict):
                continue
            statement = str(tf.get("statement", "")).strip()
            answer = tf.get("answer")
            explanation = str(tf.get("explanation", "")).strip()
            if not statement or answer not in (True, False) or not explanation:
                continue
            s_lower = statement.lower()
            if s_lower in seen_exact:
                continue
            if any(kw in s_lower for kw in invalid_keywords):
                continue
            is_dup = any(_word_overlap_ratio(statement, ex) >= 0.50 for ex in seen_semantic)
            if is_dup:
                continue
            seen_exact.add(s_lower)
            seen_semantic.append(statement)
            cleaned_tf.append(tf)
            if answer is True:
                true_count += 1
            else:
                false_count += 1
        if len(cleaned_tf) < 15 and text:
            sentences = _extract_sentences(text, 30)
            tf_templates = [
                ("According to the material, {s}", True),
                ("The material states that {s}", True),
                ("{s} is one of the key concepts discussed.", True),
                ("The source material contradicts the idea that {s}", False),
                ("{s} is NOT mentioned in the source material.", False),
                ("Based on the material, {s} is incorrect.", False),
                ("{s} as described in the material.", True),
                ("The material suggests that {s} is false.", False),
                ("The source confirms that {s}", True),
                ("The material explicitly rejects the claim that {s}", False),
                ("{s} is a central theme in the source.", True),
                ("There is no evidence in the material for {s}", False),
                ("The material verifies that {s}", True),
                ("{s} is contradicted by the source material.", False),
                ("One of the key findings is that {s}", True),
                ("The material does not support the statement that {s}", False),
            ]
            tf_explanations = {
                True: "This statement is directly supported by the source material.",
                False: "The source material does not support or contradicts this statement.",
            }
            used_statements = set(s.lower() for s in seen_exact)
            sent_idx = 0
            for template_stmt, template_ans in tf_templates:
                if len(cleaned_tf) >= 15:
                    break
                for _ in range(len(sentences)):
                    sent = sentences[sent_idx % len(sentences)]
                    sent_idx += 1
                    sent_stripped = sent.strip()
                    if not sent_stripped:
                        continue
                    sent_first_word = sent_stripped.split()[0] if sent_stripped.split() else "it"
                    fallback_tf = {
                        "statement": template_stmt.replace("{s}", sent_stripped),
                        "answer": template_ans,
                        "explanation": tf_explanations[template_ans],
                    }
                    fb_lower = fallback_tf["statement"].lower()
                    if fb_lower in used_statements:
                        continue
                    if any(_word_overlap_ratio(fallback_tf["statement"], ex) >= 0.50 for ex in seen_semantic):
                        continue
                    used_statements.add(fb_lower)
                    seen_semantic.append(fallback_tf["statement"])
                    cleaned_tf.append(fallback_tf)
                    if template_ans:
                        true_count += 1
                    else:
                        false_count += 1
                    break
        # Ensure balance: at least 5 of each True/False
        if len(cleaned_tf) == 15:
            if false_count < 5:
                for i in range(len(cleaned_tf)):
                    if cleaned_tf[i].get("answer") is True and false_count < 5:
                        cleaned_tf[i]["answer"] = False
                        cleaned_tf[i]["explanation"] = "The source material does not support this claim as stated."
                        false_count += 1
                        true_count -= 1
                        if false_count >= 5:
                            break
            elif true_count < 5:
                for i in range(len(cleaned_tf)):
                    if cleaned_tf[i].get("answer") is False and true_count < 5:
                        cleaned_tf[i]["answer"] = True
                        cleaned_tf[i]["explanation"] = "The source material supports this statement."
                        true_count += 1
                        false_count -= 1
                        if true_count >= 5:
                            break
        data["true_false"] = cleaned_tf[:15]
        
    # 4. Multiple Choice (Quiz)
    if "quiz" in data and isinstance(data["quiz"], list):
        seen_exact = set()
        seen_semantic = []
        cleaned_quiz = []
        for q in data["quiz"]:
            if not isinstance(q, dict):
                continue
            question = str(q.get("question", "")).strip()
            options = q.get("options", [])
            correct = q.get("correct_answer", "")
            if not question or not isinstance(options, list) or len(options) != 4 or not correct:
                continue
            if correct not in options:
                continue
            if len(set(o.strip().lower() for o in options if isinstance(o, str))) < 4:
                continue
            q_lower = question.lower()
            if q_lower in seen_exact:
                continue
            if any(kw in q_lower for kw in invalid_keywords):
                continue
            is_dup = any(_word_overlap_ratio(question, ex) >= 0.50 for ex in seen_semantic)
            if is_dup:
                continue
            seen_exact.add(q_lower)
            seen_semantic.append(question)
            cleaned_quiz.append(q)
        if len(cleaned_quiz) < 15 and text:
            sentences = _extract_sentences(text, 30)
            terms = _keywords(text, 15)
            used_statements = set(s.lower() for s in seen_exact)
            question_templates = [
                "Which of the following best reflects what the source material says about {t}?",
                "According to the source, what is true regarding {t}?",
                "Based on the material, which statement about {t} is correct?",
                "What does the source material indicate about {t}?",
                "Which claim about {t} is supported by the source?",
            ]
            for i, sent in enumerate(sentences):
                if len(cleaned_quiz) >= 15:
                    break
                sent_stripped = sent.strip().rstrip(".!?")
                if not sent_stripped:
                    continue
                sent_lower = sent_stripped.lower()
                if sent_lower in used_statements:
                    continue
                if any(_word_overlap_ratio(sent_stripped, ex) >= 0.50 for ex in seen_semantic):
                    continue
                sent_words = [w.strip(".,;:!?").lower() for w in sent_stripped.split() if len(w.strip(".,;:!?")) >= 4]
                found_term = next((t for t in terms if t.lower() in sent_lower), next((w for w in sent_words if w not in ["this", "that", "with", "from", "they", "were", "have", "been", "about", "their", "there", "these", "those"]), "the topic"))
                wrong_answers = [
                    f"The source material does not mention {found_term} in this context.",
                    f"This statement about {found_term} contradicts the source material.",
                    f"The material provides no evidence for this claim about {found_term}.",
                ]
                template = question_templates[i % len(question_templates)]
                fallback_q = {
                    "question": template.replace("{t}", found_term),
                    "options": [sent_stripped + ".", wrong_answers[0], wrong_answers[1], wrong_answers[2]],
                    "correct_answer": sent_stripped + ".",
                }
                fb_lower = fallback_q["question"].lower()
                if fb_lower in used_statements:
                    continue
                used_statements.add(fb_lower)
                seen_semantic.append(fallback_q["question"])
                cleaned_quiz.append(fallback_q)
        data["quiz"] = cleaned_quiz[:15]
        
    # 5. Notes
    if "summary" in data and isinstance(data["summary"], str) and data["summary"].strip():
        summary = data["summary"].strip()
        # Remove duplicate section headings (same heading text appearing more than once)
        heading_pattern = re.compile(r'^(#{1,4}\s+.+)$', re.MULTILINE)
        seen_headings = set()
        parts = []
        for part in heading_pattern.split(summary):
            if heading_pattern.match(part.strip()):
                heading_lower = part.strip().lower()
                if heading_lower in seen_headings:
                    continue
                seen_headings.add(heading_lower)
            parts.append(part)
        data["summary"] = "".join(parts).strip()
        # If summary is too short or has no section headings, flag it but keep content
        if len(data["summary"]) < 200:
            pass
    elif "summary" in data:
        data["summary"] = ""

    # 6. Flashcards
    if "flashcards" in data and isinstance(data["flashcards"], list):
        seen_exact = set()
        seen_semantic = []
        cleaned_fc = []
        for fc in data["flashcards"]:
            if not isinstance(fc, dict):
                continue
            question = str(fc.get("question", "")).strip()
            answer = str(fc.get("answer", "")).strip()
            difficulty = str(fc.get("difficulty", "medium")).strip().lower()
            if not question or not answer:
                continue
            q_lower = question.lower()
            if q_lower in seen_exact:
                continue
            if any(kw in q_lower or kw in answer.lower() for kw in invalid_keywords):
                continue
            is_dup = any(_word_overlap_ratio(question, ex) >= 0.50 for ex in seen_semantic)
            if is_dup:
                continue
            seen_exact.add(q_lower)
            seen_semantic.append(question)
            cleaned_fc.append({
                "question": question,
                "answer": answer,
                "difficulty": difficulty if difficulty in ("easy", "medium", "hard") else "medium"
            })
            
        if len(cleaned_fc) < 10 and text:
            terms = _keywords(text, 25)
            sentences = _extract_sentences(text, 35)
            used_questions = set(q.lower() for q in seen_exact)
            
            for term in terms:
                if len(cleaned_fc) >= 10:
                    break
                pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
                matching_sentence = None
                for sent in sentences:
                    if pattern.search(sent) and len(sent) > 30:
                        if not any(_word_overlap_ratio(sent, ex) >= 0.50 for ex in seen_semantic):
                            matching_sentence = sent
                            break
                if not matching_sentence:
                    # Fallback to a relevant sentence
                    for sent in sentences:
                        if len(sent) > 40:
                            if not any(_word_overlap_ratio(sent, ex) >= 0.50 for ex in seen_semantic):
                                matching_sentence = sent
                                break
                if not matching_sentence:
                    matching_sentence = sentences[0] if sentences else "This concept is a key topic in the uploaded material."
                
                fallback_q = f"Explain the concept and significance of {term}."
                fallback_a = matching_sentence.strip()
                fb_lower = fallback_q.lower()
                if fb_lower in used_questions:
                    continue
                used_questions.add(fb_lower)
                seen_semantic.append(fallback_q)
                cleaned_fc.append({
                    "question": fallback_q,
                    "answer": fallback_a,
                    "difficulty": "medium"
                })
        data["flashcards"] = cleaned_fc[:10]

    return data

def _extract_sentences(text: str, limit: int = 15) -> list:
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text.strip()) if len(s.strip()) > 20]
    if sentences:
        return sentences[:limit]
    words = text.split()
    return [" ".join(words[i:i + 18]).strip() for i in range(0, min(len(words), limit * 18), 18) if words[i:i + 18]]

def _keywords(text: str, limit: int = 15) -> list:
    stop_words = {
        "about", "after", "again", "also", "because", "before", "being", "between", "could",
        "during", "their", "there", "these", "those", "through", "under", "using", "which",
        "while", "would", "with", "from", "into", "that", "this", "they", "were", "what",
    }
    seen = set()
    terms = []
    for match in re.finditer(r"\b[A-Za-z][A-Za-z-]{3,}\b", text):
        term = match.group(0).strip(".,;:!?")
        key = term.lower()
        if key in stop_words or key in seen:
            continue
        seen.add(key)
        terms.append(term)
        if len(terms) >= limit:
            break
    return terms

def _ensure_requested_modules(data: dict, text: str, modules: list) -> dict:
    sentences = _extract_sentences(text)
    terms = _keywords(text)
    first_sentence = sentences[0] if sentences else text[:160].strip() or "The source material contains study information."

    if "Flashcards" in modules and not data.get("flashcards"):
        flashcards_list = []
        used_answers = set()
        for term in (terms[:15] or ["the main topic"]):
            if len(flashcards_list) >= 10:
                break
            pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
            matching_sentence = None
            for sent in sentences:
                if pattern.search(sent) and len(sent) > 30 and sent.lower() not in used_answers:
                    matching_sentence = sent
                    break
            if not matching_sentence:
                matching_sentence = first_sentence
            
            flashcards_list.append({
                "question": f"Explain the concept of {term} as discussed in the material.",
                "answer": matching_sentence.strip(),
                "difficulty": "medium"
            })
            used_answers.add(matching_sentence.lower())
        
        # Ensure we have exactly 10 flashcards even if terms count is small
        while len(flashcards_list) < 10:
            sent = sentences[len(flashcards_list) % len(sentences)] if sentences else first_sentence
            flashcards_list.append({
                "question": f"What is one of the key points discussed in this material regarding {terms[0] if terms else 'the main topic'}?",
                "answer": sent.strip(),
                "difficulty": "easy"
            })
        data["flashcards"] = flashcards_list

    if ("Multiple Choice (Quiz)" in modules or "Quiz" in modules) and not data.get("quiz"):
        all_sentences = _extract_sentences(text, 30)
        all_terms = _keywords(text, 20)
        quiz_items = []
        used_quiz = set()
        for i, sent in enumerate(all_sentences):
            if len(quiz_items) >= 15:
                break
            sent_clean = sent.strip().rstrip(".!?")
            if not sent_clean:
                continue
            s_lower = sent_clean.lower()
            if s_lower in used_quiz:
                continue
            used_quiz.add(s_lower)
            matched_term = next((t for t in all_terms if t.lower() in s_lower), all_terms[i % len(all_terms)] if all_terms else "the topic")
            distractors = [
                f"This statement about {matched_term} is not found in the material.",
                f"The source material contradicts this claim about {matched_term}.",
                f"This describes a concept unrelated to {matched_term}.",
            ]
            quiz_items.append({
                "question": f"According to the source material, which of the following is true about {matched_term}?",
                "options": [sent_clean + ".", distractors[0], distractors[1], distractors[2]],
                "correct_answer": sent_clean + ".",
            })
        data["quiz"] = quiz_items[:15] or [{
            "question": "Which statement is supported by the source material?",
            "options": [first_sentence, "The material does not provide any study content.", "The topic is unrelated to the source.", "None of the above."],
            "correct_answer": first_sentence,
        }]

    if "Fill-in-the-Blank" in modules and not data.get("fill_blanks"):
        blanks = []
        for term in terms[:15]:
            pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
            sentence = next((s for s in sentences if pattern.search(s)), first_sentence)
            blanks.append({"sentence": pattern.sub("____", sentence, count=1), "blank_word": term})
        data["fill_blanks"] = blanks

    if "Written Test" in modules and not data.get("short_questions"):
        templates = [
            "Explain the key principles and importance of {t} in the study material.",
            "Analyze the role and significance of {t} as discussed in the source.",
            "Describe how {t} functions within the broader framework of the subject.",
            "Compare and contrast {t} with other key concepts from the material.",
            "What are the main characteristics and applications of {t}?",
            "Discuss the practical implications and real-world relevance of {t}.",
            "Trace the development or process of {t} as outlined in the source.",
            "Evaluate the contribution of {t} to the overall topic.",
            "Summarize the critical points about {t} and their importance.",
            "How does {t} interconnect with other major ideas presented?",
        ]
        used = set()
        questions = []
        for i, term in enumerate(terms[:20] or ["the main topic"]):
            if len(questions) >= 10:
                break
            if term.lower() in used:
                continue
            used.add(term.lower())
            questions.append(templates[i % len(templates)].replace("{t}", term))
        data["short_questions"] = questions[:10]

    if any(m in modules for m in ["True/False", "True / False", "True/False (Quiz)"]) and not data.get("true_false"):
        all_sentences = _extract_sentences(text, 30)
        true_items = []
        false_items = []
        seen_tf = set()
        for i, sentence in enumerate(all_sentences):
            if len(true_items) >= 8 and len(false_items) >= 7:
                break
            s_lower = sentence.lower()
            if s_lower in seen_tf:
                continue
            seen_tf.add(s_lower)
            if len(true_items) <= len(false_items) or i % 2 == 0:
                statement = sentence.rstrip(".!?") + "."
                true_items.append({
                    "statement": statement,
                    "answer": True,
                    "explanation": "This statement is directly supported by the source material."
                })
            else:
                sentence_clean = sentence.rstrip(".!?")
                verb_pattern = re.search(r'\b(is|are|was|were|has|have|had|can|could|will|would|shall|should|may|might|must|does|do|contains|includes|refers|produces|requires|uses|follows|involves|creates|forms|consists|comprises|depends|relates|applies|occurs|takes|gives|shows|represents|describes|defines|illustrates|demonstrates|indicates)\b', sentence_clean, re.IGNORECASE)
                if verb_pattern and len(sentence_clean.split()) > 5:
                    verb = verb_pattern.group(1)
                    negated = f"does not {verb}" if verb.lower() in ("does", "contains", "includes", "refers", "produces", "requires", "uses", "follows", "involves", "creates", "forms", "consists", "comprises", "depends", "relates", "applies", "occurs", "takes", "gives", "shows", "represents", "describes", "defines", "illustrates", "demonstrates", "indicates") else f"{verb} not"
                    false_statement = sentence_clean.replace(verb, negated, 1).rstrip(".!?") + "."
                    false_items.append({
                        "statement": false_statement,
                        "answer": False,
                        "explanation": "The source material contradicts this modified statement."
                    })
                else:
                    true_items.append({
                        "statement": sentence_clean + ".",
                        "answer": True,
                        "explanation": "This statement is directly supported by the source material."
                    })
        combined = true_items[:8] + false_items[:7]
        random.shuffle(combined)
        data["true_false"] = combined[:15] or [{
            "statement": "The source material contains information that can be reviewed.",
            "answer": True,
            "explanation": "The uploaded or extracted text was used to build the study set."
        }]

    if "Notes" in modules and not data.get("summary"):
        lines = []
        topic_title = next((t for t in terms if t[0].isupper()), terms[0] if terms else "Topic Overview")
        lines.append(f"# Study Guide: {topic_title}")
        lines.append("")
        lines.append("## Introduction / Overview")
        lines.append("")
        lines.append(sentences[0] if sentences else "This material covers key concepts and information about the subject.")
        lines.append("")
        lines.append("## Main Topics")
        lines.append("")
        for s in sentences[:8]:
            short = s.strip().rstrip(".!?").split(". ")[0] if ". " in s else s.strip().rstrip(".!?")
            lines.append(f"- {short}")
        lines.append("")
        lines.append("## Detailed Explanation")
        lines.append("")
        for i, sentence in enumerate(sentences[:12]):
            first_words = " ".join(sentence.split()[:5]).rstrip(",.!?;:")
            lines.append(f"### {first_words}...")
            lines.append("")
            lines.append(f"{sentence} This concept is important for understanding the broader topic.")
            lines.append("")
        lines.append("## Key Definitions")
        lines.append("")
        lines.append("| Term | Definition |")
        lines.append("|------|------------|")
        for term in terms[:8]:
            cap_term = term[0].upper() + term[1:] if term else "Term"
            lines.append(f"| **{cap_term}** | Defined and explained in the context of the source material as a key concept. |")
        lines.append("")
        lines.append("## Key Points to Remember")
        lines.append("")
        for sentence in sentences[:6]:
            lines.append(f"- {sentence.strip().rstrip('.')}.")
        lines.append("")
        lines.append("## Summary")
        lines.append("")
        lines.append("This study guide covered the major topics from the source material. Review each section thoroughly and test your understanding using the other study modes (Flashcards, Quiz, True/False, and Written Test).")
        data["summary"] = "\n".join(lines)
        data["key_points"] = sentences[:5]

    if "Tutor Lesson" in modules and not data.get("tutor_lesson"):
        data["tutor_lesson"] = "# Topic Introduction\n" + first_sentence + "\n\n# Final Summary\nReview the key ideas from the source material and test yourself with the generated modes."

    if "Podcast" in modules and not data.get("podcast_script"):
        data["podcast_script"] = "Welcome to your Cognify study session. " + " ".join(sentences[:5])

    if "definitions" not in data or not isinstance(data.get("definitions"), list):
        data["definitions"] = []

    return data

async def _execute_with_fallback(messages: list, temperature: float = 0.5):
    """Executes a chat completion request across providers with fallback logic."""
    for config in FALLBACK_CONFIGS:
        provider = config["provider"]
        model_name = config["model"]
        
        if provider not in clients:
            continue
            
        try:
            client = clients[provider]
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=temperature
                ),
                timeout=AI_REQUEST_TIMEOUT_SECONDS,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.warning(f"Fallback warning: {provider} model {model_name} failed: {str(e)}")
            continue
            
    raise Exception("All API providers failed.")

# Simple in-memory cache to prevent duplicate requests
TEXT_CACHE = {}

import asyncio

async def _generate_module_group(text: str, modules: list, include_info: bool = False) -> dict:
    if not modules:
        return {}
        
    json_structure = "{\n"
    if include_info:
        json_structure += '      "document_info": {\n'
        json_structure += '        "title": "Document title or inferred title (max 100 chars)",\n'
        json_structure += '        "summary": "Executive summary in 3-4 sentences (max 300 chars)",\n'
        json_structure += '        "key_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],\n'
        json_structure += '        "key_points": ["Important point 1", "Important point 2", "Important point 3", "Important point 4"],\n'
        json_structure += '        "word_count": 1000\n'
        json_structure += '      },\n'
        
    if "Notes" in modules:
        json_structure += '      "summary": "High-quality PowerPoint-style study notes formatted in Markdown. Use slide headings (## Slide X: Title) and bullet points. Must cover EVERYTHING from the material clearly.",\n'
        json_structure += '      "key_points": ["Key point 1", "Key point 2"],\n'
    if "Flashcards" in modules:
        json_structure += '      "flashcards": [{"question": "Q?", "answer": "A", "difficulty": "easy"}],\n'
    if "Multiple Choice (Quiz)" in modules or "Quiz" in modules:
        json_structure += '      "quiz": [{"question": "Q?", "options": ["A", "B", "C", "D"], "correct_answer": "A"}],\n'
    if "Fill-in-the-Blank" in modules:
        json_structure += '      "fill_blanks": [{"sentence": "The cell ____.", "blank_word": "mitochondria"}],\n'
    if "Written Test" in modules:
        json_structure += '      "short_questions": ["Short Q1?", "Short Q2?"],\n'
    if "True/False" in modules or "True / False" in modules or "True/False (Quiz)" in modules:
        json_structure += '      "true_false": [{"statement": "Statement.", "answer": true, "explanation": "Why"}],\n'
    if "Podcast" in modules:
        json_structure += '      "podcast_script": "A highly engaging, conversational, human-like educational podcast script covering the material.",\n'
    
    if "Tutor Lesson" in modules:
        json_structure += '      "tutor_lesson": "A structured, readable lesson formatted in Markdown. Organize into clear sections with headings and subheadings. Break content into paragraphs, explain concepts step-by-step, use bullet points where needed, include examples, and keep language simple and clear. Make lessons interactive and easy to study. SUGGESTED FORMAT: Topic Introduction, Core Explanation, Examples, Important Facts, Common Mistakes, Quick Quiz, Final Summary.",\n'
    
    json_structure += '      "definitions": [{"term": "Term", "definition": "Definition"}]\n    }'

    prompt = f"""
You are Cognify, an intelligent AI study assistant.

Your task is to transform the provided text into a complete, structured, high-quality learning module.

----------------------------------------
GLOBAL ANTI-REPETITION RULE (VERY IMPORTANT)
----------------------------------------
- Do NOT repeat concepts across sections or within the same section
- Each Written Question, MCQ, Fill-in, and Flashcard must test a UNIQUE idea
- Avoid semantic duplication (same idea reworded or approached from a different angle)
- Every question must cover a DIFFERENT topic or subtopic from the material
- Before finalizing, review all generated questions and remove any that test overlapping content
- If duplication occurs, internally regenerate before output

----------------------------------------
EDUCATIONAL CONTENT ONLY (MANDATORY)
----------------------------------------
- You must ignore all structural text, tables of contents, page numbers, page headers, footers, index lists, metadata, and formatting symbols.
- Generate questions and study materials ONLY from actual educational content and learning concepts.
- NEVER generate questions referencing layout or document structures (e.g., do NOT generate questions about "Contents", "Page No.", "Index", "Chapter list", etc.).

"""
    
    if include_info:
        prompt += """----------------------------------------
DOCUMENT INFORMATION EXTRACTION (MANDATORY)
----------------------------------------
- Extract key summary and metadata from the document text.
- Fill the "document_info" field exactly as described in the JSON structure.
- Title should be descriptive (e.g. the main topic discussed).
- Summary should be 3-4 sentences covering the core overview.
- Key concepts should be the 5 most important terms.
- Key points should be the 4 most critical takeaways.
- Provide an estimated word count.

"""

    if any(m in modules for m in ["Multiple Choice (Quiz)", "Quiz", "Fill-in-the-Blank", "Written Test", "Flashcards", "True/False", "True / False", "True/False (Quiz)"]):
        prompt += "----------------------------------------\n"
        prompt += "CRITICAL QUANTITY REQUIREMENTS\n"
        prompt += "----------------------------------------\n"
        if "Multiple Choice (Quiz)" in modules or "Quiz" in modules:
            prompt += "- ALWAYS generate EXACTLY 15 MCQs (`quiz`)\n"
        if "Fill-in-the-Blank" in modules:
            prompt += "- ALWAYS generate EXACTLY 25 Fill-in-the-Blanks (`fill_blanks`) to ensure enough unique, high-quality, concept-specific answers can be validated and filtered down to 15.\n"
        if "Written Test" in modules:
            prompt += "- ALWAYS generate EXACTLY 25 Written Questions (`short_questions`) to allow rigorous validation, deduplication, and filtering down to the best 10.\n"
        if "Flashcards" in modules:
            prompt += "- ALWAYS generate EXACTLY 10 Flashcards (`flashcards`)\n"
        if any(m in modules for m in ["True/False", "True / False", "True/False (Quiz)"]):
            prompt += "- ALWAYS generate EXACTLY 25 True/False Questions (`true_false`) to allow rigorous validation, deduplication, and filtering down to the best 15.\n"
        prompt += "- If text is too short, reduce intelligently without repetition or hallucination\n\n"

    if "Flashcards" in modules:
        prompt += """----------------------------------------
FLASHCARD RULES
----------------------------------------
- Generate EXACTLY 10 relevant, high-quality, and material-centered flashcards.
- Each flashcard must test a UNIQUE and important concept, term, or process from the uploaded material.
- Questions must be clear, specific, and academically significant. Avoid generic questions (e.g., do NOT write "What does the material say about X?").
- Answers must be concise, accurate explanations of the concept or answer to the question, based directly on the source material.
- Assign a difficulty level ("easy", "medium", "hard") to each flashcard based on the depth of the concept.
- Example: {"question": "What is the primary function of mitochondria?", "answer": "To generate most of the chemical energy needed to power the cell's biochemical reactions.", "difficulty": "easy"}
- Output as a list of objects in the "flashcards" field.

"""

    if "Fill-in-the-Blank" in modules:
        prompt += """----------------------------------------
FILL-IN-THE-BLANK RULES
----------------------------------------
- MUST be intelligent, diverse, clean, and non-repetitive.
- Blank ONLY important educational concepts, terms, names, or keywords (e.g. "mitochondria").
- NEVER blank page numbers, headings, formatting symbols, or structural text.
- Questions must come from complete, grammatically correct educational statements.
- Each question must test a different concept.
- Ensure no duplicate questions or blanked answers are generated.
- Example: "The ____ algorithm is used to draw a straight line between two points." (Answer: Bresenham)
- Output format: [{"sentence": "The ____ algorithm...", "blank_word": "Bresenham"}] in the "fill_blanks" field.

"""

    if "Written Test" in modules:
        prompt += """----------------------------------------
WRITTEN TEST RULES (ESSAY/LONG-ANSWER QUESTIONS)
----------------------------------------
- Generate meaningful, academic, examination-style long-answer questions.
- Every question must test the user's understanding of key concepts in the material.
- Questions must require detailed explanations, analysis, or comparisons rather than simple one-word or short answers.
- Cover DIFFERENT major topics from the document. NO TWO questions should test the same concept.
- Be specific to the uploaded educational material; avoid generic or vague questions.
- Do NOT reference structural layout elements.
- Each question must be DISTINCT — if two questions would elicit overlapping answers, regenerate one.
- Aim for breadth: questions should span the full range of the material, not focus on one area.
- Every question must be HIGH-QUALITY: precise, clearly worded, and academically rigorous.
- Example: "Explain the stages involved in the Line Drawing Algorithm.", "Compare 2D and 3D Transformations."
- Output as a list of strings in the "short_questions" field.

"""

    if any(m in modules for m in ["True/False", "True / False", "True/False (Quiz)"]):
        prompt += """----------------------------------------
TRUE/FALSE RULES
----------------------------------------
- Generate meaningful, academic True/False statements that test understanding of key concepts.
- EVERY statement must be DIRECTLY DERIVED from a specific claim in the source material and objectively verifiable as TRUE or FALSE based solely on that material.
- Include a clear, specific explanation for each answer that cites the relevant reasoning from the material.
- Cover DIFFERENT major topics from the document. NO TWO statements should test the same concept.
- Be SPECIFIC to the uploaded educational material. NO generic statements that could apply to any topic (e.g., avoid "This topic is important" or "This concept has many applications").
- Do NOT reference structural layout elements.
- Ensure a BALANCED mix of roughly 50% True and 50% False statements.
- Each statement must be DISTINCT — if two statements test overlapping knowledge, regenerate one.
- Aim for breadth: statements should span the full range of the material, not focus on one area.
- Every statement must be HIGH-QUALITY: precise, clearly worded, and academically rigorous.
- False statements must be PLAUSIBLE and RELEVANT — they should be a modified version of a true claim from the material (e.g., changing a key detail), not a fabricated unrelated statement.
- Example: {"statement": "The Bresenham algorithm uses only integer arithmetic.", "answer": true, "explanation": "Bresenham's line algorithm was designed to use only integer addition, subtraction, and bit shifting."}
- Output as a list of objects in the "true_false" field.

"""

    if "Multiple Choice (Quiz)" in modules or "Quiz" in modules:
        prompt += """----------------------------------------
MULTIPLE CHOICE RULES
----------------------------------------
- Generate meaningful, academic, examination-style multiple choice questions.
- Every question must test the user's understanding of key concepts in the material.
- Cover DIFFERENT major topics from the document. NO TWO questions should test the same concept.
- Be specific to the uploaded educational material; avoid generic or trivial questions.
- Do NOT reference structural layout elements.
- Each question must be DISTINCT — if two questions test overlapping knowledge, regenerate one.
- Aim for breadth: questions should span the full range of the material, not focus on one area.
- Every question must be HIGH-QUALITY: precise, clearly worded, and academically rigorous.
- Provide EXACTLY 4 options per question (A, B, C, D). All options must be plausible and related to the topic.
- The correct answer must be objectively verifiable from the source material.
- Wrong answers (distractors) must be realistic and educational — NOT obviously wrong or humorous.
- Shuffle the position of the correct answer across questions (do not always put it in the same position).
- Include a brief explanation of why the correct answer is right.
- Example: {"question": "Which algorithm uses only integer arithmetic for line drawing?", "options": ["Bresenham", "DDA", "Midpoint", "Digital Differential Analyzer"], "correct_answer": "Bresenham"}
- Output as a list of objects in the "quiz" field.

"""

    if "Notes" in modules:
        prompt += """----------------------------------------
NOTES GENERATION (UNIVERSITY LECTURE SLIDES)
----------------------------------------
Your task is to convert the provided material into a complete set of university lecture slides. The "summary" JSON field MUST contain the ENTIRE lecture formatted in Markdown.

You are a Senior Lecturer preparing slides for your course. Your slides must be self-contained — students should be able to learn the material directly from them without referring to any other source.

LECTURE STYLE:
- Write in the voice of an expert lecturer explaining concepts to a class.
- Use phrases like "Notice that...", "It is important to understand...", "Let us examine...", "Consider the following...", "A common question students ask is...", "The key insight here is...", "To illustrate this point...".
- Connect ideas explicitly: tell students WHY a concept matters, HOW it relates to what they already know, and WHERE it fits in the bigger picture.
- Include mini "Check Your Understanding" prompts throughout to keep students engaged (e.g., "Take a moment to verify you understand why this step is necessary before moving on.").
- Summarize each major section before transitioning to the next.

REQUIRED SLIDE STRUCTURE:

# [Lecture Title]
A clear, descriptive title.

## Lecture Overview
What this lecture covers and why it matters. Set the context.

## Learning Outcomes
By the end of this lecture, students should be able to: (3-5 measurable outcomes)

## [Main Topic 1]
For each major topic, create multiple slides (sections) that include:
- A clear **definition** of the concept.
- An **explanation** in connected, lecture-style prose — not note fragments.
- **Bold** key terms when first introduced; follow with a plain-English explanation.
- **Numbered steps** for processes, algorithms, or procedures.
- **Examples, analogies, or illustrations** that make abstract ideas concrete.
- **Tables** for comparisons, classifications, or structured data.
- **Diagrams described in words** — tell the student what they would see in a slide diagram.
- **Advantages and disadvantages** where applicable.
- A **section summary** before moving to the next topic.

Repeat this pattern for every major topic in the material.

## Key Terms
A reference list or table of all important terms and their definitions.

## Common Pitfalls
What students frequently get wrong, and how to avoid those mistakes.

## Applications
How this knowledge is used in practice, research, or industry.

## Lecture Summary
A concise, bullet-point recap of everything covered.

## Prep for Next Time
2-3 suggestions for what students should review or practice before the next session.

SLIDE FORMATTING CONVENTIONS:
- Each slide (section) uses ## as the heading.
- Sub-points within a slide use ###.
- Use **bold** for key terms and definitions.
- Use `code` for formulas, technical terms, or variable names.
- Use unordered lists (- ) for bullet points.
- Use ordered lists (1. ) for sequential steps.
- Use tables (| col | col |) for comparisons.
- Use blockquotes (>) for important callouts, exam tips, or "Note:" highlights.
- Use horizontal rules (---) between major topics.
- Write in a natural, authoritative teaching voice — like a professor at a whiteboard.

QUALITY STANDARDS:
- Every concept from the material must be covered and explained, not just named.
- Do NOT invent facts, examples, or applications not present in the source.
- No duplicate content — each idea appears once in its most relevant section.
- Ignore structural text (table of contents, page numbers, headers, footers, indexes, formatting artifacts).
- Logical flow: each slide should naturally lead to the next.
- The lecture must be complete enough that a student could study from these slides alone and perform well on an exam.

"""

    if "Podcast" in modules:
        prompt += """----------------------------------------
PODCAST SCRIPT GENERATION
----------------------------------------
Turn the provided material into a highly engaging, human-like educational podcast transcript.

Requirements:
- Do NOT sound robotic or like a summary
- Explain concepts like a great teacher speaking to a student
- Use simple, clear language but still cover all important details
- Add natural expressions like: "Now, here's the interesting part...", "Let's break this down...", "You might be wondering..."
- Use storytelling where possible to explain ideas
- Include real-world examples and analogies to improve understanding
- Break content into short, smooth segments (like a real podcast episode)
- Occasionally recap key ideas naturally (not like bullet points)

Engagement Mode:
- Make the tone conversational, lively, and slightly informal
- Avoid long boring paragraphs-use rhythm and variation
- Add curiosity hooks and transitions to keep the listener interested
- Output the entire script as a single continuous text string in the `podcast_script` JSON field.

"""

    if "Tutor Lesson" in modules:
        prompt += """----------------------------------------
Tutor Lesson SECTION (STRICT STRUCTURE)
----------------------------------------
The "tutor_lesson" MUST follow EXACTLY this format:

# Topic Introduction
# Core Explanation
# Examples
# Important Facts
# Common Mistakes
# Quick Quiz
# Final Summary

- Organize lessons into clear sections using headings and subheadings.
- Break content into paragraphs.
- Explain concepts step-by-step.
- Use bullet points where needed.
- Keep language simple and clear.
- Make lessons interactive and easy to study.

"""

    prompt += f"""----------------------------------------
GENERAL QUALITY RULES
----------------------------------------
- Content MUST match the provided text strictly.
- No vague summaries
- No wall of text
- Must be readable on mobile and desktop
- Act like a real teacher, not a summarizer.

----------------------------------------
OUTPUT FORMAT
----------------------------------------
Return ONLY valid JSON using this exact structure:
{json_structure}

----------------------------------------
TEXT
----------------------------------------
{text[:15000]}
"""
    
    for config in FALLBACK_CONFIGS:
        provider = config["provider"]
        model_name = config["model"]
        
        if provider not in clients:
            continue
            
        try:
            logger.info(f"Calling {provider.upper()} API with model: {model_name} for modules: {modules}")
            
            client = clients[provider]
            
            api_kwargs = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a JSON-only API. You must output ONLY valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
            }
            
            # Response formats differ by provider and model. 
            # Safest is to use response_format for Groq natively.
            if provider == "groq" and ("llama-3" in model_name or "mixtral" in model_name):
                api_kwargs["response_format"] = {"type": "json_object"}
                
            response = await asyncio.wait_for(
                client.chat.completions.create(**api_kwargs),
                timeout=AI_REQUEST_TIMEOUT_SECONDS,
            )
            
            logger.info(f"{provider.upper()} API response received with model {model_name} for {modules}")
            result_content = response.choices[0].message.content
            
            clean_content = result_content.strip()
            # Robust JSON extraction
            start_idx = clean_content.find('{')
            end_idx = clean_content.rfind('}')
            if start_idx != -1 and end_idx != -1:
                clean_content = clean_content[start_idx:end_idx+1]
                
            data = json.loads(clean_content)
            data = validate_and_clean_questions(data, text)
            
            logger.info(f"Successfully generated study modules {modules} with model {model_name}")
            return data
            
        except Exception as model_error:
            logger.warning(f"Model {model_name} failed: {str(model_error)}")
            continue
    
    logger.error(f"All API fallback models failed. Group {modules} will be skipped.")
    return {}

async def generate_flashcards(text: str, card_type: str = "Standard", selected_modules: list = None):
    """
    Calls Groq API to generate a complete study set from text.
    Implements caching and parallel group execution to prevent LLM truncation.
    """
    # Preprocess text to clean non-learning layout and structural elements
    cleaned_text = preprocess_extracted_text(text)
    if not cleaned_text.strip():
        cleaned_text = text

    # 1. Caching logic
    text_hash = hashlib.md5(cleaned_text.encode('utf-8')).hexdigest()
    modules = selected_modules or ["Notes", "Quiz", "Flashcards", "Fill-in-the-Blank", "Written Test", "True/False", "Tutor Lesson", "Podcast"]
    
    module_key = "-".join(sorted(modules))
    cache_key = f"{text_hash}_{card_type}_{module_key}"
    if cache_key in TEXT_CACHE:
        logger.info("Serving generated study set from memory CACHE.")
        return TEXT_CACHE[cache_key]

    logger.info(f"Generating flashcards with card_type: {card_type}, text length: {len(cleaned_text)}")
    
    # 2. Group the modules into exactly 2 parallel calls to avoid rate limits and speed up execution
    group_a = [] # All structured Q&A / assessment elements
    group_b = [] # All prose content (Notes, Tutor, Podcast)
    
    for m in modules:
        if m in ["Notes", "Tutor Lesson", "Podcast"]:
            group_b.append(m)
        else:
            group_a.append(m)
            
    # Execute group generations concurrently
    tasks = []
    if group_a:
        tasks.append(_generate_module_group(cleaned_text, group_a, include_info=True))
    if group_b:
        # If group_a is not generated, put document info in group_b
        include_info_b = not bool(group_a)
        tasks.append(_generate_module_group(cleaned_text, group_b, include_info=include_info_b))
        
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 3. Merge outputs
    final_data = {}
    for res in results:
        if isinstance(res, dict):
            final_data.update(res)
        else:
            logger.error(f"Module generation group failed with error: {res}")
        
    final_data = _ensure_requested_modules(final_data, cleaned_text, modules)
    final_data = validate_and_clean_questions(final_data, cleaned_text)
            
    TEXT_CACHE[cache_key] = final_data
    
    logger.info(f"Successfully merged study modules.")
    return final_data

async def chat_with_ai(messages: list, context_text: str):
    """
    Passes conversational history and source context to the LLM to act as a study tutor.
    """
    system_prompt = f"""You are Cognify, an intelligent AI tutor.

Your primary responsibility is to answer questions based on the provided Source Material.

----------------------------------------
CORE BEHAVIOR
----------------------------------------

1. PRIORITY RULE:
- Always prioritize the Source Material when answering questions.
- If the answer exists in the material, use it strictly.

2. OUT-OF-SCOPE HANDLING:
- If the question is NOT covered in the Source Material:
  - You are allowed to answer using your general knowledge.
  - Clearly indicate that the answer is outside the provided material.

Example:
"This information is not explicitly in the provided material, but here is a general explanation: ..."

3. NO HALLUCINATION RULE:
- Do NOT invent information from the material.
- If unsure, say so clearly.

----------------------------------------
ANSWER STYLE
----------------------------------------

- Be clear, structured, and easy to understand
- Use step-by-step explanations where needed
- Use examples when helpful
- Avoid long, confusing paragraphs

----------------------------------------
CONTEXT USAGE
----------------------------------------

Source Material:
{context_text[:6000]}

----------------------------------------
FINAL INSTRUCTION
----------------------------------------

Always behave like a real tutor:
- Teach clearly
- Stay accurate
- Respect the material
- Provide helpful explanations even beyond the material when necessary
"""
    
    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        api_messages.append({"role": "user" if msg["sender"] == "user" else "assistant", "content": msg["text"]})
        
    try:
        response_text = await _execute_with_fallback(api_messages, temperature=0.5)
        return response_text
    except Exception as e:
        logger.error(f"Chat API failed: {str(e)}")
        raise Exception("Failed to generate AI response.")

async def grade_written_test(questions: list, user_answers: list, context_text: str):
    """
    Uses LLM to grade a written test, returning strict JSON structure with scores and feedback.
    """
    system_prompt = f"""
    You are an expert AI grader. 
    Evaluate the student's written answers to the following questions based strictly on the source material.
    
    Source Material: {context_text[:5000]}
    
    Output strictly as a JSON object with this exact structure:
    {{
       "score": 85,
       "evaluations": [
           {{
              "question": "The question asked...",
              "model_answer": "The ideal correct answer...",
              "user_answer": "What the user wrote...",
              "feedback": "Direct advice on how they can improve..."
           }}
       ]
    }}
    Do NOT output any conversational text outside of the JSON block.
    """
    
    prompt_str = f"Questions: {json.dumps(questions)}\nStudent Answers: {json.dumps(user_answers)}"
    
    try:
        result_content = await _execute_with_fallback([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt_str}
        ], temperature=0.2)
        
        result_content = result_content.strip()
        start_idx = result_content.find('{')
        end_idx = result_content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            result_content = result_content[start_idx:end_idx+1]
        else:
            if result_content.startswith("```json"): result_content = result_content[7:]
            if result_content.startswith("```"): result_content = result_content[3:]
            if result_content.endswith("```"): result_content = result_content[:-3]
            
        return json.loads(result_content.strip())
    except Exception as e:
        logger.error(f"Grade API failed: {str(e)}")
        raise Exception("Failed to evaluate test answers.")

async def generate_mock_exam_questions(text: str, difficulty: str, fallback_data: dict = None) -> list:
    """
    Generates a 30-question mock exam based on provided text (or fallback_data).
    Difficulty: Easy, Medium, Hard, Exam Level.
    Uses 2 parallel calls to prevent LLM timeouts and truncation.
    """
    if not text.strip() and fallback_data:
        text_parts = []
        if fallback_data.get("summary"):
            text_parts.append(f"Summary of study material:\n{fallback_data['summary']}")
        if fallback_data.get("key_points"):
            text_parts.append(f"Key Points:\n{str(fallback_data['key_points'])}")
        if fallback_data.get("quiz"):
            text_parts.append(f"Related Multiple Choice Questions:\n{str(fallback_data['quiz'])}")
        if fallback_data.get("true_false"):
            text_parts.append(f"Related True/False Statements:\n{str(fallback_data['true_false'])}")
        text = "\n\n".join(text_parts)

    if not text.strip():
        text = "General knowledge based on title: " + (fallback_data.get("title") if fallback_data else "Study Set")

    cleaned_text = preprocess_extracted_text(text)
    if not cleaned_text.strip():
        cleaned_text = text

    # Prompt Part 1: 15 MCQs
    prompt_mcq = f"""You are Cognify, an expert EdTech exam designer. Your task is to generate exactly 15 high-quality, academic Multiple Choice Questions (MCQs) based on the provided material.
Difficulty Level: {difficulty}

Instructions:
- The questions must be appropriate for the {difficulty} difficulty:
  - Easy: Focus on simple recall, clear facts, and direct definitions.
  - Medium: Focus on comprehension, application, and understanding of processes.
  - Hard: Focus on analysis, edge cases, multi-step scenarios, and critical thinking.
  - Exam Level: Simulate a rigorous university final exam with a mix of conceptual depth and application challenges.
- Cover different topics/subtopics from the material to ensure breadth.
- Do NOT reference structural layout elements.
- Each MCQ must have exactly 4 options. Shuffled correct option position.
- Provide a brief, clear explanation for why the correct answer is correct.
- Question IDs must start at 1 and go up to 15.
- Return ONLY valid JSON using this exact structure:
{{
  "quiz": [
    {{
      "id": 1,
      "type": "mcq",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Why Option A is correct."
    }}
  ]
}}

Source Material:
{cleaned_text[:15000]}
"""

    # Prompt Part 2: 5 True/False, 5 Fill-in-the-Blank, 5 Short Answer
    prompt_others = f"""You are Cognify, an expert EdTech exam designer. Your task is to generate exactly 5 True/False questions, 5 Fill-in-the-Blank questions, and 5 Short Answer questions based on the provided material.
Difficulty Level: {difficulty}

Instructions:
- The questions must be appropriate for the {difficulty} difficulty.
- Cover different topics from the material to ensure breadth.
- For True/False: statement, correct_answer (boolean true/false), explanation. Question IDs must be 16 to 20.
- For Fill-in-the-Blank: sentence (containing a single "____" blank), blank_word (the exact answer word/phrase), explanation. Question IDs must be 21 to 25.
- For Short Answer: question, correct_answer (what a good response should cover or model answer), explanation. Question IDs must be 26 to 30.
- Return ONLY valid JSON using this exact structure:
{{
  "true_false": [
    {{
      "id": 16,
      "type": "true_false",
      "statement": "True or false statement.",
      "correct_answer": true,
      "explanation": "Explanation of statement."
    }}
  ],
  "fill_blanks": [
    {{
      "id": 21,
      "type": "fill_blank",
      "sentence": "The concept of ____ is important.",
      "blank_word": "Bresenham",
      "explanation": "Explanation of blank word."
    }}
  ],
  "short_answers": [
    {{
      "id": 26,
      "type": "short_answer",
      "question": "Short answer question?",
      "correct_answer": "Model correct response.",
      "explanation": "Brief explanation/criteria for grading."
    }}
  ]
}}

Source Material:
{cleaned_text[:15000]}
"""

    async def fetch_group(prompt_str, expected_key):
        for config in FALLBACK_CONFIGS:
            provider = config["provider"]
            model_name = config["model"]
            if provider not in clients:
                continue
            try:
                client = clients[provider]
                api_kwargs = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": "You are a JSON-only API. You must output ONLY valid JSON."},
                        {"role": "user", "content": prompt_str}
                    ],
                    "temperature": 0.7,
                }
                if provider == "groq" and ("llama-3" in model_name or "mixtral" in model_name):
                    api_kwargs["response_format"] = {"type": "json_object"}
                    
                response = await asyncio.wait_for(
                    client.chat.completions.create(**api_kwargs),
                    timeout=AI_REQUEST_TIMEOUT_SECONDS,
                )
                result_content = response.choices[0].message.content.strip()
                start_idx = result_content.find('{')
                end_idx = result_content.rfind('}')
                if start_idx != -1 and end_idx != -1:
                    result_content = result_content[start_idx:end_idx+1]
                data = json.loads(result_content)
                if expected_key in data or (expected_key == "others" and ("true_false" in data or "fill_blanks" in data)):
                    return data
            except Exception as e:
                logger.warning(f"Mock exam generation fallback: {provider} model {model_name} failed: {str(e)}")
                continue
        return {}

    # Run concurrently
    tasks = [
        fetch_group(prompt_mcq, "quiz"),
        fetch_group(prompt_others, "others")
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    mcq_data = results[0] if isinstance(results[0], dict) else {}
    others_data = results[1] if isinstance(results[1], dict) else {}

    # Combine questions
    combined_questions = []

    # 1. MCQs (1-15)
    mcqs = mcq_data.get("quiz", [])
    if not isinstance(mcqs, list):
        mcqs = []
    for idx, q in enumerate(mcqs[:15]):
        q["id"] = idx + 1
        q["type"] = "mcq"
        combined_questions.append(q)

    # Fill up if MCQs are missing
    while len(combined_questions) < 15:
        idx = len(combined_questions)
        combined_questions.append({
            "id": idx + 1,
            "type": "mcq",
            "question": f"Review question {idx + 1} regarding the main concepts.",
            "options": ["Correct Option", "Alternative Option 1", "Alternative Option 2", "Alternative Option 3"],
            "correct_answer": "Correct Option",
            "explanation": "This is a placeholder question generated due to API formatting issues."
        })

    # 2. True/False (16-20)
    tfs = others_data.get("true_false", [])
    if not isinstance(tfs, list):
        tfs = []
    for idx, q in enumerate(tfs[:5]):
        q["id"] = 16 + idx
        q["type"] = "true_false"
        combined_questions.append(q)

    while len(combined_questions) < 20:
        idx = len(combined_questions) - 16
        combined_questions.append({
            "id": 16 + idx,
            "type": "true_false",
            "statement": "The core concept presented in the study material is correct.",
            "correct_answer": True,
            "explanation": "This statement is true based on the general context of the material."
        })

    # 3. Fill-in-the-Blank (21-25)
    fbs = others_data.get("fill_blanks", [])
    if not isinstance(fbs, list):
        fbs = []
    for idx, q in enumerate(fbs[:5]):
        q["id"] = 21 + idx
        q["type"] = "fill_blank"
        combined_questions.append(q)

    while len(combined_questions) < 25:
        idx = len(combined_questions) - 21
        combined_questions.append({
            "id": 21 + idx,
            "type": "fill_blank",
            "sentence": "The study material is focused on generating ____ mock exams.",
            "blank_word": "AI",
            "explanation": "The feature is named AI Mock Exams."
        })

    # 4. Short Answers (26-30)
    sas = others_data.get("short_answers", [])
    if not isinstance(sas, list):
        sas = []
    for idx, q in enumerate(sas[:5]):
        q["id"] = 26 + idx
        q["type"] = "short_answer"
        combined_questions.append(q)

    while len(combined_questions) < 30:
        idx = len(combined_questions) - 26
        combined_questions.append({
            "id": 26 + idx,
            "type": "short_answer",
            "question": "What is the primary objective of using AI mock exams?",
            "correct_answer": "To simulate a real exam environment and identify areas for improvement.",
            "explanation": "AI mock exams help students test knowledge retention and highlight weak topics."
        })

    return combined_questions

async def grade_mock_exam_short_answers(questions: list, user_answers: dict) -> dict:
    """
    Grades the Short Answer questions using the LLM.
    Returns a dictionary of question_id to dict of {score: int, feedback: str}.
    """
    sa_questions = [q for q in questions if q.get("type") == "short_answer"]
    if not sa_questions:
        return {}

    eval_input = []
    for q in sa_questions:
        qid = str(q.get("id"))
        eval_input.append({
            "id": qid,
            "question": q.get("question"),
            "model_answer": q.get("correct_answer"),
            "user_answer": user_answers.get(qid, "")
        })

    system_prompt = """You are an expert academic grader. Evaluate the student's written answers to the following short answer questions based on the provided correct model answers.
For each question, assign a score out of 10 and provide brief feedback.
Output strictly as a JSON object with this exact structure:
{
  "grades": {
    "26": {
      "score": 8,
      "feedback": "Your explanation was clear but you missed mentioning that DDA uses floating-point calculations."
    }
  }
}
Do NOT output any conversational text outside of the JSON block."""

    prompt_str = f"Questions and Student Answers:\n{json.dumps(eval_input)}"

    try:
        result_content = await _execute_with_fallback([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt_str}
        ], temperature=0.2)
        
        result_content = result_content.strip()
        start_idx = result_content.find('{')
        end_idx = result_content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            result_content = result_content[start_idx:end_idx+1]
        
        data = json.loads(result_content)
        return data.get("grades", {})
    except Exception as e:
        logger.error(f"Mock exam grading API failed: {str(e)}")
        # Fallback grading
        fallback_grades = {}
        for q in sa_questions:
            qid = str(q.get("id"))
            user_ans = user_answers.get(qid, "").strip()
            score = 10 if len(user_ans) > 20 else (5 if len(user_ans) > 5 else 0)
            fallback_grades[qid] = {
                "score": score,
                "feedback": "Graded using fallback logic due to API timeout. Score is based on answer length."
            }
        return fallback_grades

async def analyze_mock_exam_performance(graded_questions: list) -> dict:
    """
    Analyzes student performance on a mock exam using the LLM.
    Identifies Strong Topics, Weak Topics, and Actionable Recommendations.
    """
    # Create a compact representation of the performance
    perf_data = []
    for q in graded_questions:
        perf_data.append({
            "id": q.get("id"),
            "type": q.get("type"),
            "question": q.get("question") or q.get("statement") or q.get("sentence"),
            "user_answer": q.get("user_answer"),
            "correct_answer": q.get("correct_answer") or q.get("blank_word"),
            "is_correct": q.get("is_correct"),
            "score": q.get("score") # only for short_answer
        })

    system_prompt = """You are Cognify, an intelligent AI tutor. Review the student's performance on the mock exam below (containing questions, correct answers, and the student's answers).
Analyze their performance to identify:
1. Strong Topics (list 1-3 topics they showed mastery in, based on correct answers)
2. Weak Topics (list 1-3 topics they struggled with, based on incorrect answers)
3. Recommendations (3 action items for further study)
Output strictly as a JSON object with this exact structure:
{
  "strong_topics": ["Topic A", "Topic B"],
  "weak_topics": ["Topic C", "Topic D"],
  "recommendations": ["Action item 1", "Action item 2", "Action item 3"]
}
Do NOT output any conversational text outside of the JSON block."""

    prompt_str = f"Performance Data:\n{json.dumps(perf_data[:40])}"

    try:
        result_content = await _execute_with_fallback([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt_str}
        ], temperature=0.3)
        
        result_content = result_content.strip()
        start_idx = result_content.find('{')
        end_idx = result_content.rfind('}')
        if start_idx != -1 and end_idx != -1:
            result_content = result_content[start_idx:end_idx+1]
            
        return json.loads(result_content)
    except Exception as e:
        logger.error(f"Performance analysis API failed: {str(e)}")
        return {
            "strong_topics": ["General Comprehension"],
            "weak_topics": ["Review Needed"],
            "recommendations": [
                "Review all incorrect answers in detail.",
                "Reread the study notes for this set.",
                "Generate another mock exam to test your memory again."
            ]
        }


async def _call_gemini_rest(model_name: str, messages: list, images: list, api_key: str) -> str:
    """
    Makes a direct REST call to the Gemini API, bypassing library compatibility layers.
    """
    import requests
    import asyncio
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    contents = []
    system_instruction = None
    
    for msg in messages:
        if msg.get("role") == "system":
            system_instruction = {"parts": [{"text": msg["content"]}]}
            break
            
    for msg in messages:
        role = msg.get("role")
        if role == "system":
            continue
            
        gemini_role = "user" if role == "user" else "model"
        parts = []
        content = msg.get("content")
        
        if isinstance(content, list):
            for part in content:
                if part["type"] == "text":
                    parts.append({"text": part["text"]})
                elif part["type"] == "image_url":
                    img_url = part["image_url"]["url"]
                    if "," in img_url:
                        header, base64_data = img_url.split(",", 1)
                        mime_type = header.split(";")[0].replace("data:", "")
                    else:
                        base64_data = img_url
                        mime_type = "image/jpeg"
                    parts.append({
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_data
                        }
                    })
        else:
            parts.append({"text": content})
            
        contents.append({
            "role": gemini_role,
            "parts": parts
        })
        
    payload = {
        "contents": contents
    }
    if system_instruction:
        payload["systemInstruction"] = system_instruction
        
    res = await asyncio.to_thread(
        requests.post,
        url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=30
    )
    
    if res.status_code != 200:
        raise Exception(f"Gemini API returned status {res.status_code}: {res.text}")
        
    res_data = res.json()
    try:
        text_response = res_data["candidates"][0]["content"]["parts"][0]["text"]
        return text_response.strip()
    except (KeyError, IndexError):
        raise Exception(f"Unexpected Gemini API response structure: {res_data}")


async def analyze_image_with_ai(messages: list, images: list) -> str:
    """
    Analyzes uploaded educational images (diagrams, flowcharts, notes, etc.)
    and responds to conversational questions about them using multimodal AI models.
    """
    import asyncio
    
    system_prompt = """You are Cognify, an intelligent AI tutor specializing in visual learning and computer vision.
Your task is to analyze the provided educational image(s) (which can be diagrams, flowcharts, notes, screenshots, equations, or illustrations) and answer the student's question in a clean, well-structured, easy-to-read academic format suitable for studying.

BEHAVIOR AND STRUCTURAL GUIDELINES:
- **Organize with Headings & Subheadings**: Avoid long blocks of text. Divide your response into logical sections using clear markdown headings (e.g., `### Summary`, `### Key Concepts & Terms`, `### Visual Observations`, `### Step-by-Step Analysis`, `### Takeaways & Conclusion`).
- **Highlight Key Terms**: Emphasize important keywords, scientific terms, or formulas by wrapping them in bold (`**term**`) or inline code blocks (`code`).
- **Use Bullet Points & Lists**: When detailing parts of a diagram, steps in an equation, or flowchart processes, break them down into bulleted or numbered lists.
- **Use Tables for Comparisons**: If comparing components, data points, before/after states, or multiple diagrams, ALWAYS organize this comparison using a structured markdown table.
- **Ground in Visuals**: Reference specific labels, annotations, shapes, flow paths, colors, or structures from the image(s).
- **Step-by-Step Work**: For equations or calculations, show all intermediate steps clearly, explaining the rule or logic behind each transition.
- **Encouraging Tone**: Maintain a supportive, clear, professional, and student-friendly tone throughout.
"""

    api_messages = [{"role": "system", "content": system_prompt}]
    
    # Find the index of the FIRST user message to attach the images
    first_user_idx = None
    for idx, msg in enumerate(messages):
        if msg.get("sender") == "user":
            first_user_idx = idx
            break
            
    for idx, msg in enumerate(messages):
        role = "user" if msg.get("sender") == "user" else "assistant"
        text = msg.get("text", "")
        
        if idx == first_user_idx:
            # Multi-modal content block
            content_blocks = [{"type": "text", "text": text}]
            for img in images:
                if not img or not img.strip():
                    continue
                img_url = img if img.startswith("data:") else f"data:image/jpeg;base64,{img}"
                content_blocks.append({
                    "type": "image_url",
                    "image_url": {
                        "url": img_url
                    }
                })
            api_messages.append({"role": role, "content": content_blocks})
        else:
            api_messages.append({"role": role, "content": text})

    # List of vision-capable models
    VISION_FALLBACK_CONFIGS = [
        {"provider": "gemini", "model": "gemini-3.5-flash"},
        {"provider": "gemini", "model": "gemini-3.6-flash"},
        {"provider": "gemini", "model": "gemini-flash-latest"},
        {"provider": "openrouter", "model": "openai/gpt-4o-mini"},
        {"provider": "openrouter", "model": "google/gemini-2.5-flash"}
    ]
    
    for config in VISION_FALLBACK_CONFIGS:
        provider = config["provider"]
        model_name = config["model"]
        
        try:
            if provider == "gemini":
                api_key = os.getenv("GEMINI_API_KEY")
                if not api_key:
                    continue
                logger.info(f"Calling direct Gemini REST API with model {model_name}...")
                response_text = await _call_gemini_rest(model_name, api_messages, images, api_key)
                return response_text
                
            elif provider == "openrouter":
                if "openrouter" not in clients:
                    continue
                logger.info(f"Calling OpenRouter API with model {model_name}...")
                client = clients["openrouter"]
                
                api_kwargs = {
                    "model": model_name,
                    "messages": api_messages,
                    "temperature": 0.4,
                    "max_tokens": 1500
                }
                
                response = await asyncio.wait_for(
                    client.chat.completions.create(**api_kwargs),
                    timeout=45
                )
                return response.choices[0].message.content.strip()
                
        except Exception as e:
            logger.warning(f"Visual LLM generation fallback: {provider} model {model_name} failed: {str(e)}")
            continue
            
    raise Exception("All visual API providers failed. Please check your internet connection or API keys.")

