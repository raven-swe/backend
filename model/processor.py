import re
from collections import defaultdict
from transformers import pipeline
from keybert import KeyBERT
from config import (
    ARABIC_MODEL,
    ENGLISH_MODEL,
    KEYWORD_MODEL,
    TOP_X_KEYWORDS,
    TOP_TREND_LIMIT,
    TOP_K_SUBTOPICS,
    MIN_SCORE,
    CUSTOM_IGNORE_LIST,
    LABEL_MAP,
    TREND_TOPIC_MAP
)

class TweetProcessor:
    def __init__(self):
        self.pipe_ar = pipeline("text-classification", model=ARABIC_MODEL, tokenizer=ARABIC_MODEL, device=-1, top_k=1)
        self.pipe_en = pipeline("text-classification", model=ENGLISH_MODEL, tokenizer=ENGLISH_MODEL, device=-1, top_k=1)
        self.kw_model = KeyBERT(model=KEYWORD_MODEL)

    def merge_similar_keywords(self, tracker):
        keyword_list = []
        for kw, topic_data in tracker.items():
            total_score = sum(t["score"] for t in topic_data.values())
            keyword_list.append({
                "keyword": kw,
                "total_score": total_score,
                "topics": topic_data
            })
        
        def extract_tokens(kw):
            return {w.lower() for w in kw.split() if len(w) > 3}

        tokens_map = {item["keyword"]: extract_tokens(item["keyword"]) for item in keyword_list}

        token_groups = defaultdict(list)
        for item in keyword_list:
            kw = item["keyword"]
            sig_tokens = tokens_map[kw]
            for tok in sig_tokens:
                token_groups[tok].append(item)

        final_tracker = defaultdict(lambda: defaultdict(lambda: {"score": 0.0, "count": 0}))
        used = set()

        for token, group in token_groups.items():
            if len(group) == 1:
                item = group[0]
                kw = item["keyword"]
                for topic, stats in item["topics"].items():
                    final_tracker[kw][topic]["score"] += stats["score"]
                    final_tracker[kw][topic]["count"] += stats["count"]
                continue

            total_scores = [g["total_score"] for g in group]
            max_score = max(total_scores)
            min_score = min(total_scores)

            balanced = (max_score / max(1, min_score)) < 2

            if balanced:
                parent_kw = token
            else:
                parent_kw = max(group, key=lambda x: x["total_score"])["keyword"]

            for item in group:
                for topic, stats in item["topics"].items():
                    final_tracker[parent_kw][topic]["score"] += stats["score"]
                    final_tracker[parent_kw][topic]["count"] += stats["count"]

                used.add(item["keyword"])

        for item in keyword_list:
            if item["keyword"] not in used:
                kw = item["keyword"]
                for topic, stats in item["topics"].items():
                    final_tracker[kw][topic]["score"] += stats["score"]
                    final_tracker[kw][topic]["count"] += stats["count"]

        return final_tracker

    def process_tweets(self, texts):
        processed_tweets = []
        keyword_tracker = defaultdict(lambda: defaultdict(lambda: {"score": 0.0, "count": 0}))

        for i, text in enumerate(texts):
            if not text.strip():
                continue

            is_ar = bool(re.search(r'[\u0600-\u06FF]', text))

            try:
                if is_ar:
                    pred = self.pipe_ar(text)[0][0]
                else:
                    pred = self.pipe_en(text)[0][0]

                label = pred['label']
                score = round(pred['score'], 4)

                if score < MIN_SCORE:
                    label = "General"
                else:
                    if not is_ar and label in LABEL_MAP:
                        label = LABEL_MAP[label]
                    if label == "Religion": # specific case to not map Religion
                        label = "General"

                trend_category = LABEL_MAP.get(label, label)
                if label in TREND_TOPIC_MAP:
                    trend_category = TREND_TOPIC_MAP[label]
                else:
                    trend_category = "General"

                keywords_raw = self.kw_model.extract_keywords(
                    text, 
                    keyphrase_ngram_range=(1, 2), 
                    stop_words='english', 
                    top_n=TOP_X_KEYWORDS,
                    use_mmr=True,
                    diversity=0.65
                )
                
                keywords_list = []
                for k in keywords_raw:
                    word = k[0]
                    if word.lower() not in CUSTOM_IGNORE_LIST:
                        keywords_list.append(word)
                
                if not keywords_list:
                    keywords_list = [k[0] for k in keywords_raw]

                filtered_keywords = []
                
                for kw in keywords_list:
                    if not re.fullmatch(r'[A-Za-z]+(?:\s+[A-Za-z]+)*', kw):
                        continue
                    
                    filtered_keywords.append(kw)
                    keyword_tracker[kw][trend_category]["score"] += score
                    keyword_tracker[kw][trend_category]["count"] += 1

                processed_tweets.append({
                    "id": i + 1,
                    "content": text,
                    "top_class": label 
                })

            except Exception as e:
                processed_tweets.append({
                    "id": i + 1,
                    "content": text,
                    "top_class": "General",
                    "error": str(e)
                })

        final_tracker = self.merge_similar_keywords(keyword_tracker)
        trending_keywords = []
        
        for kw, topic_data in final_tracker.items():
            general_trend_score = sum(t["score"] for t in topic_data.values())
            
            topics_list = []
            for topic, stats in topic_data.items():
                topics_list.append({
                    "topic": topic,
                    "trend_score": round(stats["score"], 4),
                    "occurrence_count": stats["count"]
                })
            
            topics_list.sort(key=lambda x: x["trend_score"], reverse=True)
            
            top_relevant_topics = topics_list[:TOP_K_SUBTOPICS]

            trending_keywords.append({
                "keyword": kw,
                "general_trend_score": round(general_trend_score, 4),
                "top_related_topics": top_relevant_topics
            })

        trending_keywords.sort(key=lambda x: x["general_trend_score"], reverse=True)
        trending_keywords = trending_keywords[:TOP_TREND_LIMIT]

        return {
            "batch_meta": {
                "total_tweets": len(processed_tweets),
            },
            "trending_keywords": trending_keywords,
            "tweets_detail": processed_tweets
        }
