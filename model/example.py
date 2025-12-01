# import os
# import sys
# import re
# import json
# import subprocess
# from collections import defaultdict
# from transformers import pipeline
# from keybert import KeyBERT

# ARABIC_MODEL = "Ammar-alhaj-ali/arabic-MARBERT-news-article-classification"
# ENGLISH_MODEL = "cardiffnlp/tweet-topic-21-multi"
# KEYWORD_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
# INPUT_FILE = "test.txt"
# OUTPUT_FILE = "results.json"

# TOP_X_KEYWORDS = 2 # TRENDS 
# TOP_TREND_LIMIT = 15
# TOP_K_SUBTOPICS = 3
# MIN_SCORE = 0.8

# custom_ignore_list = [ # FOR KEYWORDS
#                 'day', 'today', 'yesterday', 'tomorrow', 'week', 'year', 'month', 'time', 'finally',
#                 'people', 'thing', 'something', 'world', 'life' , 'season' , 'matter' , 'key' , 'small'
#                 'like' , 'popular' , 'decide' , 'hits different' , 'ended' , 'new' , 'people world','night' , 'day'
#             ]
# # --- LABEL MAPPING (English -> Standard + Arabic) ---
# LABEL_MAP = {
#     "business_&_entrepreneurs": "Finance",
#     "sports": "Sports",
#     "news_&_social_concern": "Politics",
#     "science_&_technology": "Tech",
#     "fitness_&_health": "Medical",
#     "arts_&_culture": "Culture",
#     "celebrity_&_pop_culture": "Culture",
#     "film_tv_&_video": "Entertainment",
#     "music": "Entertainment",
#     "fashion_&_style": "Entertainment",
#     "diaries_&_daily_life": "General",
#     "family": "General",
#     "food_&_dining": "Food",
#     "gaming": "Gaming",
#     "learning_&_educational": "Learning",
#     "other_hobbies": "General",
#     "relationships": "General",
#     "travel_&_adventure": "Travel",
#     "youth_&_student_life": "General"
# }

# # --- 2.5 TREND TOPIC MAPPING (Standard Class -> Trend Category) ---
# # Maps the standardized classes above to specific categories for Trend Analysis only.
# TREND_TOPIC_MAP = {
#     "Entertainment": "Entertainment",
#     "Sports": "Sports",
#     "Finance": "News",
#     "Politics": "News",
#     "Tech": "News",
#     "Medical": "News",
#     "Culture": "General",
#     "Religion": "General",
#     "General": "General",
#     "Food": "General",
#     "Learning" : "General" ,
#     "Travel" : "General"
# }

# def merge_similar_keywords(tracker):
#     """
#     Merges keywords based on shared significant words.
    
#     Logic:
#         - Identify groups of keywords that share a significant token (len > 3).
#         - For each group:
#             * If the group's scores are close (balanced), collapse to the shared word.
#             * If one keyword is strongly dominant, collapse to that keyword instead.
#     """
#     print("\n Merging similar keywords (common-word fusion)...")
    
#     import re
#     from collections import defaultdict
    
#     keyword_list = []
#     for kw, topic_data in tracker.items():
#         total_score = sum(t["score"] for t in topic_data.values())
#         keyword_list.append({
#             "keyword": kw,
#             "total_score": total_score,
#             "topics": topic_data
#         })
    
#     def extract_tokens(kw):
#         return {w.lower() for w in kw.split() if len(w) > 3}

#     tokens_map = {item["keyword"]: extract_tokens(item["keyword"]) for item in keyword_list}

#     token_groups = defaultdict(list)
#     for item in keyword_list:
#         kw = item["keyword"]
#         sig_tokens = tokens_map[kw]
#         for tok in sig_tokens:
#             token_groups[tok].append(item)

#     final_tracker = defaultdict(lambda: defaultdict(lambda: {"score": 0.0, "count": 0}))
#     used = set()

#     for token, group in token_groups.items():

#         if len(group) == 1:
#             item = group[0]
#             kw = item["keyword"]
#             for topic, stats in item["topics"].items():
#                 final_tracker[kw][topic]["score"] += stats["score"]
#                 final_tracker[kw][topic]["count"] += stats["count"]
#             continue

#         total_scores = [g["total_score"] for g in group]
#         max_score = max(total_scores)
#         min_score = min(total_scores)

#         balanced = (max_score / max(1, min_score)) < 2

#         if balanced:
#             parent_kw = token
#         else:
#             parent_kw = max(group, key=lambda x: x["total_score"])["keyword"]

#         for item in group:
#             for topic, stats in item["topics"].items():
#                 final_tracker[parent_kw][topic]["score"] += stats["score"]
#                 final_tracker[parent_kw][topic]["count"] += stats["count"]

#             used.add(item["keyword"])

#     for item in keyword_list:
#         if item["keyword"] not in used:
#             kw = item["keyword"]
#             for topic, stats in item["topics"].items():
#                 final_tracker[kw][topic]["score"] += stats["score"]
#                 final_tracker[kw][topic]["count"] += stats["count"]

#     return final_tracker

# def configure_swap():
#     if os.geteuid() != 0: return
#     try:
#         res = subprocess.run("swapon --show", shell=True, stdout=subprocess.PIPE, text=True)
#         if "/swapfile" not in res.stdout:
#             print("Creating 2GB Swap...")
#             os.system("fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile")
#     except: pass

