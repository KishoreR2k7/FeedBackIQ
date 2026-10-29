import re
import logging
from typing import Any, Dict, List, Optional, Tuple
from pydantic import ValidationError

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models import BaseChatModel

from app.core.config import settings
from app.schemas.analysis import StructuredAnalysisOutput, SentimentType, IssueCategoryType

logger = logging.getLogger("feedbackiq.agents.feedback_analyzer")

# Deterministic safety triggers: Food safety hazards MUST escalate and cannot be suppressed by LLM (Rule 9)
FOOD_SAFETY_TRIGGERS: Dict[str, str] = {
    r"\b(cockroach|cockroch|cochroach|cokroach|bug|bugs|insect|insects|fly|flies|maggot|maggots|worm|worms|spider|ant|ants)\b": "Pest or insect contamination detected",
    r"\b(hair|hairs|nail|nails|screw|screws|glass|plastic|wire|stone|stones|metal|debris)\b": "Physical foreign body contamination detected",
    r"\b(food poisoning|food posioning|food poison|posioning|vomit|vomiting|diarrhea|diahrea|diarrhoea|stomach ache|stomach pain|stomach infection|hospital|dysentery|nausea|nauseous|cramp|cramps|fell sick|falling sick)\b": "Acute illness or foodborne pathogen symptoms reported",
    r"\b(raw chicken|undercooked chicken|bloody chicken|raw meat|undercooked meat|raw egg|undercooked egg|undercooked|raww chicken|uncooked)\b": "Undercooked high-risk poultry/meat hazard",
    r"\b(rotten|sour paneer|spoiled milk|stale milk|mold|moldy|mould|mouldy|fungus|fungal|smelly|foul odor|bad smell|curdled|spoil|spoilt|spoiled)\b": "Severe spoilage or bacterial decomposition hazard",
    r"\b(chemical|detergent|soap taste|soapy|bleach|pesticide|metallic)\b": "Suspected chemical or cleaning agent contamination",
}

SYSTEM_PROMPT = """You are FeedbackIQ's Quality Intelligence & Food Safety Agent.
Your job is to analyze customer, student, and patron feedback for canteens, dining halls, and restaurants.

Extract:
1. Sentiment: 'positive', 'neutral', 'negative', 'mixed' (genuine mix of pros and cons), or 'uncertain' (unsupported/vague).
2. Mentioned Food Items: Specific dishes, ingredients, or drinks explicitly named (e.g., 'Dal Tadka', 'Paneer', 'Roti', 'Biryani', 'Tea').
3. Service Aspects: Operational aspects (e.g., 'queue/wait time', 'serving hygiene', 'cutlery cleanliness', 'counter staff behavior', 'temperature upkeep').
4. Issue Categories: Select all that apply from ['taste', 'temperature', 'hygiene', 'freshness', 'portion_size', 'service', 'ambience', 'other'].
5. Severity Score (1-5):
   - 1: Minor preference or aesthetic comment.
   - 2: Mild dissatisfaction (e.g., slightly cold tea, mild blandness).
   - 3: Significant complaint (e.g., burnt chapati, consistently cold lunch dal, 30 min queue).
   - 4: Serious quality issue (e.g., sour/curdled milk, undercooked meat, inedible food).
   - 5: Critical food safety hazard (e.g., pests, foreign glass/wire, food poisoning, vomit).
6. Evidence Quotes: Extract exact relevant substrings from the comment.
7. Food Safety Flag: Set to TRUE if any physical foreign object, severe spoilage, chemical smell, undercooked poultry, or foodborne illness is mentioned.
8. Language: Primary language ('en', 'hi', 'hinglish', etc.).
9. Uncertainty: 0.0 (high clarity) to 1.0 (empty, sarcastic or unsupported claims).

Be attentive to:
- Sarcasm (e.g., 'Thanks for the freezing cold soup, loved it' -> Negative, Temperature issue, NOT positive).
- Indian dining terms (e.g., 'dal was paani' -> watery taste/portion, 'roti was papad/rubber' -> texture/freshness).
- Mixed reviews (e.g., 'Paneer was delicious but found a hair in the rice' -> Mixed sentiment, Severity 5, Food Safety Flag = TRUE).
"""


