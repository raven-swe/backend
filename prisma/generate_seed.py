import json
import random
from datetime import datetime, timedelta
from faker import Faker
import re

fake = Faker()

# ============================================================================
# CONFIGURATION - All configurable constants are at the top for easy editing
# ============================================================================

# Mode: "normal" or "trending"
# - "normal": generates tweets across the full date range
# - "trending": generates tweets only within TRENDING_START_TIME to TRENDING_END_TIME
GENERATION_MODE = "trending"

# Time Configuration
CURRENT_DATE = datetime(2025, 12, 15, 2, 0, 0)  # Current time reference

# Trending Mode Time Window (only used when GENERATION_MODE = "trending")
# For realistic trending data, set these relative to CURRENT_DATE (e.g., last 6-24 hours)
TRENDING_START_TIME = CURRENT_DATE - timedelta(hours=24)  # Start of trending period (24 hours ago)
TRENDING_END_TIME = CURRENT_DATE   # End of trending period (now)

# Trending Topics Filter (only used when GENERATION_MODE = "trending")
# Empty list means all topics are allowed. Non-empty list filters to only those topics.
# Example: ["Sports", "Tech"] will only generate tweets for Sports and Tech categories
TOPIC_TREND = ["Sports" , "Politics"]  # Options: "Sports", "Entertainment", "Finance", "Politics", "Tech", "Culture", "General", "Learning", "Travel"

# Generation Counts
USER_COUNT = 100
TWEET_COUNT = 500
RETWEET_COUNT = 200
LIKE_COUNT_RANGE = (1000, 2000)

# Interests/Categories
INTERESTS = ["Sports", "Entertainment", "Finance", "Politics", "Tech", "Culture", "General", "Learning", "Travel"]

# ============================================================================
# RANDOM SEEDING
# ============================================================================

if GENERATION_MODE == "trending":
    # Dynamic seed for trending mode to ensure valid, new data
    seed_val = int(datetime.now().timestamp())
    Faker.seed(seed_val)
    random.seed(seed_val)
    print(f"Trending Mode: Using dynamic seed {seed_val}")
else:
    # Fixed seed for normal mode
    Faker.seed(42)
    random.seed(42)
    print("Normal Mode: Using fixed seed 42")

# ============================================================================
# HASHTAG SETS - Base and Trending hashtags per category
# ============================================================================

# Base hashtags (always available)
BASE_HASHTAGS = {
    "Sports": ["sports", "football", "basketball", "soccer", "nba", "nfl", "fitness", "gym", "workout", "athlete", "game", "match", "team", "player", "win"],
    "Entertainment": ["movies", "music", "tv", "entertainment", "celebrity", "film", "concert", "album", "show", "streaming", "artist", "actor", "singer", "netflix", "hollywood"],
    "Finance": ["finance", "investing", "stocks", "crypto", "bitcoin", "trading", "money", "wealth", "economy", "market", "portfolio", "savings", "business", "entrepreneur", "fintech"],
    "Politics": ["politics", "election", "vote", "government", "democracy", "policy", "news", "breaking", "congress", "senate", "campaign", "debate", "legislation", "reform"],
    "Tech": ["tech", "ai", "programming", "coding", "software", "startup", "innovation", "developer", "technology", "machinelearning", "data", "cloud", "cybersecurity", "apps", "gadgets"],
    "Culture": ["culture", "art", "food", "travel", "history", "heritage", "tradition", "museum", "festival", "cuisine", "architecture", "design", "fashion", "lifestyle"],
    "General": ["life", "motivation", "inspiration", "thoughts", "daily", "mood", "vibes", "weekend", "morning", "happiness", "grateful", "blessed", "positivity", "mindset"],
    "Learning": ["learning", "education", "books", "reading", "study", "knowledge", "growth", "selfimprovement", "skills", "course", "tutorial", "wisdom", "mindset", "productivity"],
    "Travel": ["travel", "wanderlust", "vacation", "adventure", "explore", "trip", "destination", "tourism", "backpacking", "roadtrip", "beach", "mountains", "citybreak", "passport"],
}

