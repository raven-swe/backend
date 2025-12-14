from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List
from contextlib import asynccontextmanager
import logging
from processor import TweetProcessor

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

processor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global processor
    logger.info("Starting FastAPI application...")
    logger.info("Initializing TweetProcessor...")
    processor = TweetProcessor()
    logger.info("TweetProcessor initialized successfully")
    yield
    logger.info("Shutting down FastAPI application...")

app = FastAPI(
    title="Tweet Analysis API",
    description="API for analyzing tweets and extracting trending keywords with topic classification",
    version="1.0.0",
    lifespan=lifespan
)

class Tweet(BaseModel):
    id: str = Field(..., description="Unique tweet identifier")
    content: str = Field(..., description="Tweet text content")

class TweetRequest(BaseModel):
    tweets: List[Tweet] = Field(..., description="List of tweets to analyze", min_items=1)

class TopicInfo(BaseModel):
    topic: str = Field(..., description="Topic category")
    trend_score: float = Field(..., description="Trend score for this topic")
    occurence_in_category: int = Field(..., description="Number of unique tweets in this topic category")

class TrendingKeyword(BaseModel):
    keyword: str = Field(..., description="The trending keyword or hashtag")
    general_trend_score: float = Field(..., description="Overall trend score across all topics")
    top_related_topics: List[TopicInfo] = Field(..., description="Top related topics for this keyword")

class BatchMeta(BaseModel):
    total_tweets: int = Field(..., description="Total number of tweets processed")

class ProcessedTweet(BaseModel):
    id: str = Field(..., description="Tweet ID")
    class_: str = Field(..., description="Classified topic category", alias="class")

class TweetResponse(BaseModel):
    batch_meta: BatchMeta = Field(..., description="Metadata about the batch processing")
    trending_keywords: List[TrendingKeyword] = Field(..., description="List of trending keywords with their scores")
    tweets_detail: List[ProcessedTweet] = Field(..., description="Detailed information for each processed tweet")

@app.post(
    "/analyze",
    response_model=TweetResponse,
    summary="Analyze tweets for trending keywords",
    description="""
    Analyzes a batch of tweets to extract trending keywords and classify them by topic.
    
    The endpoint performs the following operations:
    - Detects language (Arabic or English)
    - Classifies tweets into topic categories
    - Extracts relevant keywords using KeyBERT
    - Extracts and processes hashtags
    - Calculates trend scores for keywords and hashtags
    - Groups keywords by related topics
    - Returns top trending keywords with their topic associations
    
    **Topic Categories:**
    - Entertainment: Movies, TV, music, fashion, celebrity news
    - Sports: All sports-related content
    - News: Finance, politics, technology, medical, business
    - General: Culture, religion, food, learning, travel, daily life
    - Gaming: Gaming-related content
    
    **Supported Languages:**
    - English
    - Arabic
    """
)
async def analyze_tweets(request: TweetRequest):
    try:
        logger.info(f"Received analyze request with {len(request.tweets)} tweets")
        
        if not request.tweets:
            logger.warning("Request received with no tweets")
            raise HTTPException(status_code=400, detail="No tweets provided")
        
        result = processor.process_tweets(request.tweets)
        
        logger.info(f"Successfully processed {result['batch_meta']['total_tweets']} tweets")
        logger.info(f"Returning {len(result['trending_keywords'])} trending items")
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing tweets: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

@app.get("/health", summary="Health check", description="Check if the API is running and models are loaded")
async def health_check():
    is_healthy = processor is not None
    logger.debug(f"Health check: models_loaded={is_healthy}")
    return {"status": "healthy" if is_healthy else "unhealthy", "models_loaded": is_healthy}
