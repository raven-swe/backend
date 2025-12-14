import re
import logging
from collections import defaultdict
from transformers import pipeline
from keybert import KeyBERT
from config import (
    ARABIC_MODEL,
    ENGLISH_MODEL,
    KEYWORD_MODEL,
    TOP_X_KEYWORDS,
    TOP_TREND_LIMIT_KWS,
    TOP_K_SUBTOPICS,
    MIN_SCORE,
    CUSTOM_IGNORE_LIST,
    LABEL_MAP,
    TREND_TOPIC_MAP
)

class TweetProcessor:
    def __init__(self):
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        self.logger.info("Initializing TweetProcessor...")
        self.logger.info(f"Loading Arabic classification model: {ARABIC_MODEL}")
        self.pipe_ar = pipeline("text-classification", model=ARABIC_MODEL, tokenizer=ARABIC_MODEL, device=-1, top_k=1)
        
        self.logger.info(f"Loading English classification model: {ENGLISH_MODEL}")
        self.pipe_en = pipeline("text-classification", model=ENGLISH_MODEL, tokenizer=ENGLISH_MODEL, device=-1, top_k=1)
        
        self.logger.info(f"Loading KeyBERT model: {KEYWORD_MODEL}")
        self.kw_model = KeyBERT(model=KEYWORD_MODEL)
        
        self.logger.info("TweetProcessor initialization complete")


    def process_tweets(self, tweets):
        self.logger.info(f"Processing batch of {len(tweets)} tweets")
        processed_tweets = []
        keyword_tracker = defaultdict(lambda: defaultdict(lambda: {"score": 0.0, "tweet_ids": set()}))

        for tweet in tweets:
            tweet_id = tweet.id
            text = tweet.content
            
            if not text.strip():
                continue

            has_arabic = bool(re.search(r'[\u0600-\u06FF]', text))
            has_english = bool(re.search(r'[a-zA-Z]', text))
            
            is_ar = has_arabic and not has_english
            self.logger.debug(f"Tweet {tweet_id}: Content {text[:30]}...")

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
                    if label == "Religion":
                        label = "General"



                trend_category = LABEL_MAP.get(label, label)
                if label in TREND_TOPIC_MAP:
                    trend_category = TREND_TOPIC_MAP[label]
                else:
                    trend_category = "General"
                
                self.logger.debug(f"Tweet {tweet_id}: Final classification='{label}', trend_category='{trend_category}'")

                hashtags = re.findall(r'#[\w\u0600-\u06FF]+', text)
                if hashtags:
                    self.logger.debug(f"Tweet {tweet_id}: Found {len(hashtags)} hashtags: {hashtags}")
                
                for hashtag in hashtags:
                    clean_hashtag = hashtag[1:]
                    if clean_hashtag:
                        keyword_tracker[hashtag][trend_category]["score"] += 1.0
                        keyword_tracker[hashtag][trend_category]["tweet_ids"].add(tweet_id)

                text_for_keywords = re.sub(r'#[\w\u0600-\u06FF]+', '', text).strip()
                
                keywords_raw = self.kw_model.extract_keywords(
                    text_for_keywords,
                    keyphrase_ngram_range=(1, 1), 
                    stop_words='english', 
                    top_n=TOP_X_KEYWORDS,
                    use_mmr=True,
                    diversity=0.65
                )
                
                keywords_with_scores = []
                for k in keywords_raw:
                    word = k[0].lower()
                    keybert_score = k[1]
                    if word.lower() not in CUSTOM_IGNORE_LIST:
                        keywords_with_scores.append((word, keybert_score))

                if not keywords_with_scores:
                    keywords_with_scores = [(k[0], k[1]) for k in keywords_raw]

                for kw, keybert_score in keywords_with_scores:
                    if not re.fullmatch(r'[A-Za-z]+(?:\s+[A-Za-z]+)*', kw):
                        continue
                    
                    keyword_tracker[kw][trend_category]["score"] += keybert_score
                    keyword_tracker[kw][trend_category]["tweet_ids"].add(tweet_id)

                processed_tweets.append({
                    "id": tweet_id,
                    "class": label 
                })

            except Exception as e:
                self.logger.error(f"Tweet {tweet_id}: Error during processing - {str(e)}")
                processed_tweets.append({
                    "id": tweet_id,
                    "class": "General"
                })

        trending_keywords = []
        trending_hashtags = []
        
        for kw, topic_data in keyword_tracker.items():
            general_trend_score = sum(t["score"] for t in topic_data.values())
            
            all_tweet_ids = set()
            for t in topic_data.values():
                all_tweet_ids.update(t["tweet_ids"])
            
            topics_list = []
            for topic, stats in topic_data.items():
                topics_list.append({
                    "topic": topic,
                    "trend_score": round(stats["score"], 4),
                    "occurence_in_category": len(stats["tweet_ids"])
                })
            
            topics_list.sort(key=lambda x: x["trend_score"], reverse=True)
            
            top_relevant_topics = topics_list[:TOP_K_SUBTOPICS]

            keyword_obj = {
                "keyword": kw,
                "general_trend_score": round(general_trend_score, 4),
                "top_related_topics": top_relevant_topics
            }
            
            if kw.startswith('#'):
                trending_hashtags.append(keyword_obj)
            else:
                trending_keywords.append(keyword_obj)

        trending_keywords.sort(key=lambda x: x["general_trend_score"], reverse=True)
        trending_keywords = trending_keywords[:TOP_TREND_LIMIT_KWS]
        
        trending_hashtags.sort(key=lambda x: x["general_trend_score"], reverse=True)
        
        all_trending = trending_keywords + trending_hashtags
        all_trending.sort(key=lambda x: x["general_trend_score"], reverse=True)
        
        self.logger.info(f"Generated {len(trending_hashtags)} trending hashtags")
        self.logger.info(f"Total trending items: {len(all_trending)}")
        self.logger.info(f"Done Proccessing batch of {len(processed_tweets)} tweets")

        return {
            "batch_meta": {
                "total_tweets": len(processed_tweets),
            },
            "trending_keywords": all_trending,
            "tweets_detail": processed_tweets
        }
