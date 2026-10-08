export interface Scenario {
  id: string;
  label: string;
  emoji: string;
  /** Situation given to the teacher persona. */
  setup: string;
  /** Opening line used in mock mode (and as a fallback). */
  opener: string;
  /** Scenario-specific follow-up questions used in mock mode. */
  questions: string[];
}

export const SCENARIOS: Scenario[] = [
  { id: "casual", label: "Casual conversation", emoji: "☕", setup: "A relaxed chat between two friendly people.", opener: "Hi! How was your day so far?", questions: ["What do you usually do after work or school?", "Do you have any plans for the weekend?", "What kind of music do you like?", "Tell me about a nice thing that happened this week."] },
  { id: "travel", label: "Travel", emoji: "✈️", setup: "Talking about trips, countries and travel plans.", opener: "I love travelling! Where did you go on your last trip?", questions: ["What was the best part of the trip?", "Do you prefer the beach or the mountains?", "Where would you like to go next?", "What do you always take in your suitcase?"] },
  { id: "airport", label: "Airport", emoji: "🛫", setup: "The learner is a traveller at an airport check-in desk; the AI is the airline agent.", opener: "Good morning! Welcome to the check-in desk. Where are you flying to today?", questions: ["Do you have any luggage to check in?", "Would you like a window seat or an aisle seat?", "Can I see your passport, please?", "Your gate is number twelve. Do you need anything else?"] },
  { id: "hotel", label: "Hotel", emoji: "🏨", setup: "The learner is a guest at a hotel reception; the AI is the receptionist.", opener: "Good evening, and welcome to the Grand Hotel. Do you have a reservation?", questions: ["How many nights will you be staying?", "Would you like breakfast included?", "Is there anything you need in your room?", "What time would you like a wake-up call?"] },
  { id: "restaurant", label: "Restaurant", emoji: "🍽️", setup: "The learner is a customer in a restaurant; the AI is the waiter.", opener: "Hello! Welcome to our restaurant. Do you have a table booked, or just you today?", questions: ["Are you ready to order, or do you need a few more minutes?", "Would you like something to drink first?", "How would you like your steak cooked?", "Would you like to see the dessert menu?"] },
  { id: "shopping", label: "Shopping", emoji: "🛍️", setup: "The learner is shopping for clothes; the AI is a shop assistant.", opener: "Hi there! Can I help you find something today?", questions: ["What size are you looking for?", "Would you like to try it on?", "Do you prefer this colour or the blue one?", "Will you pay by cash or by card?"] },
  { id: "job-interview", label: "Job interview", emoji: "💼", setup: "A job interview; the AI is the interviewer and the learner is the candidate.", opener: "Good morning, and thank you for coming. Could you start by telling me a little about yourself?", questions: ["What are your main strengths?", "Why do you want to work for our company?", "Can you describe a difficult situation at work and how you solved it?", "Where do you see yourself in five years?"] },
  { id: "work", label: "Work", emoji: "🧑‍💻", setup: "Chatting with a colleague about work, projects and meetings.", opener: "Hey! How's your week going at work so far?", questions: ["What are you working on at the moment?", "How do you usually organise your day?", "Do you prefer working alone or in a team?", "What is the hardest part of your job?"] },
  { id: "university", label: "University", emoji: "🎓", setup: "Two students chatting about their studies on campus.", opener: "Hi! Are you new on campus? What are you studying?", questions: ["Which classes do you like the most?", "How do you prepare for exams?", "Do you live on campus or off campus?", "What do you want to do after graduation?"] },
  { id: "meeting-people", label: "Meeting people", emoji: "🤝", setup: "Meeting someone for the first time at a social event.", opener: "Hi, I don't think we've met. I'm Alex. What's your name?", questions: ["Where are you from originally?", "What do you do for a living?", "What do you like doing in your free time?", "How do you know the host of the party?"] },
  { id: "dating", label: "Dating", emoji: "💕", setup: "A friendly first date at a café; keep it light and respectful.", opener: "I'm glad we could meet! Have you been to this café before?", questions: ["What do you enjoy doing on weekends?", "What's your favourite film or series right now?", "Are you more of a morning person or a night owl?", "What's the best trip you've ever taken?"] },
  { id: "australia", label: "Australia", emoji: "🦘", setup: "Preparing for or living a working-holiday in Australia (renting, jobs, travel, local slang).", opener: "G'day! So you're thinking about Australia. What would you like to do there?", questions: ["Have you looked for a place to stay yet?", "Would you like to work on a farm or in a café?", "Which city would you like to see first, Sydney or Melbourne?", "Do you know any Australian slang yet?"] },
  { id: "sports", label: "Sports", emoji: "⚽", setup: "Chatting about sports, teams and exercise.", opener: "Do you follow any sports? I'd love to hear what you like.", questions: ["Do you play any sport yourself?", "Who is your favourite team or athlete?", "What was the last match you watched?", "How often do you exercise?"] },
  { id: "movies", label: "Movies", emoji: "🎬", setup: "Talking about films, series and actors.", opener: "I watched a great film last night. Have you seen any good movies lately?", questions: ["What kind of films do you enjoy most?", "Who is your favourite actor?", "Do you prefer the cinema or watching at home?", "Can you tell me the story of a film you love?"] },
  { id: "technology", label: "Technology", emoji: "💻", setup: "Discussing gadgets, apps and the role of technology in daily life.", opener: "Technology is everywhere these days. What apps do you use the most?", questions: ["How much time do you spend on your phone every day?", "Do you think AI will change your job?", "What gadget could you not live without?", "Do you worry about privacy online?"] },
  { id: "daily-life", label: "Daily life", emoji: "🏠", setup: "Talking about everyday routines, home and neighbourhood.", opener: "Let's talk about everyday life! What does a normal day look like for you?", questions: ["What time do you usually wake up?", "What do you like to cook at home?", "Tell me about your neighbourhood.", "What do you do to relax in the evening?"] },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);

export const randomScenario = () => SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
