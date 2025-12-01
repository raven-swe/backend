from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from contextlib import asynccontextmanager
from processor import TweetProcessor

processor = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global processor
    processor = TweetProcessor()
    yield

app = FastAPI(
    title="Tweet Analysis API",
    description="API for analyzing tweets and extracting trending keywords with topic classification",
    version="1.0.0",
    lifespan=lifespan
)

class TweetRequest(BaseModel):
    texts: List[str] = Field(..., description="List of tweet texts to analyze", min_items=1)

class TopicInfo(BaseModel):
    topic: str = Field(..., description="Topic category")
    trend_score: float = Field(..., description="Trend score for this topic")
    occurrence_count: int = Field(..., description="Number of occurrences in this topic")

class TrendingKeyword(BaseModel):
    keyword: str = Field(..., description="The trending keyword")
    general_trend_score: float = Field(..., description="Overall trend score across all topics")
    top_related_topics: List[TopicInfo] = Field(..., description="Top related topics for this keyword")

class BatchMeta(BaseModel):
    total_tweets: int = Field(..., description="Total number of tweets processed")

class ProcessedTweet(BaseModel):
    id: int = Field(..., description="Tweet ID")
    content: str = Field(..., description="Original tweet content")
    top_class: str = Field(..., description="Classified topic category")
    error: Optional[str] = Field(None, description="Error message if processing failed")

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
    - Calculates trend scores for keywords
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
        if not request.texts:
            raise HTTPException(status_code=400, detail="No texts provided")
        
        result = processor.process_tweets(request.texts)
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

@app.get("/health", summary="Health check", description="Check if the API is running and models are loaded")
async def health_check():
    return {"status": "healthy", "models_loaded": processor is not None}
