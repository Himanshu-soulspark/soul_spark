# ==============================================================================
# जरूरी लाइब्रेरीज को इम्पोर्ट करना
# ==============================================================================
import os
import json
import re  # रेगुलर एक्सप्रेशन के लिए
import google.generativeai as genai
from flask import Flask, render_template, request, jsonify
from PIL import Image
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled

# ==============================================================================
# Flask ऐप को शुरू करना
# ==============================================================================
app = Flask(__name__)

# ==============================================================================
# Google API की Key को कॉन्फ़िगर करना
# ==============================================================================
try:
    api_key = os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in Environment Variables.")
    genai.configure(api_key=api_key)
    print("SUCCESS: Google API Key loaded and configured.")
except (ValueError, KeyError) as e:
    print(f"FATAL ERROR: {e}. Please check your Environment Variables on Render.")

# ==============================================================================
# AI मॉडल को चुनना
# ==============================================================================
model = genai.GenerativeModel('gemini-1.5-flash-latest')

# ==============================================================================
# एक हेल्पर फंक्शन: AI के जवाब से टेक्स्ट निकालना
# ==============================================================================
def get_response_text(response):
    try:
        if hasattr(response, 'text'):
            return response.text
        elif hasattr(response, 'parts'):
            return "".join(part.text for part in response.parts)
        # Handle cases where the response might be blocked
        if not response.parts:
             return "AI ने सुरक्षा कारणों से जवाब रोक दिया है।"
        return str(response)
    except Exception as e:
        print(f"Error extracting text from response: {e}")
        return "माफ कीजिये, AI से जवाब नहीं मिल सका। शायद आपका सवाल सुरक्षा नीतियों के खिलाफ हो।"

# ==============================================================================
# ऐप के रूट्स (Routes)
# ==============================================================================

# --- होम पेज का रूट ---
@app.route('/')
def home():
    return render_template('index.html')


# --- विभाग 8: कंटेंट समराइज़र (YOUTUBE SHORTS के सुधार के साथ) ---
@app.route('/summarize-content-ai', methods=['POST'])
def summarize_content_route():
    try:
        data = request.get_json()
        content = data.get('content', '').strip()
        if not content:
            return jsonify({'error': 'Please provide text or a YouTube link to summarize.'}), 400

        text_to_summarize = ""
        
        # --- YAHAN BADLAV KIYA GAYA HAI ---
        # YouTube URL को पहचानने के लिए रेगुलर एक्सप्रेशन को अपडेट किया गया है
        # अब यह 'shorts/' को भी पहचानेगा
        youtube_regex = r'(https?://)?(www\.)?(youtube\.com/(watch\?v=|shorts/)|youtu\.be/)([^"&?/\s]{11})'
        
        match = re.search(youtube_regex, content)

        if match:
            # YouTube वीडियो आईडी निकालना
            video_id = match.group(5) # ग्रुप इंडेक्स बदला है क्योंकि regex में ग्रुप्स बढ़ गए हैं
            try:
                # वीडियो का ट्रांसक्रिप्ट (टेक्स्ट) निकालना
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
                text_to_summarize = " ".join([item['text'] for item in transcript_list])
            except (NoTranscriptFound, TranscriptsDisabled):
                print(f"YouTube Transcript not found for video_id: {video_id}")
                return jsonify({'error': 'इस वीडियो का ट्रांसक्रिप्ट नहीं मिल सका। हो सकता है इसपे कैप्शंस बंद हों।'}), 400
            except Exception as e:
                print(f"YouTube Transcript Error: {e}")
                return jsonify({'error': 'ट्रांसक्रिप्ट निकालते समय कोई अज्ञात समस्या हुई।'}), 500
        else:
            # अगर यह एक YouTube लिंक नहीं है, तो इसे सादा टेक्स्ट मानें
            text_to_summarize = content

        if not text_to_summarize:
            return jsonify({'error': 'समराइज़ करने के लिए कोई कंटेंट नहीं मिला।'}), 400

        prompt = f"""
        **ROLE:** You are an intelligent text summarizer.
        **TASK:** Analyze the following content and provide a concise summary. The content is from a user's text or a video transcript.
        **CONTENT:** "{text_to_summarize}"
        **OUTPUT FORMAT:**
        1.  **## Main Idea:** A one-sentence summary.
        2.  **## Key Points:** A bulleted list of the most important points (5-7 points).
        3.  **## Keywords:** A list of important keywords.
        **LANGUAGE:** Respond in English or Hinglish.
        """
        response = model.generate_content(prompt)
        summary_text = get_response_text(response)
        
        return jsonify({'summary': summary_text})
        
    except Exception as e:
        print(f"--- ERROR in summarize_content_route: {e} ---")
        return jsonify({'error': 'Error summarizing content.'}), 500


