import json
import random
from datetime import datetime, timedelta
from faker import Faker
import re

fake = Faker()
Faker.seed(42)
random.seed(42)

CURRENT_DATE = datetime(2025, 12, 14, 12, 0, 0)  # As specified: December 14, 2025

INTERESTS = ["Sports", "Entertainment", "Finance", "Politics", "Tech", "Culture", "General", "Learning", "Travel"]

# Expanded list of real public image URLs (from Unsplash, Pexels, etc.)
IMAGE_URLS = [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1505373877841-5d097bf5bdc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
    "https://images.unsplash.com/photo-1519389951292-2d96bdcb0f1a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
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
    "https://images.unsplash.com/photo-1599391768906-2ee34247cce8?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1546464677-0244c514e3bd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1720792248948-bbc27475c8db?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1547322895-5137a4f40af6?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1601326659613-fd223caea978?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1548792231-0bccaf8933bb?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1601168706293-3dc2bd129f19?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1546464677-f093ea6dd0df?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1603287681836-b174ce5074c2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1546464676-9a2775a6e2f5?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1664712212589-17d7d66550fa?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1587751948648-aec429cb74fd?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1634150607959-62c965982999?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.unsplash.com/photo-1630948197497-3c0de9d73ad2?fm=jpg&q=60&w=3000&ixlib=rb-4.1.0",
    "https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?cs=srgb&dl=pexels-tracy-le-blanc-67789-607812.jpg&fm=jpg",
    "https://cdn.pixabay.com/photo/2015/10/21/08/22/media-998990_1280.jpg",
    "https://media.istockphoto.com/id/1413735503/photo/social-media-social-media-marketing-thailand-social-media-engagement-post-structure.jpg?s=612x612&w=0&k=20&c=7Y4Bdom9c7paYa67nSCvwSuFoppYxJIh-CTYqe6J4Js=",
    "https://www.stockvault.net/data/2019/10/07/269936/thumb16.jpg",
    "https://static.vecteezy.com/system/resources/thumbnails/004/811/254/small/young-woman-using-smart-phone-social-media-concept-free-photo.JPG",
    "https://media.istockphoto.com/id/1408387701/photo/social-media-marketing-digitally-generated-image-engagement.jpg?s=612x612&w=0&k=20&c=VVAxxwhrZZ7amcPYJr08LLZJTyoBVMN6gyzDk-4CXos=",
    "https://media.istockphoto.com/id/2163027477/photo/social-media-social-media-marketing-thailand-social-media-engagement-post-structure-social.jpg?s=612x612&w=0&k=20&c=S4akFeiKdq3z863Ml6phW3T0MC7ndZ00hgXRykmvLKM=",
    "https://thumbs.dreamstime.com/b/group-business-people-social-media-concept-41108812.jpg",
    "https://www.shutterstock.com/image-photo/adult-man-hand-hold-smartphone-260nw-2555954279.jpg",
    "https://media.istockphoto.com/id/1524210326/photo/hand-of-young-business-using-smartphone.jpg?s=612x612&w=0&k=20&c=pbi-k7P2r7A09gXV9e-OCqPDLaiZ47YT6tUleFOw9RA=",
] * 5  # Repeat for variety

# Real public video URLs (public domain or free stock MP4s)
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
    # Add more if needed, repeating for variety
] * 10

# Real GIF URLs from searches (direct .gif links)
GIF_URLS = [
    "https://cdn.dribbble.com/userupload/19906993/file/original-145ef8617ff6330321c1c1565d7fc587.gif",
    "https://i.pinimg.com/originals/b3/59/eb/b359eb60775b16e7edd8c5fa1ecf2ba7.gif",
    "https://cdn.dribbble.com/users/2158347/screenshots/6041012/gareso_socialmedia_01_dribble.gif",
    "https://cdn.myportfolio.com/453a92f80b154a9480bc9e2ebcb57c99/0d85d292-dde2-4b56-aa57-6dabcfb53582_rw_1200.gif?h=74a162d0b5ac210f11a9c199e9e5ccd1",
    "https://mir-s3-cdn-cf.behance.net/project_modules/hd/95f14169931063.5b91ee22bb585.gif",
    "https://blog-media-motionelements.s3-us-west-2.amazonaws.com/uploads/2017/02/giphy-16.gif",
    "https://techrahisi.co.ke/wp-content/uploads/2025/02/Tumblr.gif",
    "https://www.techsmith.com/wp-content/uploads/2016/08/citylarge.gif",
    "https://images.squarespace-cdn.com/content/v1/5fc7d4293baba059d297d1f3/1616731908089-0HXGSYRIPRQEUQMU01YG/MOCK_DIGITAL_PHONE.gif",
    "https://i.pinimg.com/originals/f4/f3/73/f4f37379be88e2ca55bc10be8de48b71.gif",
    # Repeat for variety
] * 20

