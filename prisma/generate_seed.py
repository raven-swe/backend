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

# Real profile picture URLs (Unsplash/Pexels)
PROFILE_PIC_URLS = [
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
] * 5

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
] * 10

# Real GIF URLs
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
] * 20

# Sample content templates per category (Expanded and Longer)
CONTENT_TEMPLATES = {
    "Sports": [
        "What a game! {team} absolutely crushed it tonight. The energy in the stadium was unreal, and that final play will go down in history. 🔥 #Sports #{hashtag}",
        "I still can't believe that last-minute goal! ⚽ outcomes like this are why I love this sport. The defense completely fell apart. #Sports",
        "Training hard for the weekend match. Pushing limits every single day to be better than yesterday. 💪 It's not just about winning, it's about the grind. #Fitness #Sports",
        "{player} is on fire this season! Averaging career highs across the board. MVP conversation needs to start right now. #NBA #Sports",
        "The officiating in the {team} game was questionable at best. We need better standards if the league wants to be taken seriously. 😤 #SportsTalk",
        "Just bought tickets for the finals! It's going to be a long trip but totally worth it to see {team} play live. Who else is going? 🎫 #SportsTravel",
        "{player} is a very underrated striker! 👕 {games} games ⚽️ {goals} goals 🎯 {assists} assists 🏆 {trophies} trophies 👑 African Footballer of the Year ⭐ Arsenal Player of the Season 👟 Premier League Golden Boot 👟 Europa League Top Scorer ⭐ Europa League Player of the Season ⭐ Bundesliga Player of the Year 👟 Bundesliga Top Scorer ⭐ Dortmund Player of the Season Unique. ❤️ #Sports",
        "{player}’s career stats are a joke! 😮‍💨 👕 {games} games ⚽️ {goals} goals 🎯 {assists} assists 🏆 {trophies} trophies ⭐️ {awards} Ballon d’Ors The greatest player of all time! 🐐 #Sports",
        "{player}’s career stats: 👕 {games} games ⚽️ {goals} goals 🎯 {assists} assists 🏆 European champion 🏆 {leagues} La Liga 🏆 Copa del Rey 🏆 Supercopa ⭐️ Golden Boy ⭐️ {awards} Kopa Trophy ⭐️ Euro Young Player of the Tournament ⭐️ Euro Goal of the Tournament 🥇 La Liga U23 Player of the Season 🥇 {awards} La Liga Goal of the Month winner 🌟 Euro Top Assist Provider 🌟 Euro Team of the Tournament ⭐️ Laureus World Sports Award for Breakthrough of the Year ☑️ The Best FIFA Men’s XI ({year}) ☑️ FIFPRO World XI ({year}) Generational talent! 🔥 #Sports",
        "Allowing intentional fouling up 3 at the end of an {league} game is the worst thing to ever happen to this sport. Takes all the excitement out of the end of the game. What a joke. #Sports",
        "{player}’s career is absolutely unbelievable! 🤯 ⚽️ {goals} goals 🎯 {assists} assists 🤝 {contributions} G/A in {games} games 🏆 {trophies} trophies 🥇 European Golden Boot ⭐ UEFA Best Player 🐐 Gerd Muller Trophy 🏅 {awards} Player of the Year awards ⭐️ {awards} Top Scorer (all comps.) The best striker in the world! ❤️ #Sports"
    ],
    "Entertainment": [
        "Just watched {movie} and I am mind blown 🤯. The cinematography, the score, the acting—everything was perfection. Highly recommend if you haven't seen it yet! #Movies",
        "New album from {artist} dropped and it's pure gold on repeat 🎶. Every track tells a story. 'Midnight Rain' might be my favorite so far. #{hashtag}",
        "Binge-watching {show} all weekend. I told myself I'd watch one episode, and here I am at 3 AM. No regrets though! 😂 #TV",
        "The season finale of {show} left me speechless. I have so many theories about what happens next season. Let's discuss! 👇 #Spoilers",
        "Concert tickets for {artist} sold out in seconds? This system is rigged. I just wanted to see them live once! 😭 #MusicLover",
        "Huge congratulations to our {artist}, {name}, for a powerful and heartfelt fan meet concert — {event}! 🌟 Here’s to more dreams, more stages, and more unforgettable memories ahead. 💙✨ #Entertainment",
        "A night of music, magic, and destiny ✨ Congratulations to our very own {artist}, {name}, for a successful fan meet concert {event} at the {venue}! Here’s to more milestones, more dreams, and more moments shared with your fans. #Entertainment",
        "The final night of {artist} \"{event}\", where every moment we shared still glows. ✨🎞️ #{hashtag} {event} - Final Radiant Night #Entertainment",
        "'{event}' THE MOVIE SCREENX Poster <Global> 🎬 SCREENX Screenings: {date} 🔎 Find tickets at {url} *Release dates and special format screenings may vary by region, so please check the official website #Entertainment",
        "Nah. The thing that broke my heart in this documentary is how {person} refused to pay some people who did work for him ({person} spent {time} producing {album} and wasn’t paid a dime). How he forced {person} to sign over {percentage}% of {company} and how he kept everyone around him needy and desperate. 😭 How can you be a billionaire, living in opulence and your artistes and friends are in lack and want? It is a sick kind of power play - not wanting people around you comfortable - so they can worship you like their god. But even gods show mercy. {person} showed no mercy. 🥹 #Entertainment"
    ],
    "Finance": [
        "Bitcoin just hit ${price}k! The momentum is undeniable right now. Is this the start of the next massive bull run or a trap? 🚀 #Crypto #Finance",
        "Market volatility is crazy right now. One minute we're up, the next we're down. Holding steady and trusting the long-term strategy. 📉📈 #Stocks #Finance",
        "Diversifying my portfolio with {asset}. It's a hedge against inflation and a solid long-term play. What are your thoughts on this sector? #Investing",
        "Just finished analyzing the Q3 reports for tech sector. Some surprising numbers that the market hasn't priced in yet. 📊 #Economy",
        "Financial freedom isn't about being rich, it's about having options. Started my journey today with a new savings plan. 💰 #PersonalFinance",
        "{product} Official {asset} Airdrop Our momentum is undeniable. We’re moving forward to deliver value to every {asset} holder — both current and future. 🔗 {url} Empowering the future of decentralized finance — together. #Bitcoin #Crypto #Finance",
        "love you guys. i haven’t met most of you, but the only reason i get to make crazy {asset} videos is because of all your support. i am eternally grateful to have you all here. #Finance",
        "Financial freedom begins with a single, powerful step: knowing your numbers. Income - Liabilities - Net Profit. See it all, clearly and accurately, with our smart accounting tables and graphs. Clarity and control is the first step to wealth. #BusinessTips #Finance #Investing",
        "Historically, this is the point where capital rotates from {asset1} into {asset2}. #Finance",
        "Introducing {product}, the first prediction market at the intersection of sports, finance, politics and culture. Live in {number} states — and we are just getting started. Pick a side. #Finance"
    ],
    "Politics": [
        "Important election coming up. The stakes have never been higher. Make sure to do your research and vote! Your voice matters. 🗳️ #Politics",
        "New policy announcement today regarding infrastructure. While the goals are good, I'm concerned about the execution timeline. What do you think? #News",
        "Debates are heating up. It's interesting to see how the narrative shifts depending on which network you watch. 📺 #CurrentEvents",
        "Local council meeting lasted 5 hours yesterday. Democracy is exhausted but necessary work. 🏛️ #LocalPolitics",
        "\"The {strategy} strategy was great going up to the election and a terrible one the day after\" #Politics",
        "Breaking News: {person}, a socialist newcomer, will be {city}’s next mayor after the incumbent, {incumbent}, conceded. #Politics",
        "Liberals do not know the basics of policy, let alone political nuances. Here, for example, is hate and rage politics at its finest—fueled by the gaslighting media. #Politics",
        "Before the {year} election {person} repeatedly said that you're not supposed to cast doubt on the legitimacy of an election. Right after the election {person} launched the {hoax} hoax to cast doubt on the legitimacy of the election. Perhaps the biggest scandal ever in American politics. #Politics",
        "Breaking News: {state} voters agreed to aggressively redraw the state’s congressional district lines to wipe out as many as {number} Republican seats, according to The Associated Press, delivering a major victory for national Democrats. #Politics"
    ],
    "Tech": [
        "Just got my hands on the new {gadget}! The build quality is insane, and the battery life is finally what we've been asking for. 🚀 #Tech",
        "AI is changing everything faster than we expected. From coding to art, the landscape is shifting daily. Excited (and a bit scared) for the future 🤖 #AI #Tech",
        "Coding all night on a new project. Finally fixed that bug that's been haunting me for days. The relief is real. 👨‍💻 #Programming #Tech",
        "The new update for VS Code is a game changer. The productivity boost nicely offsets the learning curve. Highly recommend trying the new features. 💻 #DevLife",
        "Is it just me or is {gadget} overrated? I've been using it for a week and I'm not seeing the hype. Let me know your experience. 📱 #TechReview",
        "\"{book}\" A MUST while starting {field}. Absolutely Beginner friendly. To get: - 1. Follow (So I can DM you ) 2. Like & retweet 3. Reply \" Send \" #Tech",
        "Our Top {number} Tech Stocks to Own in the {revolution} Revolution 🏆🐂🔥🍿👇 #Tech",
        "{city} offering the perfect playground for our Physical {tech} 👌 #Tech",
        "🚀 Launching {model}-V{version} & {model}-V{version}-Speciale — Reasoning-first models built for agents! 🔹 {model}-V{version}: Official successor to V{version}-Exp. Now live on App, Web & API. 🔹 {model}-V{version}-Speciale: Pushing the boundaries of reasoning capabilities. API-only for now. 📄 Tech report: {url} #Tech",
        "I’ve been seriously pondering this {brand} Tech to {item} trend, and listen… If we can get more of these young dudes started into {field} and {field}, with some tech certs and {app} accounts, dawg… This could positively shift trajectories, at-scale. #Tech"
    ],
    "Culture": [
        "Visited this amazing museum today. The exhibit on ancient civilizations was breathtaking. It puts so much of our modern life into perspective. 🎨 #Culture #Art",
        "Trying out {food} from {country} for the first time — absolute flavor explosion! 🍲 The spices are unlike anything I've verified before. #Foodie",
        "Attended a local festival celebrating heritage and tradition. The music, the dance, the clothes—so vibrant and alive. ❤️ #Community",
        "Reading about the history of {city} before my trip. It's fascinating how much the architecture tells the story of its past. 🏰 #History",
        "{artist} VARIETY SHOW TRAVELING AROUND {country} WITH ALL THE {nationality} FAMOUS CELEB AND EXPERIENCE DIFFERENT CULTURE, FOOD, PEOPLE & NATURE. COMING SOON #Culture",
        "A lesson from history! Each {region} country have/had their own culture! #Culture",
        "I really want to enjoy life next year, no more survival mode. Travel, explore, visit new places, try new food, new culture, hit new milestone. #Culture",
        "Looking for a warm spot in {city} this winter? ☃️ Three FREE museums offer quiet escapes: {museum1} traces a century of rail history; {museum2} preserves early mail and telegraph heritage; {museum3} presents treasures across millennia. #Culture",
        "So he just so happens to NOT know a damn thing about {group} history ..but was unmoving in his opinion of us having no culture.. {person} is another clout chasing lying {label} 🗑️ #Culture"
    ],
    "General": [
        "Good morning everyone! ☀️ The sun is shining, coffee is brewing, and it feels like it's going to be a productive day. Hope you all have a great one!",
        "Coffee is life ☕. I literally cannot function without my morning brew. Currently trying a dark roast from Ethiopia. What's your go-to?",
        "Weekend vibes 😎. Finally some time to relax, recharge, and maybe catch up on some reading. No emails allowed until Monday!",
        "Sometimes you just need to disconnect and take a walk in nature. The fresh air does wonders for the mind. 🌲 #MentalHealth",
        "Does anyone else feel like this year is flying by? It's already December! Time needs to slow down. ⏳",
        "⚡️{country1}{country2}JUST IN: {person}, the leading {party} candidate for {city} City mayor: \"If {person} comes to deliver a speech at the United Nations General Assembly in {city} next year while I am mayor, I will move to honor the ICC arrest warrant issued in {place} against him - just as I would against {person}. He is responsible for the genocide in {place}. A {nationality} told me that {number} members of his family were killed in {place}... I must respond to the requests of the city's residents.\" #General",
        "🚨 The immigrants were using taxpayer money to purchase homes. We don't need {number}-year mortgages. We need {number} million deportations. #General",
        "{player} on the highs and lows of the {league}: “Last year we won the championship. Duckboats, champagne… this year we gotta listen to insufferable {team} fans. I don’t know how we lost in general…” 😭😭😭 #General",
        "{age}-year-old {war} vet: “What we fought for was our freedom, even now [the country] is worse than it was when I fought for it.” “We defeated the wrong enemy” — {person} #General",
        "Shame dressed me in {clothing} this morning. #General"
    ],
    "Learning": [
        "Just finished reading {book}. It challenged so many of my assumptions. Highly recommend to anyone looking to broaden their perspective! 📚 #Learning",
        "Learning {skill} on YouTube today. It's amazing how much free education is available if you just look for it. 👨‍🎓 #SelfImprovement",
        "struggling with this new concept in my course, but I'm not giving up. Persistence is key! 🔑 #StudyGram",
        "Attended a workshop on leadership today. Best takeaway: 'Listen more than you speak'. Simple but powerful. 🧠 #Growth",
        "If you’re serious about understanding {field} models - not just running them - mastering the math is non-negotiable. This book gives you that mastery: it builds the mental model of how learning actually happens - from vector spaces and eigenvalues to gradients, loss landscapes, and uncertainty - with Python implementations at every step. It’s the fastest path from “black box” to “I can explain, debug, and improve this.” What you’ll learn (and actually apply): 🔹Linear Algebra that powers {field}: vectors, norms & inner products, eigenvalues/eigenvectors, LU/QR/SVD factorizations, matrices ↔ graphs → the backbone of PCA, embeddings, attention, and graph methods. 🔹Calculus for learning dynamics: limits/continuity, differentiation & integration, numerical methods → why gradient descent works, how backprop computes updates, and what your loss landscape looks like. 🔹Multivariable optimization: partials, Jacobians, Hessians, total derivatives, high-dimensional geometry → diagnosing plateaus, curvature-aware intuition, and safer optimization choices. 🔹Probability & information theory: random variables, common distributions, expectation/variance, Bayes’ theorem, LLN, entropy & MLE → modeling uncertainty, likelihood-based training, and data-driven reasoning. 🔹Hands-on code, not just theory: every concept tied to practical Python so you can implement gradient descent, decompositions, and probabilistic modeling—not just read about them. Bottom line: {book} is a blueprint for moving from cargo-cult {field} to engineer-level understanding—the kind that lets you read papers, reproduce results, pick the right tools, and ship reliable systems. Thanks to {publisher} and {author} for making high-level math genuinely usable for {field} engineers. #Learning",
        "The Golden Rule when you're learning a new skill‼️👇 #Learning",
        "Learning how to learn is the most important skill to acquire. #Learning",
        "This is literally the only book you need to master {field} from scratch #Learning",
        "Learning to be emotionally open #Learning"
    ],
    "Travel": [
        "Just booked tickets to {place}! It's been on my bucket list for years. Can't wait to explore the streets and eat all the food ✈️ #Travel",
        "Sunset views like this make everything worth it. The colors in the sky are unreal. Grateful for these moments. 🌅 #Travel",
        "Exploring hidden gems in {city}. Found this cute little cafe tucked away in an alley. These accidental discoveries are the best part of traveling. 🗺️",
        "Packing light is an art form I have yet to master. Somehow my suitcase is already full and I haven't even packed shoes yet. 🧳 #Travelstruggles",
        "Sunset state of mind 🍹🌴🌞🌊 #Travel",
        "{person} here, exploring the world’s Hidden Vacation Gems 💎 Today I’m in {place} at the beautiful {hotel}. My longtime travel agent {name} turned me onto this place which is awesome. Two thumbs up. Check out the video then come check out this place, and my travel agent {name} will hook you up with all the {person} perks! Just tell her {person} sent you! #Travel",
        "Exploring medieval villages in {country} 💫 #Travel",
        "{gender} tries to travel without tickets in First class AC and then uses Caste slurs against the TTE #Travel",
        "i love having a big {gender} job where i get big {gender} money so i can buy silly tickets for silly tours to see my favs be silly on stage with my silly friends and travel to silly cities #Travel"
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
        
        # Add profile picture
        avatar_url = None
        if random.random() > 0.1: # 90% chance of having a profile pic
             avatar_url = random.choice(PROFILE_PIC_URLS)

        user = {
            "username": username,
            "email": fake.email(),
            "displayName": fake.name(),
            "bio": fake.sentence(nb_words=10, ext_word_list=None)[:160] if random.random() > 0.3 else "",
            "birthdate": fake.date_between(start_date='-55y', end_date='-20y').strftime('%Y-%m-%d'),
            "interests": random.sample(INTERESTS, k=random.randint(1, 4)),
            "location": f"{fake.city()}, {fake.country()}" if random.random() > 0.4 else "",
            "avatarUrl": avatar_url
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

        # Generate completely random weights for this specific tweet generation
        # This ensures "Total Probability of generation thing totatlly random not from a template" (interpreted as dynamic probabilities)
        w1 = random.randint(10, 50)
        w2 = random.randint(10, 50)
        w3 = random.randint(5, 20)
        w4 = random.randint(5, 15)
        w5 = random.randint(1, 10)
        
        tweet_type = random.choices(
            ["regular", "media", "reply", "quote", "combined"],
            weights=[w1, w2, w3, w4, w5], k=1)[0]

        template = random.choice(CONTENT_TEMPLATES.get(category, CONTENT_TEMPLATES["General"]))
        
        # Prepare format kwargs with all possible placeholders
        format_kwargs = {
            "team": random.choice(["Lakers", "Real Madrid", "Yankees", "Manchester City", "Ferrari"]),
            "movie": random.choice(["Oppenheimer", "Dune", "Inception", "Barbie", "The Batman"]),
            "artist": random.choice(["Taylor Swift", "Drake", "Beyoncé", "The Weeknd", "Kendrick Lamar"]),
            "show": random.choice(["Stranger Things", "The Office", "Breaking Bad", "Succession", "The Bear"]),
            "price": random.randint(30, 90),
            "asset": random.choice(["ETFs", "gold", "real estate", "tech stocks"]),
            "gadget": random.choice(["iPhone 16", "PS5 Pro", "M3 MacBook", "Vision Pro"]),
            "food": random.choice(["sushi", "tacos", "pizza", "ramen", "curry"]),
            "country": random.choice(["Japan", "Italy", "Mexico", "Thailand", "France"]),
            "book": random.choice(["Atomic Habits", "Sapiens", "1984", "The Alchemist"]),
            "skill": random.choice(["Python", "Spanish", "guitar", "cooking", "investing"]),
            "place": random.choice(["Paris", "Tokyo", "Bali", "New York", "London"]),
            "city": random.choice(["Barcelona", "New York", "Kyoto", "Rome", "Berlin"]),
            "player": random.choice(["LeBron", "Messi", "Mahomes", "Curry", "Haaland"]),
            "hashtag": random.choice(["NFL", "NBA", "Crypto", "AI", "Travel", "Movies", "Trending"]),
            # Numbered variants
            "asset1": random.choice(["stocks", "bonds", "crypto", "real estate"]),
            "asset2": random.choice(["gold", "ETFs", "commodities", "tech stocks"]),
            "museum1": random.choice(["Railway Museum", "Transport Museum", "City Museum"]),
            "museum2": random.choice(["Postal Museum", "Telegraph Museum", "Communication Museum"]),
            "museum3": random.choice(["National Museum", "History Museum", "Art Gallery"]),
            "country1": random.choice(["🇺🇸", "🇬🇧", "🇫🇷", "🇩🇪", "🇯🇵"]),
            "country2": random.choice(["🇨🇦", "🇦🇺", "🇪🇸", "🇮🇹", "🇧🇷"]),
            # Additional placeholders
            "person": fake.name(),
            "party": random.choice(["Democratic", "Republican", "Independent", "Progressive"]),
            "nationality": random.choice(["American", "European", "Asian", "African"]),
            "number": random.randint(10, 100),
            "field": random.choice(["technology", "medicine", "education", "business", "science"]),
            "age": random.randint(25, 65),
            "album": random.choice(["Midnights", "Renaissance", "The Highlights", "After Hours"]),
            "app": random.choice(["TikTok", "Instagram", "Twitter", "Discord", "Threads"]),
            "assists": random.randint(5, 15),
            "author": fake.name(),
            "awards": random.randint(1, 10),
            "brand": random.choice(["Apple", "Nike", "Adidas", "Samsung", "Sony"]),
            "clothing": random.choice(["sneakers", "hoodie", "jacket", "jeans", "dress"]),
            "company": random.choice(["Google", "Meta", "Amazon", "Microsoft", "Tesla"]),
            "contributions": random.randint(50, 500),
            "date": fake.date(),
            "event": random.choice(["Olympics", "World Cup", "Super Bowl", "Grammy Awards"]),
            "gender": random.choice(["male", "female", "non-binary"]),
            "goals": random.randint(1, 5),
            "group": random.choice(["BTS", "Blackpink", "Coldplay", "Imagine Dragons"]),
            "hoax": random.choice(["misinformation", "fake news", "conspiracy theory"]),
            "hotel": fake.company() + " Hotel",
            "incumbent": fake.name(),
            "item": random.choice(["laptop", "phone", "tablet", "watch", "camera"]),
            "label": random.choice(["Republic", "Columbia", "Atlantic", "Universal"]),
            "league": random.choice(["NBA", "NFL", "Premier League", "La Liga", "MLB"]),
            "leagues": random.choice(["NBA & NFL", "UEFA & FIFA", "MLB & NHL"]),
            "model": random.choice(["Pro Max", "Ultra", "Plus", "Premium"]),
            "name": fake.name(),
            "percentage": random.randint(10, 95),
            "product": random.choice(["MacBook", "Surface", "Galaxy", "Pixel"]),
            "publisher": random.choice(["Penguin", "HarperCollins", "Simon & Schuster"]),
            "region": random.choice(["Asia", "Europe", "Americas", "Africa", "Oceania"]),
            "revolution": random.choice(["AI", "blockchain", "quantum", "biotech"]),
            "state": random.choice(["California", "Texas", "New York", "Florida"]),
            "strategy": random.choice(["value investing", "growth stocks", "index funds"]),
            "tech": random.choice(["AI", "blockchain", "cloud computing", "5G", "IoT"]),
            "time": random.choice(["morning", "afternoon", "evening", "night"]),
            "trophies": random.randint(1, 10),
            "url": "example.com",
            "venue": random.choice(["Madison Square Garden", "O2 Arena", "Staples Center"]),
            "version": f"{random.randint(1, 20)}.{random.randint(0, 9)}",
            "war": random.choice(["conflict", "crisis", "situation", "dispute"]),
            "year": random.randint(2020, 2025),
            "games": random.randint(10, 82),
        }
        
        content = template.format(**format_kwargs)

        # Add emojis
        if random.random() > 0.4:
            emojis = ["🚀", "🔥", "🤯", "😂", "☕", "🌟", "✈️", "📈", "⚽", "🎉", "😱", "🧐"]
            content += " " + " ".join(random.sample(emojis, k=random.randint(1, 3)))

        # Add mentions sometimes
        if random.random() > 0.8 and tweet_type in ["reply", "combined"]:
            possible_mentions = random.sample(list(usernames - {user["username"]}), k=min(2, len(usernames)-1))
            for m in possible_mentions[:random.randint(1, 2)]:
                content = "@" + m + " " + content

        hashtags = extract_hashtags(content)
        mentions = extract_mentions(content, usernames)

        media = []
        if tweet_type in ["media", "combined"]:
            num_media = random.randint(1, 4) if random.random() > 0.8 else random.randint(1, 2)
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
        if random.random() < 0.15:  # 15% chance to be "popular"
            popular_tweet_indices.extend([i] * random.randint(3, 10))

    return tweets, popular_tweet_indices

def generate_retweets(tweets, popular_indices, n_range=(500, 1000)):
    retweets = []
    n = random.randint(*n_range)
    users_count = 1000  # Assuming 1000 users approx

    for _ in range(n):
        tweet_idx = random.choice(popular_indices) if popular_indices else random.randint(0, len(tweets)-1)
        tweet = tweets[tweet_idx]
        user_idx = random.randint(0, users_count-1)
        while user_idx == tweet["userIndex"]:
             user_idx = random.randint(0, users_count-1)
        
        orig_time = datetime.fromisoformat(tweet["createdAt"][:-1])
        delta = timedelta(minutes=random.randint(1, 1440))
        retweet_time = (orig_time + delta).isoformat() + "Z"

        retweets.append({
            "userIndex": user_idx,
            "tweetIndex": tweet_idx,
            "createdAt": retweet_time
        })

    return retweets

def generate_likes(users, tweets, n_range=(3000, 5000)):
    likes = []
    n = random.randint(*n_range)
    
    # Store used pairs to avoid duplicate likes
    used_pairs = set()

    for _ in range(n):
        user_idx = random.randint(0, len(users) - 1)
        tweet_idx = random.randint(0, len(tweets) - 1)
        
        pair = (user_idx, tweet_idx)
        
        # Simple retry logic for uniqueness, max 5 attempts
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
        # Likes happen after the tweet
        delta = timedelta(minutes=random.randint(1, 4000)) 
        like_time = (orig_time + delta).isoformat() + "Z"

        likes.append({
            "userIndex": user_idx,
            "tweetIndex": tweet_idx,
            "createdAt": like_time
        })
    
    return likes

# Generate everything
print("Generating users...")
users = generate_users(1100)

print("Generating tweets...")
tweets, popular_indices = generate_tweets(users, 5100)

print("Generating retweets...")
retweets = generate_retweets(tweets, popular_indices, (750, 750))

print("Generating likes...")
likes = generate_likes(users, tweets, (4000, 6000))

data = {
    "users": users,
    "tweets": tweets,
    "retweets": retweets,
    "likes": likes
}

print("Writing to file...")
with open("seed-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Done! Generated seed-data.json with {len(users)} users, {len(tweets)} tweets, {len(retweets)} retweets, and {len(likes)} likes.")