# --- विभाग 9: फ्लैशकार्ड जेनरेटर (और बेहतर एरर हैंडलिंग के साथ) ---
@app.route('/generate-flashcards-ai', methods=['POST'])
def generate_flashcards_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400

        prompt = f"""
        Strictly generate 8 flashcards for the topic: "{topic}".
        The language must be the same as the topic.
        Your response must be ONLY a valid JSON array. Do not include any other text, explanations, or markdown like ```json.
        The JSON must be an array of objects, where each object has a "front" key (for the term/question) and a "back" key (for the definition/answer).
        Example: [{"front": "Mitochondria", "back": "Powerhouse of the cell"}]
        """
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(prompt, generation_config=generation_config)
        
        response_text = get_response_text(response)
        
        # --- YAHAN BADLAV KIYA GAYA HAI ---
        # एरर को बेहतर तरीके से पकड़ने के लिए
        try:
            cards_data = json.loads(response_text)
            # सुनिश्चित करें कि यह एक लिस्ट है
            if isinstance(cards_data, list):
                return jsonify(cards_data)
            else:
                raise json.JSONDecodeError("Response is not a list.", response_text, 0)

        except json.JSONDecodeError as json_err:
            print(f"--- JSON DECODE ERROR in flashcards ---")
            print(f"AI Response was: {response_text}")
            print(f"Error: {json_err}")
            return jsonify({'error': 'AI से मिला जवाब सही फॉर्मेट में नहीं था। कृपया दोबारा प्रयास करें।'}), 500
            
    except Exception as e:
        print(f"--- UNKNOWN ERROR in generate_flashcards_route: {e} ---")
        return jsonify({'error': 'फ्लैशकार्ड बनाते समय एक अज्ञात सर्वर समस्या हुई।'}), 500


# ==============================================================
# (बाकी सभी रूट्स वैसे ही रहेंगे, उन्हें बदलने की जरूरत नहीं है)
# ==============================================================

# Department 1: Ask a Doubt
@app.route('/ask-ai-image', methods=['POST'])
def ask_ai_image_route():
    try:
        question_text = request.form.get('question', '')
        image_file = request.files.get('image')
        if not question_text and not image_file:
            return jsonify({'error': 'Please provide a question or an image.'}), 400
        instruction_prompt = """
        **ROLE:** You are an expert Physics and Math tutor.
        **TASK:** Analyze the user's image and text. Solve the question step-by-step.
        **RULES:**
        1.  **LANGUAGE:** Respond in the SAME language as the user's query.
        2.  **FORMATTING:** Use `##` for headings, `* ` for bullet points, and **bold** keywords. Use '×' for multiplication and '_' for subscripts.
        3.  **MCQ BEHAVIOR:** If options are provided, choose the closest answer and explain why.
        """
        prompt_parts = [instruction_prompt]
        if image_file:
            img = Image.open(image_file)
            img.thumbnail((512, 512))
            prompt_parts.append(img)
        if question_text:
            prompt_parts.append(f"User's Text: {question_text}")
        response = model.generate_content(prompt_parts)
        answer_text = get_response_text(response)
        return jsonify({'answer': answer_text})
    except Exception as e:
        print(f"--- ERROR in ask_ai_image_route: {e} ---")
        return jsonify({'error': 'सर्वर में एक समस्या आ गयी है। कृपया बाद में प्रयास करें।'}), 500