# Sample content templates per category (unchanged)
CONTENT_TEMPLATES = {
    "Sports": [
        "What a game! {team} absolutely crushed it tonight 🔥 #Sports #{hashtag}",
        "Can't believe that last-minute goal! ⚽ #Sports",
        "Training hard for the weekend match 💪 #Fitness #Sports",
        "{player} is on fire this season! #NBA #Sports",
    ],
    "Entertainment": [
        "Just watched {movie} — mind blown 🤯 Highly recommend! #Movies",
        "New album from {artist} dropped and it's pure gold 🎶 #{hashtag}",
        "Binge-watching {show} all weekend. No regrets 😂 #TV",
    ],
    "Finance": [
        "Bitcoin just hit ${price}k! Bull run incoming? 🚀 #Crypto #Finance",
        "Market volatility is crazy right now 📉📈 #Stocks #Finance",
        "Diversifying my portfolio with {asset}. Thoughts? #Investing",
    ],
    "Politics": [
        "Important election coming up. Make sure to vote! 🗳️ #Politics",
        "New policy announcement today — what do you think? #News",
    ],
    "Tech": [
        "Just got my hands on the new {gadget}! Loving it 🚀 #Tech",
        "AI is changing everything. Excited for the future 🤖 #AI #Tech",
        "Coding all night on a new project 👨‍💻 #Programming #Tech",
    ],
    "Culture": [
        "Visited this amazing museum today 🎨 #Culture #Art",
        "Trying out {food} from {country} — delicious! 🍲 #Foodie",
    ],
    "General": [
        "Good morning everyone! ☀️ Hope you have a great day",
        "Coffee is life ☕ What's your go-to brew?",
        "Weekend vibes 😎",
    ],
    "Learning": [
        "Just finished reading {book}. Highly recommend! 📚 #Learning",
        "Learning {skill} on YouTube today 👨‍🎓",
    ],
    "Travel": [
        "Just booked tickets to {place}! Can't wait ✈️ #Travel",
        "Sunset views like this make everything worth it 🌅 #Travel",
        "Exploring hidden gems in {city} 🗺️",
    ],
}

def generate_users(n=1000):
    users = []
    usernames = set()
    while len(users) < n:
        username = fake.user_name().lower()
        if username in usernames or not username.isalnum():
            continue
        usernames.add(username)
        user = {
            "username": username,
            "email": fake.email(),
            "displayName": fake.name(),
            "bio": fake.sentence(nb_words=10, ext_word_list=None)[:160] if random.random() > 0.3 else "",
            "birthdate": fake.date_between(start_date='-55y', end_date='-20y').strftime('%Y-%m-%d'),
            "interests": random.sample(INTERESTS, k=random.randint(1, 4)),
            "location": f"{fake.city()}, {fake.country()}" if random.random() > 0.4 else ""
        }
        if random.random() > 0.7:
            user["bio"] += " " + random.choice(["🚀", "☕", "🌍", "🎮", "📚", "🏃", "🎨"])
        users.append(user)
    return users

def extract_hashtags(content):
    return list(set(re.findall(r'#(\w+)', content)))

def extract_mentions(content, usernames):
    mentions = re.findall(r'@(\w+)', content)
    valid_mentions = [m for m in mentions if m in usernames]
    return valid_mentions

def generate_timestamp():
    rand = random.random()
    if rand < 0.6:  # 60% 1-30 days ago
        delta = timedelta(days=random.randint(1, 30))
    elif rand < 0.9:  # 30% 1-48 hours ago
        delta = timedelta(hours=random.randint(1, 48))
    else:  # 10% 5-120 minutes ago
        delta = timedelta(minutes=random.randint(5, 120))
    return (CURRENT_DATE - delta).isoformat() + "Z"