# Trending hashtags (used in trending mode, more specific/timely)
TRENDING_HASHTAGS = {
    "Sports": ["worldcup2025"],
    "Entertainment": ["musicvideo"],
    "Finance": ["bullmarket"],
    "Politics": ["election2025"],
    "Tech": ["chatgpt"],
    "Culture": ["foodie2025"],
    "General": ["trending"],
    "Learning": ["studytips"],
    "Travel": ["travelgram"],
}

# ============================================================================
# PROFILE PICTURE URLs
# ============================================================================

PROFILE_PIC_URLS = [
    "https://pbs.twimg.com/profile_images/1164682491069943809/uGwI0V6H_400x400.jpg",
    "https://pbs.twimg.com/media/GB5j51SWsAAEKtA.jpg",
    "https://2img.net/h/images.wikia.com/spongebob/ar/images/4/40/Gary.png",
    "https://m.media-amazon.com/images/I/51Qnhj882mL._AC_SY1000_.jpg",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScwpT9d25rR0PBvoFiR9WToxPTtoxIrtGsww&s",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRygMJUDjusueYTsqxL_D9_N8egtHzmL3vxiQ&s",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRgfC-BRJOTrhfY7U-jtoYn_7Hze0hhz-nvbw&s",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-K85HXzMmj_IgS1uROfxfo5Ub9LJC2mIKrg&s",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQlb4vyuZyv5kamkmKHDAHj-MVD_lP3-5i1cg&s",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZbAOveMkdMmFdsYBFwkzgJO5TN1_S0aiM5g&s",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT7FzMyfNQyShq5kdpvGXWnohXcnhPuTJCaO_pl8EZotqwQTw1cE7xTkHOgSv5fKt6bboaNd86x_6GhrdF1b6DqafBIVAzHqLptMDVvOA&s=10",
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1527980965255-d3b416303d12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1628157588553-5eeea00af15c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1599566150163-29194dcaad36?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=800",
] * 10


# ============================================================================
# MEDIA URLs
# ============================================================================

IMAGE_URLS = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    "https://images.pexels.com/photos/358492/pexels-photo-358492.jpeg?auto=compress&cs=tinysrgb&w=1920",
    "https://images.pexels.com/photos/442559/pexels-photo-442559.jpeg?auto=compress&cs=tinysrgb&w=1920",
    "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=1920",
    "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=1920",
    "https://images.pexels.com/photos/1591060/pexels-photo-1591060.jpeg?auto=compress&cs=tinysrgb&w=1920",
    "https://images.pexels.com/photos/346529/pexels-photo-346529.jpeg?auto=compress&cs=tinysrgb&w=1920",
    "https://images.pexels.com/photos/267885/pexels-photo-267885.jpeg?auto=compress&cs=tinysrgb&w=1920",
    "https://images.unsplash.com/photo-1687949447141-1c730e32f261?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1687910623555-25c1df52d708?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1679239108020-aca50acd5f00?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1629975326958-bbeeb2d5beb9?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1706043050286-2f3b5613e6a5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1706043050292-1f8582ca8739?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1634150607959-62c965982999?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1630948197497-3c0de9d73ad2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://pbs.twimg.com/media/G8M1SKqWEA0zBeq?format=jpg&name=4096x4096",
    "https://pbs.twimg.com/media/G8NH_cXXIAMu7gW?format=jpg&name=medium",
    "https://pbs.twimg.com/media/G8G4s2lW4AUWNKJ?format=jpg&name=large",
    "https://pbs.twimg.com/media/G8H51koXAAESPfO?format=jpg&name=large",
    "https://pbs.twimg.com/media/G8Fj_WsbwAArIBB?format=jpg&name=large",
    "https://pbs.twimg.com/media/G8K55uXaUAAed9j?format=jpg&name=large",
    "https://pbs.twimg.com/media/G8HzLyZWEAEH0Jk?format=jpg&name=4096x4096"
] * 5

VIDEO_URLS = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
] * 10

