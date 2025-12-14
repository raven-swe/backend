ARABIC_MODEL = "Ammar-alhaj-ali/arabic-MARBERT-news-article-classification"
ENGLISH_MODEL = "cardiffnlp/tweet-topic-21-multi"
KEYWORD_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"

TOP_X_KEYWORDS = 2
TOP_TREND_LIMIT_KWS = 15
TOP_K_SUBTOPICS = 1
MIN_SCORE = 0.85

CUSTOM_IGNORE_LIST = [
    'day', 'today', 'yesterday', 'tomorrow', 'week', 'year', 'month', 'time', 'finally',
    'people', 'thing', 'something', 'world', 'life', 'season', 'matter', 'key', 'small',
    'like', 'popular', 'decide', 'hits different', 'ended', 'new', 'people world', 'night', 'day'
]

LABEL_MAP = {
    "business_&_entrepreneurs": "Finance",
    "sports": "Sports",
    "news_&_social_concern": "Politics",
    "science_&_technology": "Tech",
    "fitness_&_health": "Medical",
    "arts_&_culture": "Culture",
    "celebrity_&_pop_culture": "Culture",
    "film_tv_&_video": "Entertainment",
    "music": "Entertainment",
    "fashion_&_style": "Entertainment",
    "diaries_&_daily_life": "General",
    "family": "General",
    "food_&_dining": "Food",
    "gaming": "Gaming",
    "learning_&_educational": "Learning",
    "other_hobbies": "General",
    "relationships": "General",
    "travel_&_adventure": "Travel",
    "youth_&_student_life": "General"
}

TREND_TOPIC_MAP = {
    "Entertainment": "Entertainment",
    "Sports": "Sports",
    "Finance": "News",
    "Politics": "News",
    "Tech": "News",
    "Medical": "News",
    "Culture": "General",
    "Religion": "General",
    "General": "General",
    "Food": "General",
    "Learning": "General",
    "Travel": "General"
}