def generate_tweets(users, n=5000):
    tweets = []
    usernames = {u["username"] for u in users}
    reply_candidates = []
    popular_tweet_indices = []

    for i in range(n):
        user_idx = random.randint(0, len(users)-1)
        user = users[user_idx]
        category = random.choice(user["interests"])

        # Choose tweet type - increased media probability to add more media
        tweet_type = random.choices(
            ["regular", "media", "reply", "quote", "combined"],
            weights=[30, 40, 15, 10, 5], k=1)[0]  # Increased media from 30 to 40, reduced regular from 40 to 30

        template = random.choice(CONTENT_TEMPLATES.get(category, CONTENT_TEMPLATES["General"]))
        content = template.format(
            team=random.choice(["Lakers", "Real Madrid", "Yankees"]),
            movie=random.choice(["Oppenheimer", "Dune", "Inception"]),
            artist=random.choice(["Taylor Swift", "Drake", "Beyoncé"]),
            show=random.choice(["Stranger Things", "The Office", "Breaking Bad"]),
            price=random.randint(30, 100),
            asset=random.choice(["ETFs", "gold", "real estate"]),
            gadget=random.choice(["iPhone 16", "PS5 Pro", "M3 MacBook"]),
            food=random.choice(["sushi", "tacos", "pizza"]),
            country=random.choice(["Japan", "Italy", "Mexico"]),
            book=random.choice(["Atomic Habits", "Sapiens", "1984"]),
            skill=random.choice(["Python", "Spanish", "guitar"]),
            place=random.choice(["Paris", "Tokyo", "Bali"]),
            city=random.choice(["Barcelona", "New York", "Kyoto"]),
            player=random.choice(["LeBron", "Messi", "Mahomes"]),
            hashtag=random.choice(["NFL", "NBA", "Crypto", "AI", "Travel", "Movies"])
        )

        # Add emojis
        if random.random() > 0.4:
            emojis = ["🚀", "🔥", "🤯", "😂", "☕", "🌟", "✈️", "📈", "⚽", "🎉"]
            content += " " + " ".join(random.sample(emojis, k=random.randint(1, 3)))

        # Add mentions sometimes
        if random.random() > 0.6 and tweet_type in ["reply", "combined"]:
            possible_mentions = random.sample(list(usernames - {user["username"]}), k=min(2, len(usernames)-1))
            for m in possible_mentions[:random.randint(1, 2)]:
                content = "@" + m + " " + content

        hashtags = extract_hashtags(content)
        mentions = extract_mentions(content, usernames)

        media = []
        if tweet_type in ["media", "combined"]:
            num_media = random.randint(1, 3)  # Increased max to 3 for more media
            for _ in range(num_media):
                media_type = random.choice(["IMAGE", "VIDEO", "GIF"])
                if media_type == "IMAGE":
                    url = random.choice(IMAGE_URLS)
                    media.append({
                        "url": url,
                        "type": "IMAGE",
                        "width": random.randint(800, 1920),
                        "height": random.randint(600, 1080),
                        "altText": fake.sentence(nb_words=6)
                    })
                elif media_type == "VIDEO":
                    url = random.choice(VIDEO_URLS)
                    media.append({
                        "url": url,
                        "type": "VIDEO",
                        "altText": fake.sentence(nb_words=6)
                    })
                elif media_type == "GIF":
                    url = random.choice(GIF_URLS)
                    media.append({
                        "url": url,
                        "type": "GIF",
                        "altText": fake.sentence(nb_words=6)
                    })

        reply_to = None
        quoted = None

        if tweet_type == "reply" and reply_candidates:
            reply_to = random.choice(reply_candidates)
        elif tweet_type == "quote" and len(tweets) > 10:
            quoted = random.choice(range(max(0, i-200), i))

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

        # Collect for replies and popularity
        reply_candidates.append(i)
        if random.random() < 0.1:  # 10% chance to be "popular"
            popular_tweet_indices.extend([i] * random.randint(3, 10))

    return tweets, popular_tweet_indices

def generate_retweets(tweets, popular_indices, n_range=(500, 1000)):
    retweets = []
    n = random.randint(*n_range)
    users_count = 1000

    for _ in range(n):
        tweet_idx = random.choice(popular_indices) if popular_indices else random.randint(0, len(tweets)-1)
        tweet = tweets[tweet_idx]
        user_idx = random.randint(0, users_count-1)
        while user_idx == tweet["userIndex"]:
            user_idx = random.randint(0, users_count-1)
        
        # Retweet time slightly after original
        orig_time = datetime.fromisoformat(tweet["createdAt"][:-1])
        delta = timedelta(minutes=random.randint(1, 1440))
        retweet_time = (orig_time + delta).isoformat() + "Z"

        retweets.append({
            "userIndex": user_idx,
            "tweetIndex": tweet_idx,
            "createdAt": retweet_time
        })

    return retweets

# Generate everything
print("Generating users...")
users = generate_users(1100)

print("Generating tweets...")
tweets, popular_indices = generate_tweets(users, 5100)

print("Generating retweets...")
retweets = generate_retweets(tweets, popular_indices, (750, 750))  # Fixed 750 for consistency

data = {
    "users": users,
    "tweets": tweets,
    "retweets": retweets
}

print("Writing to file...")
with open("seed-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Done! Generated seed-data.json with  users,  tweets (with more media: images, videos, GIFs), and 750 retweets.")