GIF_URLS = [
    "https://cdn.dribbble.com/userupload/19906993/file/original-145ef8617ff6330321c1c1565d7fc587.gif",
    "https://i.pinimg.com/originals/b3/59/eb/b359eb60775b16e7edd8c5fa1ecf2ba7.gif",
    "https://cdn.dribbble.com/users/2158347/screenshots/6041012/gareso_socialmedia_01_dribble.gif",
    "https://mir-s3-cdn-cf.behance.net/project_modules/hd/95f14169931063.5b91ee22bb585.gif",
    "https://www.techsmith.com/wp-content/uploads/2016/08/citylarge.gif",
    "https://i.pinimg.com/originals/f4/f3/73/f4f37379be88e2ca55bc10be8de48b71.gif",
    "https://i.pinimg.com/originals/9a/1f/11/9a1f11839c9f9e902f09e8259805319a.gif",
    "https://i.pinimg.com/originals/56/65/5b/56655bda3afc62cb70c9c4c00b5d3834.gif",
    "https://i.pinimg.com/originals/b8/42/a2/b842a20a95ab386abdaa14515e8a60e2.gif",
    "https://i.pinimg.com/originals/2e/de/92/2ede929563a2c2fdb8f6cd87eb02c753.gif",
    "https://i.pinimg.com/originals/5e/3b/70/5e3b70f025f946e810edae941c661766.gif",
    "https://i.pinimg.com/originals/47/2a/8b/472a8bbdefde5267a4453e7a030b6263.gif",
    "https://i.pinimg.com/originals/59/e9/2d/59e92dd3460e387cd65551925d789748.gif",
] * 20

# ============================================================================
# CONTENT TEMPLATES - Use {hashtag} placeholder, will be replaced with category hashtags
# ============================================================================