# Department 2: Generate Notes
@app.route('/generate-notes-ai', methods=['POST'])
def generate_notes_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400
        notes_prompt = f"""
        **ROLE:** You are an expert teacher.
        **TASK:** Generate comprehensive notes on the topic: "{topic}".
        **RULES:**
        1.  **LANGUAGE:** Generate notes in the SAME language as the topic.
        2.  **FORMATTING:** Use `##` for headings, `* ` for bullet points, and **bold** keywords.
        3.  **SYMBOLS:** Use '×' and '_'.
        """
        response = model.generate_content(notes_prompt)
        notes_text = get_response_text(response)
        return jsonify({'notes': notes_text})
    except Exception as e:
        print(f"--- ERROR in generate_notes_route: {e} ---")
        return jsonify({'error': 'नोट्स जेनरेट करते वक़्त सर्वर में समस्या आ गयी।'}), 500

# Department 3: Generate MCQs
@app.route('/generate-mcq-ai', methods=['POST'])
def generate_mcq_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400
        mcq_prompt = f"""
        Generate 5 multiple-choice questions (MCQs) on the topic: "{topic}".
        Language should be same as the topic.
        Provide the output in a valid JSON format only. No text before or after the JSON.
        The JSON structure must be an array of objects, each with "question", "options" (array of 4 strings), and "correct_answer".
        """
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(mcq_prompt, generation_config=generation_config)
        response_text = get_response_text(response)
        mcq_data = json.loads(response_text)
        return jsonify(mcq_data)
    except Exception as e:
        print(f"--- ERROR in generate_mcq_route: {e} ---")
        return jsonify({'error': 'AI से MCQ जेनरेट करते वक़्त गड़बड़ हो गयी।'}), 500

# Department 4: Solved Notes & Examples
@app.route('/get-solved-notes-ai', methods=['POST'])
def get_solved_notes_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        if not topic:
            return jsonify({'error': 'Please provide a topic.'}), 400
        solved_notes_prompt = f"""
        **ROLE:** You are an expert teacher providing solved examples.
        **TASK:** Provide 2-3 detailed, step-by-step solved problems for the topic: "{topic}".
        **RULES:**
        1.  **LANGUAGE:** Respond in the SAME language as the topic.
        2.  **FORMATTING:** State the problem, list 'Given' data, and a 'Solution' section with clear steps.
        3.  **SYMBOLS:** Use '×' for multiplication and '_' for subscripts.
        """
        response = model.generate_content(solved_notes_prompt)
        solved_notes_text = get_response_text(response)
        return jsonify({'solved_notes': solved_notes_text})
    except Exception as e:
        print(f"--- ERROR in get_solved_notes_route: {e} ---")
        return jsonify({'error': 'Error generating solved notes.'}), 500

# Department 5: Career Counselor
@app.route('/get-career-advice-ai', methods=['POST'])
def get_career_advice_route():
    try:
        data = request.get_json()
        interests = data.get('interests')
        if not interests:
            return jsonify({'error': 'Please provide your interests.'}), 400
        prompt = f"""
        **ROLE:** You are an expert AI Career Counselor for Indian students.
        **TASK:** Based on the user's interests: "{interests}", provide a detailed career roadmap.
        **OUTPUT STRUCTURE:**
        1.  **## Top 3 Career Paths:** List 3 suitable career options.
        2.  **For each career path, provide:**
            *   **### [Career Name]:**
            *   **Required Stream in 12th:** (e.g., PCM, PCB, Commerce)
            *   **Top Bachelor's Degrees:** (e.g., B.Tech in CSE, MBBS)
            *   **Key Entrance Exams:** (e.g., JEE Mains/Advanced, NEET, CUET)
            *   **Essential Skills:** (e.g., Python, Communication, Problem-Solving)
            *   **Future Scope & Salary (Approx):**
        **LANGUAGE:** Respond in Hinglish (mix of Hindi and English) unless the user's query is in pure English.
        """
        response = model.generate_content(prompt)
        advice_text = get_response_text(response)
        return jsonify({'advice': advice_text})
    except Exception as e:
        print(f"--- ERROR in get_career_advice_route: {e} ---")
        return jsonify({'error': 'Error generating career advice.'}), 500