# configure_swap()

# print("Loading Models...")
# try:
#     print("   -> Loading Arabic Classifier...")
#     pipe_ar = pipeline("text-classification", model=ARABIC_MODEL, tokenizer=ARABIC_MODEL, device=-1, top_k=1)
    
#     print("   -> Loading English Classifier...")
#     pipe_en = pipeline("text-classification", model=ENGLISH_MODEL, tokenizer=ENGLISH_MODEL, device=-1, top_k=1)
    
#     print(f"   -> Loading KeyBERT ({KEYWORD_MODEL})...")
#     kw_model = KeyBERT(model=KEYWORD_MODEL)
    
#     print("All Models Loaded.")
# except Exception as e:
#     print(f"Error loading models: {e}")
#     sys.exit(1)

# def process_file():
#     if not os.path.exists(INPUT_FILE):
#         print(f"'{INPUT_FILE}' missing. Run generate_mixed_data.py first.")
#         return

#     print(f"Processing '{INPUT_FILE}'...")
    
#     processed_tweets = []
    
#     keyword_tracker = defaultdict(lambda: defaultdict(lambda: {"score": 0.0, "count": 0}))

#     with open(INPUT_FILE, 'r', encoding='utf-8') as f:
#         lines = f.readlines()

#     for i, line in enumerate(lines):
#         text = line.strip()
#         if not text: continue

#         is_ar = bool(re.search(r'[\u0600-\u06FF]', text))

#         try:
#             if is_ar:
#                 pred = pipe_ar(text)[0][0]
#             else:
#                 pred = pipe_en(text)[0][0]

#             label = pred['label']
#             score = round(pred['score'], 4)

#             if score < MIN_SCORE:
#                 label = "General"
#             else:
#                 if not is_ar and label in LABEL_MAP:
#                     label = LABEL_MAP[label]
#                 if label == "Religion":
#                     label = "General"

#             trend_category = LABEL_MAP.get(label, label)
#             if label in TREND_TOPIC_MAP:
#                 trend_category = TREND_TOPIC_MAP[label]
#             else:
#                 trend_category = "General"

#             keywords_raw = kw_model.extract_keywords(
#                 text, 
#                 keyphrase_ngram_range=(1, 2), 
#                 stop_words='english', 
#                 top_n=TOP_X_KEYWORDS,
#                 use_mmr=True,
#                 diversity=0.65
#             )
            
#             keywords_list = []
#             for k in keywords_raw:
#                 word = k[0]
#                 if word.lower() not in custom_ignore_list:
#                     keywords_list.append(word)
            
#             if not keywords_list:
#                 keywords_list = [k[0] for k in keywords_raw]

#             filtered_keywords = []
            
#             for kw in keywords_list:
#                 if not re.fullmatch(r'[A-Za-z]+(?:\s+[A-Za-z]+)*', kw):
#                     continue
                
#                 filtered_keywords.append(kw)
#                 keyword_tracker[kw][trend_category]["score"] += score
#                 keyword_tracker[kw][trend_category]["count"] += 1

#             processed_tweets.append({
#                 "id": i + 1,
#                 "content": text,
#                 "top_class": label 
#             })

#             kw_str = ", ".join(filtered_keywords)
#             print(f"[{i+1:02}] {label} -> {trend_category}: {text[:30]}... | KW: {kw_str}")

#         except Exception as e:
#             print(f"Error line {i+1}: {e}")

#     print("\nCalculating Trend Scores...")
#     final_tracker = merge_similar_keywords(keyword_tracker)
#     trending_keywords = []
    
#     for kw, topic_data in final_tracker.items():
#         general_trend_score = sum(t["score"] for t in topic_data.values())
        
#         topics_list = []
#         for topic, stats in topic_data.items():
#             topics_list.append({
#                 "topic": topic,
#                 "trend_score": round(stats["score"], 4),
#                 "occurrence_count": stats["count"]
#             })
        
#         topics_list.sort(key=lambda x: x["trend_score"], reverse=True)
        
#         top_relevant_topics = topics_list[:TOP_K_SUBTOPICS]

#         trending_keywords.append({
#             "keyword": kw,
#             "general_trend_score": round(general_trend_score, 4),
#             "top_related_topics": top_relevant_topics
#         })

#     trending_keywords.sort(key=lambda x: x["general_trend_score"], reverse=True)
#     trending_keywords = trending_keywords[:TOP_TREND_LIMIT]

#     final_output = {
#         "batch_meta": {
#             "total_tweets": len(processed_tweets),
#         },
#         "trending_keywords": trending_keywords,
#         "tweets_detail": processed_tweets
#     }

#     with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
#         json.dump(final_output, f, ensure_ascii=False, indent=4)
    
#     print(f"\nResults saved to '{OUTPUT_FILE}'")
    
#     print("\nTOP 5 TRENDING KEYWORDS")
#     for i, item in enumerate(trending_keywords[:5]):
#         top_topic = item['top_related_topics'][0]
#         print(f"{i+1}. {item['keyword']} (Score: {item['general_trend_score']}) -> {top_topic['topic']}")

# if __name__ == "__main__":
#     process_file()