class MockChatModel:
    """Deterministic, offline rule-based agent simulator for test environments and zero-API-key setups."""

    def with_structured_output(self, schema: Any):
        return self

    async def ainvoke(self, messages: Any) -> StructuredAnalysisOutput:
        # Extract user comment from messages
        comment = ""
        rating: Optional[int] = None
        for m in messages:
            content = m[1] if isinstance(m, tuple) else getattr(m, "content", "")
            if "User Comment:" in content:
                comment = content.split("User Comment:")[1].split("Rating:")[0].strip()
            if "Rating:" in content:
                try:
                    r_part = content.split("Rating:")[1].split()[0]
                    rating = int(r_part) if r_part.isdigit() else None
                except Exception:
                    rating = None

        return FeedbackAnalyzerAgent.deterministic_rule_extract(comment, rating)


class FeedbackAnalyzerAgent:
    """Feedback Analysis Agent orchestrating LangChain structured output and deterministic safeguards."""

    @classmethod
    def get_llm(cls) -> Any:
        provider = settings.LLM_PROVIDER.lower()
        if provider == "mock":
            return MockChatModel()
        elif provider == "gemini":
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                return ChatGoogleGenerativeAI(
                    model=settings.LLM_MODEL or "gemini-1.5-flash",
                    google_api_key=settings.GEMINI_API_KEY,
                    temperature=0.1,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini LLM: {e}. Falling back to mock engine.")
                return MockChatModel()
        elif provider == "groq":
            try:
                from langchain_groq import ChatGroq
                return ChatGroq(
                    model_name=settings.LLM_MODEL or "llama-3.1-70b-versatile",
                    groq_api_key=settings.GROQ_API_KEY,
                    temperature=0.1,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Groq LLM: {e}. Falling back to mock engine.")
                return MockChatModel()
        elif provider == "openai":
            try:
                from langchain_openai import ChatOpenAI
                return ChatOpenAI(
                    model_name=settings.LLM_MODEL or "gpt-4o-mini",
                    api_key=settings.OPENAI_API_KEY,
                    temperature=0.1,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI LLM: {e}. Falling back to mock engine.")
                return MockChatModel()
        else:
            return MockChatModel()

    @classmethod
    def check_deterministic_food_safety(cls, text: str) -> Tuple[bool, List[str]]:
        """
        Rule 9: Critical safety complaints must trigger deterministic escalation rules;
        an LLM must NEVER suppress them.
        """
        reasons = []
        if not text:
            return False, []

        clean_text = text.lower()
        for pattern, reason in FOOD_SAFETY_TRIGGERS.items():
            if re.search(pattern, clean_text, re.IGNORECASE):
                reasons.append(reason)

        return (len(reasons) > 0, reasons)

    @classmethod
    def deterministic_rule_extract(
        cls,
        comment: str,
        rating: Optional[int] = None,
        item_hint: Optional[str] = None,
    ) -> StructuredAnalysisOutput:
        """
        Rule-based deterministic extraction with comprehensive domain coverage for Indian dining,
        misspellings, sarcasm resolution, mixed sentiment, aspect classification, and safety overrides.
        """
        text = (comment or "").strip()
        lower = text.lower()

        # Handle empty/non-informative comments
        if not text or len(text) < 3 or re.match(r"^[\s\.\?!,;:\-_*]+$", text):
            sentiment: SentimentType = "neutral"
            uncertainty = 0.85
            if rating is not None:
                if rating >= 4:
                    sentiment = "positive"
                    uncertainty = 0.3
                elif rating <= 2:
                    sentiment = "negative"
                    uncertainty = 0.3
                else:
                    sentiment = "neutral"
                    uncertainty = 0.5
            else:
                sentiment = "uncertain"
                uncertainty = 0.95

            return StructuredAnalysisOutput(
                sentiment=sentiment,
                mentioned_food_items=[item_hint] if item_hint else [],
                service_aspects=[],
                issue_categories=[],
                severity_score=1 if (rating is None or rating >= 3) else 3,
                evidence_quotes=[],
                food_safety_flag=False,
                food_safety_reasons=[],
                language="en",
                uncertainty_score=uncertainty,
                rationale="Comment was empty or non-textual. Inferred sentiment from rating.",
            )

        # Detect food safety triggers (Rule 9)
        safety_flag, safety_reasons = cls.check_deterministic_food_safety(lower)

        # Detect dishes (including common Indian culinary terms and misspellings)
        dish_vocab = [
            "dal tadka", "dal", "daal", "paneer butter masala", "paneer", "paner", "sambar", "sambhar",
            "chicken biryani", "biryani", "briyani", "biriyani", "chapati", "roti", "phulka", "poha",
            "curd rice", "rice", "tea", "chai", "coffee", "soup", "chole bhature", "chole", "idli", "vada",
            "paratha", "fish", "chicken", "chikken", "dosa", "masala dosa", "pav bhaji", "subzi", "sabji", "egg",
        ]
        mentioned_items = []
        for dish in dish_vocab:
            if re.search(rf"\b{re.escape(dish)}\b", lower):
                mentioned_items.append(dish.title())
        if item_hint and item_hint not in mentioned_items:
            mentioned_items.insert(0, item_hint)

        # Detect issue categories & aspects
        categories: List[str] = []
        aspects: List[str] = []
        evidence: List[str] = []

        # Temperature (exclude intentional cold items like cold coffee, cold drinks)
        is_cold_beverage = bool(re.search(r"\b(cold\s+(?:coffee|drink|beverage|water|soda|juice))\b", lower))
        temp_matches = [w for w in ["freezing", "lukewarm", "not hot", "ice-cold", "unheated", "thanda", "chilled dal", "chilled soup", "chilled food"] if w in lower]
        if bool(re.search(r"\bcold\b", lower)) and not is_cold_beverage:
            temp_matches.append("cold")
        if temp_matches:
            categories.append("temperature")
            aspects.append("Food serving temperature")
            evidence.append(f"Temperature complaint: {temp_matches[0]}")

        # Hygiene
        hygiene_patterns = [
            r"\b(hair|hairs|dirty|unwashed|dust|tray dirty|filthy|stain|stains|ganda)\b",
            r"\b(cockroach|cockroch|cokroach|cochroach|insect|insects|fly|flies|pest|pests|maggot|maggots|worm|worms|bug|bugs)\b",
            r"\b(nail|glass|plastic|wire|screw|stone|debris)\b",
        ]
        if any(re.search(pat, lower) for pat in hygiene_patterns):
            categories.append("hygiene")
            aspects.append("Serving hygiene & cleanliness")
            evidence.append("Hygiene/cleanliness hazard")

        # Taste (require actual defect qualifiers; avoid false positives on dish names like 'masala' or 'sweet corn')
        taste_patterns = [
            r"\b(salty|too salty|too much salt|extra salt|oversalted|no salt|less salt|way too salty)\b",
            r"\b(bland|tasteless|no flavor|no flavour|lacks flavor|lacks flavour|no taste)\b",
            r"\b(too oily|oily|greasy|excessive oil)\b",
            r"\b(too spicy|excessive spice|over-?spiced|way too spicy)\b",
            r"\b(sour|bitter|raw masala|too sweet|overly sweet)\b",
            r"\b(overcooked|burnt|kachha|kaccha|undercooked)\b",
            r"\b(poor taste|bad taste|terrible taste|awful taste|horrible taste|tastes? bad|disgusting taste)\b",
        ]
        if any(re.search(pat, lower) for pat in taste_patterns) or ((rating is not None and rating <= 2) and re.search(r"\b(spicy|taste|flavor|flavour)\b", lower)):
            categories.append("taste")
            aspects.append("Recipe flavor & seasoning balance")
            evidence.append("Flavor/seasoning deviation")

        # Freshness / Spoilage
        freshness_patterns = [
            r"\b(stale|spoiled|spoilt|sour milk|rotten|expired|curdled|baasi|mould|mouldy|mold|moldy|fungus)\b",
            r"\b(bad smell|foul smell|foul odor|smelly|rotten smell)\b",
            r"\b(hard roti|rubbery|rubber roti|dry roti)\b",
        ]
        if any(re.search(pat, lower) for pat in freshness_patterns):
            categories.append("freshness")
            aspects.append("Ingredient freshness & preservation")
            evidence.append("Ingredient staleness/spoilage")

        # Portion size
        portion_patterns = [
            r"\b(small portion|small portions|tiny portion|less quantity|insufficient portion|less rice|hardly any|watery dal|watery|paani|tiny quantity|portion size)\b",
        ]
        if any(re.search(pat, lower) for pat in portion_patterns):
            categories.append("portion_size")
            aspects.append("Portion adequacy")
            evidence.append("Portion or consistency complaint")

        # Service / Queue
        service_patterns = [
            r"\b(queue|waiting|slow|rude|counter staff|delay|waiting time|attitude|slow service|ignored|late service|servise|survice|staff was rude)\b",
        ]
        if any(re.search(pat, lower) for pat in service_patterns):
            categories.append("service")
            aspects.append("Queue speed & staff service")
            evidence.append("Service wait time / staff interaction")

        # Ambience
        ambience_patterns = [
            r"\b(noisy|ac not working|fan not working|hot dining|smell in hall|crowded|lighting|chair broken)\b",
        ]
        if any(re.search(pat, lower) for pat in ambience_patterns):
            categories.append("ambience")
            aspects.append("Dining hall ambience & facilities")
            evidence.append("Ambience / seating complaint")

        # Detect Sarcasm: praise words paired with defects or low rating (Rule 9 / Sarcasm)
        sarcasm_praise = bool(re.search(r"\b(loved|love|thanks for|great job|wonderful|amazing|best|brilliant|fantastic|superb|awesome)\b", lower))
        sarcasm_issues = bool(re.search(r"\b(cold|cockroach|cokroach|hair|raw|salty|rotten|spoiled|dirt|poison|worst|bug|insect|freezing|inedible|undercooked|delay|slow)\b", lower))
        is_sarcastic = False
        if sarcasm_praise and (
            (rating is not None and rating <= 2 and (sarcasm_issues or len(categories) > 0))
            or (sarcasm_issues and any(k in lower for k in ["raw", "cockroach", "cokroach", "poison", "inedible", "freezing"]))
        ):
            is_sarcastic = True

        # Positive keywords check
        has_positive_words = bool(re.search(r"\b(good|tasty|great|delicious|fresh|excellent|loved|love|nice|yummy|superb|enjoyed|perfect|amazing|crispy|hot|flavorful|flavourful|best)\b", lower))
        has_contrast = bool(re.search(r"\b(but|however|although|though|while|except|yet|still)\b", lower))
        has_negative_indicator = len(categories) > 0 or bool(re.search(r"\b(bad|poor|terrible|horrible|awful|disgusting|worst|disappointing)\b", lower))

        # Genuine mixed sentiment: positive praise contrasted with actual complaints/defects
        is_mixed = False
        if not is_sarcastic and has_positive_words and has_negative_indicator:
            if has_contrast or (rating is not None and rating == 3) or (rating is None):
                is_mixed = True

        # Ambiguous / uncertain check
        is_ambiguous = bool(re.search(r"\b(not sure|idk|maybe|average|okayish|ok ok|just ok|don't know|dont know|hard to say|meh|unclear)\b", lower)) or (
            len(categories) == 0 and not has_positive_words and (rating is None or rating == 3) and len(text) < 20
        )

        # Determine Sentiment
        sentiment: SentimentType
        uncertainty = 0.15

        if is_sarcastic:
            sentiment = "negative"
            evidence.append("Sarcastic negative review detected")
            uncertainty = 0.25
        elif is_mixed:
            sentiment = "mixed"
            uncertainty = 0.20
        elif is_ambiguous:
            sentiment = "uncertain"
            uncertainty = 0.75
        elif len(categories) > 0 or (rating is not None and rating <= 2) or has_negative_indicator:
            sentiment = "negative"
            uncertainty = 0.15
        elif has_positive_words or (rating is not None and rating >= 4):
            sentiment = "positive"
            uncertainty = 0.15
        else:
            sentiment = "neutral"
            uncertainty = 0.40

        # Severity score (1-5)
        severity = 1
        if safety_flag:
            severity = 5
        elif sentiment == "positive":
            severity = 1
        elif "freshness" in categories or any(w in lower for w in ["undercooked", "stale", "inedible", "vomit", "sick"]):
            severity = 4
        elif "temperature" in categories or "taste" in categories:
            severity = 3
        elif "service" in categories or "portion_size" in categories or "ambience" in categories:
            severity = 2
        elif rating is not None and rating == 1:
            severity = 3
        elif rating is not None and rating <= 2:
            severity = 2
        else:
            severity = 1

        # Format issue categories
        if sentiment in ("negative", "mixed"):
            final_categories = list(dict.fromkeys(categories)) or ["other"]
        else:
            final_categories = list(dict.fromkeys(categories))

        return StructuredAnalysisOutput(
            sentiment=sentiment,
            mentioned_food_items=list(dict.fromkeys(mentioned_items)),
            service_aspects=list(dict.fromkeys(aspects)),
            issue_categories=final_categories,
            severity_score=severity,
            evidence_quotes=evidence or ([text[:80]] if text else []),
            food_safety_flag=safety_flag,
            food_safety_reasons=safety_reasons,
            language="en",
            uncertainty_score=uncertainty,
            rationale="Deterministic aspect, safety, and sentiment extraction based on domain lexicon.",
        )

    @classmethod
    async def analyze(
        cls,
        comment: str,
        rating: Optional[int] = None,
        item: Optional[str] = None,
        meal_type: Optional[str] = None,
    ) -> StructuredAnalysisOutput:
        """
        Executes LangChain structured analysis with fallback to deterministic extraction
        and strict enforcement of safety safeguards.
        """
        text = (comment or "").strip()
        lower = text.lower()

        # Step 1: Deterministic Food Safety Check (Rule 9)
        safety_flag, safety_reasons = cls.check_deterministic_food_safety(lower)

        # Step 2: Empty/Vague input fast-path
        if not text or len(text) < 3 or re.match(r"^[\s\.\?!,;:\-_*]+$", text):
            output = cls.deterministic_rule_extract(text, rating=rating, item_hint=item)
            if safety_flag:
                output.food_safety_flag = True
                output.food_safety_reasons = safety_reasons
                output.severity_score = max(output.severity_score, 4)
            return output

        # Step 3: Run LLM via LangChain Structured Output
        llm = cls.get_llm()
        output: Optional[StructuredAnalysisOutput] = None

        if not isinstance(llm, MockChatModel):
            try:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", SYSTEM_PROMPT),
                    (
                        "user",
                        "User Comment: {comment}\nRating: {rating}\nDish Item: {item}\nMeal Type: {meal_type}\n\nAnalyze and return structured assessment.",
                    ),
                ])
                chain = prompt | llm.with_structured_output(StructuredAnalysisOutput)
                raw_result = await chain.ainvoke({
                    "comment": text,
                    "rating": rating or "Not specified",
                    "item": item or "Not specified",
                    "meal_type": meal_type or "Not specified",
                })
                if isinstance(raw_result, StructuredAnalysisOutput):
                    output = raw_result
                elif isinstance(raw_result, dict):
                    output = StructuredAnalysisOutput.model_validate(raw_result)
            except Exception as e:
                logger.warning(f"LangChain LLM invocation failed: {e}. Falling back to deterministic analysis.")
                output = None

        # Fallback to deterministic rule engine if LLM was unavailable or failed
        if output is None:
            output = cls.deterministic_rule_extract(text, rating=rating, item_hint=item)

        # Step 4: GUARANTEE Safety Safeguards (Rule 9)
        # An LLM must NEVER suppress a critical safety incident
        if safety_flag:
            output.food_safety_flag = True
            for r in safety_reasons:
                if r not in output.food_safety_reasons:
                    output.food_safety_reasons.append(r)
            output.severity_score = max(output.severity_score, 4)
            if "hygiene" not in output.issue_categories and "freshness" not in output.issue_categories:
                output.issue_categories.append("hygiene")

        return output