# Department 6: Study Planner
@app.route('/generate-study-plan-ai', methods=['POST'])
def generate_study_plan_route():
    try:
        data = request.get_json()
        plan_details = data.get('details')
        if not plan_details:
            return jsonify({'error': 'Please provide details for the plan.'}), 400
        prompt = f"""
        **ROLE:** You are an expert study planner.
        **TASK:** Create a personalized 7-day study plan based on these details: "{plan_details}".
        **OUTPUT FORMAT:**
        *   Create a day-by-day schedule.
        *   Use headings like `## Day 1: Monday`.
        *   For each day, create time slots (e.g., `* **9 AM - 11 AM:**`).
        *   Assign subjects/topics and include short breaks.
        *   Include a revision session at the end of each day.
        *   Add a general tip section at the end.
        **LANGUAGE:** Respond in Hinglish or the language of the user's request.
        """
        response = model.generate_content(prompt)
        plan_text = get_response_text(response)
        return jsonify({'plan': plan_text})
    except Exception as e:
        print(f"--- ERROR in generate_study_plan_route: {e} ---")
        return jsonify({'error': 'Error generating study plan.'}), 500

# Department 7: Essay Assistant (Original Feedback Version)
@app.route('/get-essay-feedback-ai', methods=['POST'])
def get_essay_feedback_route():
    try:
        data = request.get_json()
        essay_text = data.get('essay')
        if not essay_text:
            return jsonify({'error': 'Please provide your essay text.'}), 400
        prompt = f"""
        **ROLE:** You are a helpful English/Hindi writing tutor.
        **TASK:** Analyze the following text and provide constructive feedback. DO NOT rewrite the essay for the user.
        **USER'S ESSAY:**
        ---
        {essay_text}
        ---
        **FEEDBACK STRUCTURE:**
        *   **## Overall Feedback:** A summary of the essay.
        *   **## Strengths:** What the user did well.
        *   **## Areas for Improvement:**
        *   **Grammar & Spelling:** Point out specific errors.
        *   **Structure & Flow:** Suggest improvements for better organization.
        *   **Clarity & Word Choice:** Suggest better words or phrasing.
        **IMPORTANT:** Be encouraging and helpful. If the user asks to write an essay, politely explain that your role is to give feedback on their writing, not to write it for them.
        """
        response = model.generate_content(prompt)
        feedback_text = get_response_text(response)
        return jsonify({'feedback': feedback_text})
    except Exception as e:
        print(f"--- ERROR in get_essay_feedback_route: {e} ---")
        return jsonify({'error': 'Error generating feedback.'}), 500
        
# Department 10: Presentation Coach
@app.route('/get-presentation-feedback-ai', methods=['POST'])
def get_presentation_feedback_route():
    try:
        data = request.get_json()
        topic = data.get('topic')
        speech = data.get('speech')
        if not topic or not speech:
            return jsonify({'error': 'Please provide topic and your speech text.'}), 400
        prompt = f"""
        **ROLE:** You are a supportive Public Speaking Coach.
        **TASK:** The user is practicing for a presentation on the topic "{topic}". Analyze their speech below and give feedback.
        **USER'S SPEECH:** "{speech}"
        **FEEDBACK STRUCTURE:**
        *   **## Content Analysis:** Is the content relevant, accurate, and well-structured?
        *   **## Language & Clarity:** How is the word choice? Is it easy to understand?
        *   **## Suggestions for Improvement:** Provide actionable tips to make the speech more impactful and confident.
        **IMPORTANT:** Be encouraging. Start with positive points.
        """
        response = model.generate_content(prompt)
        feedback_text = get_response_text(response)
        return jsonify({'feedback': feedback_text})
    except Exception as e:
        print(f"--- ERROR in get_presentation_feedback_route: {e} ---")
        return jsonify({'error': 'Error generating presentation feedback.'}), 500

# ==============================================================================
# ऐप को लोकल सर्वर पर चलाने के लिए
# ==============================================================================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