CONTENT_TEMPLATES = {
    "Sports": [
        "What a game! {team} absolutely crushed it tonight. The energy in the stadium was unreal, and that final play will go down in history. 🔥",
        "I still can't believe that last-minute goal! ⚽ Outcomes like this are why I love this sport. The defense completely fell apart.",
        "Training hard for the weekend match. Pushing limits every single day to be better than yesterday. 💪 It's not just about winning, it's about the grind.",
        "{player} is on fire this season! Averaging career highs across the board. MVP conversation needs to start right now.",
        "The officiating in the {team} game was questionable at best. We need better standards if the league wants to be taken seriously. 😤",
        "Just bought tickets for the finals! It's going to be a long trip but totally worth it to see {team} play live. Who else is going? 🎫",
        "{player} is a very underrated striker! {games} games, {goals} goals, {assists} assists, {trophies} trophies. Unique player! ❤️",
        "{player}'s career stats are insane! {games} games, {goals} goals, {assists} assists, {trophies} trophies. The greatest! 🐐",
    ],
    "Entertainment": [
        "Just watched {movie} and I am mind blown 🤯. The cinematography, the score, the acting—everything was perfection. Highly recommend!",
        "New album from {artist} dropped and it's pure gold on repeat 🎶. Every track tells a story.",
        "Binge-watching {show} all weekend. I told myself I'd watch one episode, and here I am at 3 AM. No regrets though! 😂",
        "The season finale of {show} left me speechless. I have so many theories about what happens next season. Let's discuss! 👇",
        "Concert tickets for {artist} sold out in seconds? This system is rigged. I just wanted to see them live once! 😭",
        "Huge congratulations to {artist} for a powerful and heartfelt performance! 🌟 Here's to more unforgettable moments ahead. 💙✨",
    ],
    "Finance": [
        "Bitcoin just hit ${price}k! The momentum is undeniable right now. Is this the start of the next massive bull run or a trap? 🚀",
        "Market volatility is crazy right now. One minute we're up, the next we're down. Holding steady and trusting the long-term strategy. 📉📈",
        "Diversifying my portfolio with {asset}. It's a hedge against inflation and a solid long-term play. What are your thoughts?",
        "Just finished analyzing the Q3 reports for tech sector. Some surprising numbers that the market hasn't priced in yet. 📊",
        "Financial freedom isn't about being rich, it's about having options. Started my journey today with a new savings plan. 💰",
        "Historically, this is the point where capital rotates from {asset} into alternative investments.",
    ],
    "Politics": [
        "Important election coming up. The stakes have never been higher. Make sure to do your research and vote! Your voice matters. 🗳️",
        "New policy announcement today regarding infrastructure. While the goals are good, I'm concerned about the execution timeline.",
        "Debates are heating up. It's interesting to see how the narrative shifts depending on which network you watch. 📺",
        "Local council meeting lasted 5 hours yesterday. Democracy is exhausting but necessary work. 🏛️",
        "Breaking News: Major political developments today. Stay informed and engaged with the process.",
    ],
    "Tech": [
        "Just got my hands on the new {gadget}! The build quality is insane, and the battery life is finally what we've been asking for. 🚀",
        "AI is changing everything faster than we expected. From coding to art, the landscape is shifting daily. Excited for the future 🤖",
        "Coding all night on a new project. Finally fixed that bug that's been haunting me for days. The relief is real. 👨‍💻",
        "The new update for VS Code is a game changer. The productivity boost nicely offsets the learning curve. 💻",
        "Is it just me or is {gadget} overrated? I've been using it for a week and I'm not seeing the hype. Let me know your experience. 📱",
        "Our Top {number} Tech Stocks to Own in the AI Revolution 🏆🐂🔥",
    ],
    "Culture": [
        "Visited this amazing museum today. The exhibit on ancient civilizations was breathtaking. Puts so much into perspective. 🎨",
        "Trying out {food} from {country} for the first time — absolute flavor explosion! 🍲 The spices are unlike anything I've tried before.",
        "Attended a local festival celebrating heritage and tradition. The music, the dance, the clothes—so vibrant and alive. ❤️",
        "Reading about the history of {city} before my trip. It's fascinating how much the architecture tells the story of its past. 🏰",
        "Looking for a warm spot in {city} this winter? ☃️ Check out the local museums for quiet escapes.",
    ],
    "General": [
        "Good morning everyone! ☀️ The sun is shining, coffee is brewing, and it feels like it's going to be a productive day.",
        "Coffee is life ☕. I literally cannot function without my morning brew. Currently trying a dark roast from Ethiopia.",
        "Weekend vibes 😎. Finally some time to relax, recharge, and maybe catch up on some reading. No emails allowed until Monday!",
        "Sometimes you just need to disconnect and take a walk in nature. The fresh air does wonders for the mind. 🌲",
        "Does anyone else feel like this year is flying by? It's already December! Time needs to slow down. ⏳",
    ],
    "Learning": [
        "Just finished reading {book}. It challenged so many of my assumptions. Highly recommend! 📚",
        "Learning {skill} on YouTube today. It's amazing how much free education is available if you just look for it. 👨‍🎓",
        "Struggling with this new concept in my course, but I'm not giving up. Persistence is key! 🔑",
        "Attended a workshop on leadership today. Best takeaway: 'Listen more than you speak'. Simple but powerful. 🧠",
        "The Golden Rule when you're learning a new skill: practice consistently, even if just 15 minutes a day.",
    ],
    "Travel": [
        "Just booked tickets to {place}! It's been on my bucket list for years. Can't wait to explore ✈️",
        "Sunset views like this make everything worth it. The colors in the sky are unreal. Grateful for these moments. 🌅",
        "Exploring hidden gems in {city}. Found this cute little cafe tucked away in an alley. Best part of traveling! 🗺️",
        "Packing light is an art form I have yet to master. Somehow my suitcase is already full and I haven't even packed shoes. 🧳",
        "Sunset state of mind 🍹🌴🌞🌊",
        "Exploring medieval villages in {country} 💫",
    ],
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_hashtags_for_category(category: str, use_trending: bool = False) -> list:
    """Get hashtags for a category. If trending mode, mix base and trending."""
    base = BASE_HASHTAGS.get(category, BASE_HASHTAGS["General"])
    if use_trending:
        trending = TRENDING_HASHTAGS.get(category, TRENDING_HASHTAGS["General"])
        return trending
    return base


def normalize_content(content: str) -> str:
    """
    Normalize content to ensure:
    - All hashtags are lowercase
    - Proper spacing between hashtags, mentions, and words
    """
    # First, ensure hashtags are lowercase
    content = re.sub(r'#(\w+)', lambda m: '#' + m.group(1).lower(), content)
    
    # Ensure space before hashtags (but not at start)
    content = re.sub(r'(\S)(#\w+)', r'\1 \2', content)
    
    # Ensure space after hashtags (if followed by non-word, non-space char)
    content = re.sub(r'(#\w+)([^\w\s])', r'\1 \2', content)
    
    # Ensure space before mentions (but not at start)
    content = re.sub(r'(\S)(@\w+)', r'\1 \2', content)
    
    # Ensure space after mentions (if followed by non-word, non-space char)
    content = re.sub(r'(@\w+)([^\w\s])', r'\1 \2', content)
    
    # Remove multiple consecutive spaces
    content = re.sub(r' +', ' ', content)
    
    # Remove space before punctuation
    content = re.sub(r' ([.,!?])', r'\1', content)
    
    return content.strip()


def add_hashtags_to_content(content: str, category: str, num_hashtags: int = 2) -> str:
    """Add category-appropriate hashtags to content with proper spacing."""
    use_trending = GENERATION_MODE == "trending"
    available_hashtags = get_hashtags_for_category(category, use_trending)
    
    # Select random hashtags (ensure lowercase)
    selected = random.sample(available_hashtags, min(num_hashtags, len(available_hashtags)))
    hashtag_str = " ".join([f"#{tag.lower()}" for tag in selected])
    
    # Add hashtags with proper spacing
    if content.endswith(('.', '!', '?', '…')):
        content = content + " " + hashtag_str
    else:
        content = content + " " + hashtag_str
    
    return content


def extract_hashtags(content: str) -> list:
    """Extract all hashtags from content (lowercase)."""
    hashtags = re.findall(r'(?:^|(?<=\s))#(\w+)', content)
    return [tag.lower() for tag in set(hashtags)]


def extract_mentions(content: str, usernames: set) -> list:
    """Extract valid mentions from content."""
    mentions = re.findall(r'(?:^|(?<=\s))@(\w+)', content)
    return [m for m in mentions if m.lower() in {u.lower() for u in usernames}]


def generate_timestamp() -> str:
    """Generate timestamp based on mode."""
    if GENERATION_MODE == "trending":
        # Generate within the trending time window
        time_diff = (TRENDING_END_TIME - TRENDING_START_TIME).total_seconds()
        random_seconds = random.uniform(0, time_diff)
        timestamp = TRENDING_START_TIME + timedelta(seconds=random_seconds)
        return timestamp.isoformat() + "Z"
    else:
        # Normal mode: random time in last 30 days
        rand = random.random()
        if rand < 0.6:
            delta = timedelta(days=random.randint(1, 30))
        elif rand < 0.9:
            delta = timedelta(hours=random.randint(1, 48))
        else:
            delta = timedelta(minutes=random.randint(5, 120))
        return (CURRENT_DATE - delta).isoformat() + "Z"


# ============================================================================
# GENERATION FUNCTIONS
# ============================================================================

def generate_users(n: int = USER_COUNT) -> list:
    """Generate user data."""
    users = []
    usernames = set()
    
    while len(users) < n:
        username = fake.user_name().lower()
        if username in usernames or not username.isalnum():
            continue
        usernames.add(username)
        
        avatar_url = None
        if random.random() > 0.1:
            avatar_url = random.choice(PROFILE_PIC_URLS)

        user = {
            "username": username,
            "email": fake.email(),
            "displayName": fake.name(),
            "bio": fake.sentence(nb_words=10)[:160] if random.random() > 0.3 else "",
            "birthdate": fake.date_between(start_date='-55y', end_date='-20y').strftime('%Y-%m-%d'),
            "interests": random.sample(INTERESTS, k=random.randint(1, 4)),
            "location": f"{fake.city()}, {fake.country()}" if random.random() > 0.4 else "",
            "avatarUrl": avatar_url
        }
        
        if random.random() > 0.7:
            user["bio"] += " " + random.choice(["🚀", "☕", "🌍", "🎮", "📚", "🏃", "🎨"])
        
        users.append(user)
    
    return users


def generate_tweets(users: list, n: int = TWEET_COUNT) -> tuple:
    """Generate tweet data."""
    tweets = []
    usernames = {u["username"] for u in users}
    reply_candidates = []
    popular_tweet_indices = []

    # Template placeholders
    format_kwargs = {
        "team": lambda: random.choice(["Lakers", "Real Madrid", "Yankees", "Manchester City", "Ferrari"]),
        "movie": lambda: random.choice(["Oppenheimer", "Dune", "Inception", "Barbie", "The Batman"]),
        "artist": lambda: random.choice(["Taylor Swift", "Drake", "Beyoncé", "The Weeknd", "Kendrick Lamar"]),
        "show": lambda: random.choice(["Stranger Things", "The Office", "Breaking Bad", "Succession", "The Bear"]),
        "price": lambda: random.randint(30, 90),
        "asset": lambda: random.choice(["ETFs", "gold", "real estate", "tech stocks"]),
        "gadget": lambda: random.choice(["iPhone 16", "PS5 Pro", "M3 MacBook", "Vision Pro"]),
        "food": lambda: random.choice(["sushi", "tacos", "pizza", "ramen", "curry"]),
        "country": lambda: random.choice(["Japan", "Italy", "Mexico", "Thailand", "France"]),
        "book": lambda: random.choice(["Atomic Habits", "Sapiens", "1984", "The Alchemist"]),
        "skill": lambda: random.choice(["Python", "Spanish", "guitar", "cooking", "investing"]),
        "place": lambda: random.choice(["Paris", "Tokyo", "Bali", "New York", "London"]),
        "city": lambda: random.choice(["Barcelona", "New York", "Kyoto", "Rome", "Berlin"]),
        "player": lambda: random.choice(["LeBron", "Messi", "Mahomes", "Curry", "Haaland"]),
        "number": lambda: random.randint(5, 20),
        "games": lambda: random.randint(100, 800),
        "goals": lambda: random.randint(50, 500),
        "assists": lambda: random.randint(30, 300),
        "trophies": lambda: random.randint(5, 30),
    }

    for i in range(n):
        user_idx = random.randint(0, len(users) - 1)
        user = users[user_idx]
        
        # Filter category based on trending mode and TOPIC_TREND
        if GENERATION_MODE == "trending" and TOPIC_TREND:
            # Only select from categories that are in TOPIC_TREND
            available_categories = [cat for cat in user["interests"] if cat in TOPIC_TREND]
            if not available_categories:
                # If user has no interests in TOPIC_TREND, skip or use first TOPIC_TREND item
                category = random.choice(TOPIC_TREND)
            else:
                category = random.choice(available_categories)
        else:
            # Normal mode or trending mode with empty TOPIC_TREND
            category = random.choice(user["interests"])

        # Random tweet type weights
        w1 = random.randint(10, 50)
        w2 = random.randint(10, 50)
        w3 = random.randint(20, 40)
        w4 = random.randint(20, 40)
        w5 = random.randint(5, 15)
        
        tweet_type = random.choices(
            ["regular", "media", "reply", "quote", "combined"],
            weights=[w1, w2, w3, w4, w5], k=1
        )[0]

        template = random.choice(CONTENT_TEMPLATES.get(category, CONTENT_TEMPLATES["General"]))
        
        # Build format args
        args = {k: v() for k, v in format_kwargs.items()}
        content = template.format(**args)

        # Add hashtags from category set
        num_hashtags = random.randint(1, 3)
        content = add_hashtags_to_content(content, category, num_hashtags)

        # Add emojis sometimes
        if random.random() > 0.5:
            emojis = ["🚀", "🔥", "🤯", "😂", "☕", "🌟", "✈️", "📈", "⚽", "🎉"]
            content += " " + " ".join(random.sample(emojis, k=random.randint(1, 2)))

        # Add mentions sometimes
        if random.random() > 0.85 and tweet_type in ["reply", "combined"]:
            possible_mentions = random.sample(list(usernames - {user["username"]}), k=min(2, len(usernames) - 1))
            mention_str = " ".join([f"@{m}" for m in possible_mentions[:random.randint(1, 2)]])
            content = mention_str + " " + content

        # Normalize content (spacing, lowercase hashtags)
        content = normalize_content(content)

        # Extract hashtags and mentions
        hashtags = extract_hashtags(content)
        mentions = extract_mentions(content, usernames)

        # Generate media
        media = []
        if tweet_type in ["media", "combined"]:
            num_media = random.randint(1, 3)
            for _ in range(num_media):
                media_type = random.choice(["IMAGE", "VIDEO", "GIF"])
                if media_type == "IMAGE":
                    media.append({
                        "url": random.choice(IMAGE_URLS),
                        "type": "IMAGE",
                        "width": random.randint(800, 1920),
                        "height": random.randint(600, 1080),
                        "altText": fake.sentence(nb_words=6)
                    })
                elif media_type == "VIDEO":
                    media.append({
                        "url": random.choice(VIDEO_URLS),
                        "type": "VIDEO",
                        "altText": fake.sentence(nb_words=6)
                    })
                else:
                    media.append({
                        "url": random.choice(GIF_URLS),
                        "type": "GIF",
                        "altText": fake.sentence(nb_words=6)
                    })

        # Handle replies and quotes
        reply_to = None
        quoted = None
        if tweet_type == "reply" and reply_candidates:
            reply_to = random.choice(reply_candidates)
        elif tweet_type == "quote" and len(tweets) > 10:
            quoted = random.choice(range(max(0, i - 200), i))

        tweet = {
            "userIndex": user_idx,
            "content": content[:280],
            "category": category,
            "hashtags": hashtags,
            "mentions": mentions,
            "createdAt": generate_timestamp(),
            "media": media,
            "replyToTweetIndex": reply_to,
            "quotedTweetIndex": quoted
        }

        tweets.append(tweet)
        reply_candidates.append(i)
        
        if random.random() < 0.15:
            popular_tweet_indices.extend([i] * random.randint(3, 10))

    return tweets, popular_tweet_indices


def generate_retweets(tweets: list, popular_indices: list, n: int = RETWEET_COUNT) -> list:
    """Generate retweet data."""
    retweets = []
    users_count = USER_COUNT

    for _ in range(n):
        tweet_idx = random.choice(popular_indices) if popular_indices else random.randint(0, len(tweets) - 1)
        tweet = tweets[tweet_idx]
        user_idx = random.randint(0, users_count - 1)
        
        while user_idx == tweet["userIndex"]:
            user_idx = random.randint(0, users_count - 1)
        
        orig_time = datetime.fromisoformat(tweet["createdAt"][:-1])
        delta = timedelta(minutes=random.randint(1, 1440))
        retweet_time = (orig_time + delta).isoformat() + "Z"

        retweets.append({
            "userIndex": user_idx,
            "tweetIndex": tweet_idx,
            "createdAt": retweet_time
        })

    return retweets


def generate_likes(users: list, tweets: list, n_range: tuple = LIKE_COUNT_RANGE) -> list:
    """Generate like data."""
    likes = []
    n = random.randint(*n_range)
    used_pairs = set()

    for _ in range(n):
        user_idx = random.randint(0, len(users) - 1)
        tweet_idx = random.randint(0, len(tweets) - 1)
        pair = (user_idx, tweet_idx)
        
        attempts = 0
        while pair in used_pairs and attempts < 5:
            user_idx = random.randint(0, len(users) - 1)
            tweet_idx = random.randint(0, len(tweets) - 1)
            pair = (user_idx, tweet_idx)
            attempts += 1
        
        if pair in used_pairs:
            continue
        
        used_pairs.add(pair)
        
        tweet = tweets[tweet_idx]
        orig_time = datetime.fromisoformat(tweet["createdAt"][:-1])
        delta = timedelta(minutes=random.randint(1, 4000))
        like_time = (orig_time + delta).isoformat() + "Z"

        likes.append({
            "userIndex": user_idx,
            "tweetIndex": tweet_idx,
            "createdAt": like_time
        })
    
    return likes


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    print(f"Generation Mode: {GENERATION_MODE}")
    if GENERATION_MODE == "trending":
        print(f"Trending Window: {TRENDING_START_TIME} to {TRENDING_END_TIME}")
    
    print("\nGenerating users...")
    users = generate_users(USER_COUNT)

    print("Generating tweets...")
    tweets, popular_indices = generate_tweets(users, TWEET_COUNT)

    print("Generating retweets...")
    retweets = generate_retweets(tweets, popular_indices, RETWEET_COUNT)

    print("Generating likes...")
    likes = generate_likes(users, tweets, LIKE_COUNT_RANGE)

    data = {
        "meta": {
            "mode": GENERATION_MODE
        },
        "users": users,
        "tweets": tweets,
        "retweets": retweets,
        "likes": likes
    }

    print("Writing to file...")
    with open("seed-data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nDone! Generated seed-data.json:")
    print(f"  - Users: {len(users)}")
    print(f"  - Tweets: {len(tweets)}")
    print(f"  - Retweets: {len(retweets)}")
    print(f"  - Likes: {len(likes)}")