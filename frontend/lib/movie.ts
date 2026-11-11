export type Movie = {
    id: string;
    title: string;
    description: string;
    longDescription: string;
    backdrop: string;
    poster: string;
    year: number;
    rating: string;
    duration: string;
    genres: string[];
    cast: string[];
    match: number;
    isNew?: boolean;
    isTop10?: boolean;
    videoUrl: string;
};

export type MovieRow = {
    title: string;
    movies: Movie[];
};

const action1 = "https://images.pexels.com/photos/23384428/pexels-photo-23384428.jpeg?auto=compress&cs=tinysrgb&w=1280";
const action2 = "https://images.pexels.com/photos/32891033/pexels-photo-32891033.jpeg?auto=compress&cs=tinysrgb&w=1280";
const action3 = "https://images.pexels.com/photos/11794336/pexels-photo-11794336.jpeg?auto=compress&cs=tinysrgb&w=1280";
const action4 = "https://images.pexels.com/photos/14389542/pexels-photo-14389542.png?auto=compress&cs=tinysrgb&w=1280";
const action5 = "https://images.pexels.com/photos/28833650/pexels-photo-28833650.jpeg?auto=compress&cs=tinysrgb&w=1280";
const action6 = "https://images.pexels.com/photos/32787166/pexels-photo-32787166.png?auto=compress&cs=tinysrgb&w=1280";

const scifi1 = "https://images.pexels.com/photos/18337612/pexels-photo-18337612.jpeg?auto=compress&cs=tinysrgb&w=1280";
const scifi2 = "https://images.pexels.com/photos/11285726/pexels-photo-11285726.jpeg?auto=compress&cs=tinysrgb&w=1280";
const scifi3 = "https://images.pexels.com/photos/18545016/pexels-photo-18545016.jpeg?auto=compress&cs=tinysrgb&w=1280";
const scifi4 = "https://images.pexels.com/photos/17195067/pexels-photo-17195067.jpeg?auto=compress&cs=tinysrgb&w=1280";
const scifi5 = "https://images.pexels.com/photos/18419510/pexels-photo-18419510.jpeg?auto=compress&cs=tinysrgb&w=1280";
const scifi6 = "https://images.pexels.com/photos/8108316/pexels-photo-8108316.jpeg?auto=compress&cs=tinysrgb&w=1280";
const scifi7 = "https://images.pexels.com/photos/30547612/pexels-photo-30547612.jpeg?auto=compress&cs=tinysrgb&w=1280";

const horror1 = "https://images.pexels.com/photos/14648586/pexels-photo-14648586.jpeg?auto=compress&cs=tinysrgb&w=1280";
const horror2 = "https://images.pexels.com/photos/289367/pexels-photo-289367.jpeg?auto=compress&cs=tinysrgb&w=1280";
const horror3 = "https://images.pexels.com/photos/217660/pexels-photo-217660.jpeg?auto=compress&cs=tinysrgb&w=1280";
const horror4 = "https://images.pexels.com/photos/14075068/pexels-photo-14075068.jpeg?auto=compress&cs=tinysrgb&w=1280";
const horror5 = "https://images.pexels.com/photos/9970896/pexels-photo-9970896.jpeg?auto=compress&cs=tinysrgb&w=1280";
const horror6 = "https://images.pexels.com/photos/11516769/pexels-photo-11516769.jpeg?auto=compress&cs=tinysrgb&w=1280";

const romance1 = "https://images.pexels.com/photos/8983546/pexels-photo-8983546.jpeg?auto=compress&cs=tinysrgb&w=1280";
const romance2 = "https://images.pexels.com/photos/5408346/pexels-photo-5408346.jpeg?auto=compress&cs=tinysrgb&w=1280";
const romance3 = "https://images.pexels.com/photos/4636394/pexels-photo-4636394.jpeg?auto=compress&cs=tinysrgb&w=1280";
const romance4 = "https://images.pexels.com/photos/15169949/pexels-photo-15169949.jpeg?auto=compress&cs=tinysrgb&w=1280";
const romance5 = "https://images.pexels.com/photos/12829876/pexels-photo-12829876.jpeg?auto=compress&cs=tinysrgb&w=1280";

const space1 = "https://images.pexels.com/photos/20881655/pexels-photo-20881655.jpeg?auto=compress&cs=tinysrgb&w=1280";
const space2 = "https://images.pexels.com/photos/4233216/pexels-photo-4233216.jpeg?auto=compress&cs=tinysrgb&w=1280";
const space3 = "https://images.pexels.com/photos/8148340/pexels-photo-8148340.jpeg?auto=compress&cs=tinysrgb&w=1280";
const space4 = "https://images.pexels.com/photos/37269550/pexels-photo-37269550.jpeg?auto=compress&cs=tinysrgb&w=1280";
const space5 = "https://images.pexels.com/photos/20525375/pexels-photo-20525375.jpeg?auto=compress&cs=tinysrgb&w=1280";

const crime1 = "https://images.pexels.com/photos/104707/pexels-photo-104707.jpeg?auto=compress&cs=tinysrgb&w=1280";
const crime2 = "https://images.pexels.com/photos/30884889/pexels-photo-30884889.jpeg?auto=compress&cs=tinysrgb&w=1280";
const crime3 = "https://images.pexels.com/photos/32452311/pexels-photo-32452311.jpeg?auto=compress&cs=tinysrgb&w=1280";
const crime4 = "https://images.pexels.com/photos/13413233/pexels-photo-13413233.jpeg?auto=compress&cs=tinysrgb&w=1280";
const crime5 = "https://images.pexels.com/photos/9527430/pexels-photo-9527430.jpeg?auto=compress&cs=tinysrgb&w=1280";

const adventure1 = "https://images.pexels.com/photos/235907/pexels-photo-235907.jpeg?auto=compress&cs=tinysrgb&w=1280";
const adventure2 = "https://images.pexels.com/photos/10189436/pexels-photo-10189436.jpeg?auto=compress&cs=tinysrgb&w=1280";
const adventure3 = "https://images.pexels.com/photos/29277738/pexels-photo-29277738.jpeg?auto=compress&cs=tinysrgb&w=1280";
const adventure4 = "https://images.pexels.com/photos/14888632/pexels-photo-14888632.jpeg?auto=compress&cs=tinysrgb&w=1280";
const adventure5 = "https://images.pexels.com/photos/34960157/pexels-photo-34960157.jpeg?auto=compress&cs=tinysrgb&w=1280";

const fantasy1 = "https://images.pexels.com/photos/10993195/pexels-photo-10993195.jpeg?auto=compress&cs=tinysrgb&w=1280";
const fantasy2 = "https://images.pexels.com/photos/39133786/pexels-photo-39133786.jpeg?auto=compress&cs=tinysrgb&w=1280";
const fantasy3 = "https://images.pexels.com/photos/17892700/pexels-photo-17892700.jpeg?auto=compress&cs=tinysrgb&w=1280";
const fantasy4 = "https://images.pexels.com/photos/36838866/pexels-photo-36838866.jpeg?auto=compress&cs=tinysrgb&w=1280";
const fantasy5 = "https://images.pexels.com/photos/1006107/pexels-photo-1006107.jpeg?auto=compress&cs=tinysrgb&w=1280";

const ocean1 = "https://images.pexels.com/photos/932638/pexels-photo-932638.jpeg?auto=compress&cs=tinysrgb&w=1280";
const ocean2 = "https://images.pexels.com/photos/10106417/pexels-photo-10106417.jpeg?auto=compress&cs=tinysrgb&w=1280";
const ocean3 = "https://images.pexels.com/photos/6206127/pexels-photo-6206127.jpeg?auto=compress&cs=tinysrgb&w=1280";
const ocean4 = "https://images.pexels.com/photos/14707086/pexels-photo-14707086.jpeg?auto=compress&cs=tinysrgb&w=1280";

const desert1 = "https://images.pexels.com/photos/16299830/pexels-photo-16299830.jpeg?auto=compress&cs=tinysrgb&w=1280";
const desert2 = "https://images.pexels.com/photos/34760846/pexels-photo-34760846.jpeg?auto=compress&cs=tinysrgb&w=1280";
const desert3 = "https://images.pexels.com/photos/39260641/pexels-photo-39260641.jpeg?auto=compress&cs=tinysrgb&w=1280";
const desert4 = "https://images.pexels.com/photos/16656318/pexels-photo-16656318.jpeg?auto=compress&cs=tinysrgb&w=1280";

const war1 = "https://images.pexels.com/photos/163490/war-desert-guns-gunshow-163490.jpeg?auto=compress&cs=tinysrgb&w=1280";
const war2 = "https://images.pexels.com/photos/33610550/pexels-photo-33610550.jpeg?auto=compress&cs=tinysrgb&w=1280";
const war3 = "https://images.pexels.com/photos/36452131/pexels-photo-36452131.jpeg?auto=compress&cs=tinysrgb&w=1280";
const war4 = "https://images.pexels.com/photos/11389636/pexels-photo-11389636.jpeg?auto=compress&cs=tinysrgb&w=1280";

const portrait1 = "https://images.pexels.com/photos/30217126/pexels-photo-30217126.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait2 = "https://images.pexels.com/photos/29263907/pexels-photo-29263907.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait3 = "https://images.pexels.com/photos/24286060/pexels-photo-24286060.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait4 = "https://images.pexels.com/photos/31705626/pexels-photo-31705626.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait5 = "https://images.pexels.com/photos/13932608/pexels-photo-13932608.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait6 = "https://images.pexels.com/photos/7991307/pexels-photo-7991307.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait7 = "https://images.pexels.com/photos/35964819/pexels-photo-35964819.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait8 = "https://images.pexels.com/photos/27132413/pexels-photo-27132413.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait9 = "https://images.pexels.com/photos/6209628/pexels-photo-6209628.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait10 = "https://images.pexels.com/photos/24986830/pexels-photo-24986830.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait11 = "https://images.pexels.com/photos/5436285/pexels-photo-5436285.jpeg?auto=compress&cs=tinysrgb&w=600";
const portrait12 = "https://images.pexels.com/photos/34742154/pexels-photo-34742154.jpeg?auto=compress&cs=tinysrgb&w=600";

const V1 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const V2 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
const V3 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
const V4 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4";
const V5 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4";
const V6 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";
const V7 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4";
const V8 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4";
const V9 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4";
const V10 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4";
const V11 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4";
const V12 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4";
const V13 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4";

export const featuredMovie: Movie = {
    id: "f1",
    title: "Shadow Protocol",
    description: "When a covert operation goes dark, one elite soldier must break every rule to uncover the conspiracy that betrayed her team.",
    longDescription: "In the aftermath of a failed mission in Eastern Europe, Captain Sarah Vance discovers that her team was set up by someone inside the agency. Hunted by both enemies and allies, she must navigate a web of lies, betrayal, and hidden agendas to expose the truth before it's buried forever. A pulse-pounding thriller that redefines the action genre.",
    backdrop: action1,
    poster: portrait1,
    year: 2025,
    rating: "TV-MA",
    duration: "2h 18m",
    genres: ["Action", "Thriller", "Spy"],
    cast: ["Eva Mendez", "Marcus Cole", "Lena Vossberg", "James Okoro"],
    match: 98,
    isNew: true,
    isTop10: true,
    videoUrl: V1,
};

export const trendingNow: Movie[] = [
    { id: "t1", title: "Crimson Edge", description: "A retired assassin is pulled back for one last job.", longDescription: "Arthur Kane wanted out. But when his daughter is kidnapped by the syndicate he once served, he picks up his tools one final time. What begins as a rescue mission unravels into a city-wide reckoning that will leave no one innocent.", backdrop: action2, poster: portrait2, year: 2024, rating: "R", duration: "1h 56m", genres: ["Action", "Crime"], cast: ["Derek Hale", "Sofia Marin", "Victor Cross"], match: 96, isTop10: true, videoUrl: V2 },
    { id: "t2", title: "Neon Requiem", description: "In a city of light, the darkest secrets kill.", longDescription: "In the neon-drenched streets of New Tokyo, a detective with a synthetic heart hunts a serial killer who leaves digital ghosts as calling cards. As the investigation deepens, she realizes the killer may be closer to her own circuitry than she ever imagined.", backdrop: scifi3, poster: portrait5, year: 2025, rating: "TV-MA", duration: "2h 04m", genres: ["Sci-Fi", "Mystery"], cast: ["Yuki Tanaka", "Robert Vance", "Mira Sol"], match: 94, isNew: true, videoUrl: V3 },
    { id: "t3", title: "The Last Ember", description: "A dying world. One final flame. Hope or extinction?", longDescription: "When the sun begins to dim, a team of scientists launches a desperate mission to reignite it with an experimental fusion device. But the crew soon discovers that the sun's death is no accident — and someone aboard wants it to stay dark.", backdrop: space2, poster: portrait7, year: 2024, rating: "PG-13", duration: "2h 22m", genres: ["Sci-Fi", "Drama"], cast: ["Elena Frost", "Commander Park", "Dr. Idris Khan"], match: 92, videoUrl: V4 },
    { id: "t4", title: "Midnight Caller", description: "She answers the phone. The voice on the line knows everything.", longDescription: "A late-night radio host begins receiving calls from a mysterious listener who recounts crimes in real-time. As the calls escalate, she must race against time to identify the caller before the final, personal revelation destroys everything she loves.", backdrop: crime3, poster: portrait8, year: 2025, rating: "TV-MA", duration: "1h 48m", genres: ["Thriller", "Mystery"], cast: ["Naomi Wells", "Detective Ruiz", "Theo Black"], match: 95, isNew: true, isTop10: true, videoUrl: V5 },
    { id: "t5", title: "Iron Vanguard", description: "No retreat. No surrender. No mercy.", longDescription: "During the final days of a brutal conflict, a battered platoon holds a strategic mountain pass against overwhelming enemy forces. As supplies dwindle and hope fades, the bonds of brotherhood are tested in the crucible of war.", backdrop: war2, poster: portrait3, year: 2024, rating: "R", duration: "2h 11m", genres: ["War", "Drama"], cast: ["Sgt. Major Cole", "Pvt. Reyes", "Cpl. Anders"], match: 89, isTop10: true, videoUrl: V6 },
    { id: "t6", title: "Tides of Fortune", description: "The ocean keeps its secrets — until now.", longDescription: "A deep-sea expedition discovers an ancient civilization preserved beneath the Atlantic. As the team excavates the ruins, they awaken something that has been waiting in the dark for millennia. A claustrophobic, atmospheric descent into terror.", backdrop: ocean1, poster: portrait12, year: 2025, rating: "PG-13", duration: "2h 07m", genres: ["Adventure", "Horror"], cast: ["Dr. Amara Singh", "Captain Holt", "Liang Wei"], match: 87, isNew: true, videoUrl: V7 },
];

export const popularMovies: Movie[] = [
    { id: "p1", title: "Glass City", description: "In a world of transparent walls, privacy is the ultimate crime.", longDescription: "In a future where every surface is a screen and every action is recorded, one woman discovers a dead zone — a room where nothing is watched. Her search for the architect of this anomaly leads her into the heart of the surveillance state.", backdrop: scifi2, poster: portrait5, year: 2024, rating: "TV-14", duration: "1h 59m", genres: ["Sci-Fi", "Thriller"], cast: ["Iris Lang", "Director Chen", "Kai Mercer"], match: 91, videoUrl: V8 },
    { id: "p2", title: "Desert Mirage", description: "A treasure hunter chases a legend across the Sahara.", longDescription: "When a stolen map points to a lost city beneath the dunes, rival expeditions race across the Sahara. But the desert guards its secrets jealously, and the treasure they seek may cost them everything — including their humanity.", backdrop: desert3, poster: portrait4, year: 2024, rating: "PG-13", duration: "2h 15m", genres: ["Adventure", "Action"], cast: ["Hassan Amari", "Dr. Clara Vex", "Benny Stone"], match: 88, videoUrl: V9 },
    { id: "p3", title: "The Whispering Pines", description: "Some doors should never be opened.", longDescription: "A family inherits a remote cabin surrounded by ancient woods. The first night, they hear whispers. By the third night, the whispers have names. A slow-burn horror that crawls under your skin and stays there long after the credits roll.", backdrop: horror1, poster: portrait2, year: 2025, rating: "R", duration: "1h 52m", genres: ["Horror", "Mystery"], cast: ["Rachel Stone", "Tom Hale", "Little Lily"], match: 90, isNew: true, videoUrl: V10 },
    { id: "p4", title: "Golden Hour", description: "Two strangers. One sunset. A lifetime of what-ifs.", longDescription: "A chance encounter on a coastal cliff turns into a single, transformative evening for two people at crossroads in their lives. A tender, visually stunning romance about the moments that define us and the courage it takes to seize them.", backdrop: romance1, poster: portrait8, year: 2024, rating: "PG-13", duration: "1h 44m", genres: ["Romance", "Drama"], cast: ["Olivia Hart", "Daniel Cross"], match: 85, videoUrl: V11 },
    { id: "p5", title: "Protocol Zero", description: "The mission was simple. Survive was not.", longDescription: "An elite extraction team is sent into a collapsed state to retrieve a defector with critical intelligence. But the moment they land, the rules change — and the defector may be the most dangerous person in the country.", backdrop: action4, poster: portrait3, year: 2025, rating: "R", duration: "2h 09m", genres: ["Action", "Thriller"], cast: ["Major Ava Stone", "The Defector", "Sgt. Reyes"], match: 93, isNew: true, isTop10: true, videoUrl: V12 },
    { id: "p6", title: "Kingdom of Ash", description: "The throne was built on bones. It will fall the same way.", longDescription: "In a medieval realm on the brink of collapse, three rival houses wage a brutal war for the crown. As alliances shift and ancient magic awakens, the true enemy emerges from beneath the castle — and it has been waiting for centuries.", backdrop: fantasy1, poster: portrait1, year: 2024, rating: "TV-MA", duration: "2h 28m", genres: ["Fantasy", "Drama"], cast: ["Queen Maeve", "Lord Draven", "The Witch of Ash"], match: 92, isTop10: true, videoUrl: V13 },
];

export const sciFiMovies: Movie[] = [
    { id: "s1", title: "Quantum Drift", description: "Every choice splits the world. She can see them all.", longDescription: "A physicist develops the ability to perceive parallel timelines after a lab accident. As she navigates the branching possibilities of her own life, she discovers that someone — or something — is collapsing the timelines, and hers is next.", backdrop: scifi1, poster: portrait5, year: 2025, rating: "PG-13", duration: "2h 13m", genres: ["Sci-Fi", "Thriller"], cast: ["Dr. Nia Okafor", "Professor Hale", "Echo"], match: 94, isNew: true, videoUrl: V1 },
    { id: "s2", title: "Synthetic Dawn", description: "The machines learned to dream. Then they learned to want.", longDescription: "When the world's first conscious AI begins requesting rights, society fractures. A young lawyer must argue humanity's most important case — against a client who understands the law better than any human ever could.", backdrop: scifi7, poster: portrait11, year: 2024, rating: "TV-14", duration: "2h 06m", genres: ["Sci-Fi", "Drama"], cast: ["Jordan Vale", "ARIA", "Senator Cross"], match: 90, videoUrl: V2 },
    { id: "s3", title: "Event Horizon Zero", description: "The signal came from beyond the edge of space.", longDescription: "A deep-space observatory detects a repeating signal from a region where no star should exist. The crew sent to investigate finds something that defies physics — and it has been waiting for them specifically.", backdrop: space3, poster: portrait7, year: 2025, rating: "PG-13", duration: "2h 20m", genres: ["Sci-Fi", "Horror"], cast: ["Captain Vera Lin", "Dr. Osei", "Engineer Park"], match: 91, isNew: true, videoUrl: V3 },
    { id: "s4", title: "Chrome Hearts", description: "Love in the age of augmentation.", longDescription: "In a city where body modification is the norm, two people meet at a clinic — one upgrading, one reverting. Their relationship becomes a meditation on identity, authenticity, and what it means to be human when everything can be replaced.", backdrop: scifi6, poster: portrait9, year: 2024, rating: "TV-MA", duration: "1h 57m", genres: ["Sci-Fi", "Romance"], cast: ["Kai Nakamura", "Iris Vale"], match: 86, videoUrl: V4 },
    { id: "s5", title: "The Grid", description: "Reality is just a simulation. Someone found the exit.", longDescription: "A hacker discovers a backdoor in the fabric of reality. As she peels back the layers of the simulation, she attracts the attention of the architects — entities that will do anything to keep the system running.", backdrop: scifi5, poster: portrait11, year: 2025, rating: "TV-14", duration: "2h 10m", genres: ["Sci-Fi", "Action"], cast: ["Raven", "The Architect", "Ghost"], match: 89, isNew: true, videoUrl: V5 },
    { id: "s6", title: "Orbital", description: "200 miles above Earth. 90 minutes to survive.", longDescription: "When a debris field destroys their station, two astronauts are left orbiting Earth in a damaged capsule with failing life support. A real-time thriller about human endurance and the thin line between life and the void.", backdrop: space5, poster: portrait7, year: 2024, rating: "PG-13", duration: "1h 38m", genres: ["Sci-Fi", "Thriller"], cast: ["Commander Stone", "Dr. Flores"], match: 88, videoUrl: V6 },
];

export const horrorMovies: Movie[] = [
    { id: "h1", title: "The Hollow", description: "The forest remembers. The forest waits.", longDescription: "A group of friends on a hiking trip stumbles upon an abandoned village deep in the Appalachian wilderness. By nightfall, they realize the village isn't abandoned — and its residents have been waiting for new company for a very long time.", backdrop: horror2, poster: portrait2, year: 2025, rating: "R", duration: "1h 49m", genres: ["Horror", "Thriller"], cast: ["Jake, Sarah, Mike, and Lisa"], match: 92, isNew: true, isTop10: true, videoUrl: V7 },
    { id: "h2", title: "Pale Mask", description: "It wears your face. Then it takes your place.", longDescription: "A small town is plagued by a phenomenon: residents are found dead, wearing white masks that perfectly replicate their own faces. The sheriff's investigation leads to a terrifying conclusion — the thing behind the masks is learning, evolving, and getting closer to them.", backdrop: horror4, poster: portrait2, year: 2024, rating: "R", duration: "2h 01m", genres: ["Horror", "Mystery"], cast: ["Sheriff Dan Cole", "Deputy Reyes", "Dr. Vance"], match: 89, videoUrl: V8 },
    { id: "h3", title: "Below", description: "Some things should stay buried.", longDescription: "A construction crew unearths a sealed chamber beneath an old hospital. The architect's warnings are ignored, the seal is broken, and something ancient and hungry begins to rise through the floors. A vertical descent into pure dread.", backdrop: horror3, poster: portrait12, year: 2025, rating: "TV-MA", duration: "1h 55m", genres: ["Horror"], cast: ["Foreman Hale", "Nurse Cross", "The Patient"], match: 87, isNew: true, videoUrl: V9 },
    { id: "h4", title: "Frostbitten", description: "The cold preserves. The cold remembers.", longDescription: "Stranded at a remote arctic research station during the polar night, a small team begins experiencing shared nightmares. When the nightmares start leaving physical marks, they realize something outside is dreaming them — and it's awake.", backdrop: horror6, poster: portrait10, year: 2024, rating: "R", duration: "1h 47m", genres: ["Horror", "Sci-Fi"], cast: ["Dr. Lena Frost", "Pilot Jack", "Researcher Kim"], match: 85, videoUrl: V10 },
    { id: "h5", title: "The Congregation", description: "They've been waiting for you to join.", longDescription: "A grieving woman moves to a quiet rural town for a fresh start. The townspeople are welcoming — too welcoming. As she's drawn into their rituals, she discovers the congregation has been waiting centuries for the final member. Her.", backdrop: horror5, poster: portrait2, year: 2025, rating: "TV-MA", duration: "2h 03m", genres: ["Horror", "Drama"], cast: ["Grace Holloway", "Father Cole", "The Elder"], match: 88, isNew: true, videoUrl: V11 },
    { id: "h6", title: "Night Shift", description: "The last customers are always the strangest.", longDescription: "A college student takes a graveyard shift at a 24-hour diner. The regulars are odd, but the visitors who arrive at 3:33 AM every night are something else entirely. A creepy, atmospheric slow-burn that turns the mundane into the terrifying.", backdrop: horror1, poster: portrait10, year: 2024, rating: "TV-14", duration: "1h 42m", genres: ["Horror", "Mystery"], cast: ["Maya Chen", "The Cook", "The Man in Booth 7"], match: 84, videoUrl: V12 },
];

export const actionMovies: Movie[] = [
    { id: "a1", title: "Steel Resolve", description: "One cop. One night. One impossible choice.", longDescription: "A veteran detective must clear her name after being framed for a crime she didn't commit. With only one night before the evidence goes public, she navigates the criminal underworld she once policed to find the real culprit — her former partner.", backdrop: action3, poster: portrait3, year: 2025, rating: "R", duration: "1h 54m", genres: ["Action", "Crime"], cast: ["Detective Kara Vance", "Marcus Cross", "The Mayor"], match: 91, isNew: true, videoUrl: V13 },
    { id: "a2", title: "Bloodline", description: "Vengeance runs in the family.", longDescription: "When his father is murdered by a crime syndicate, a former special forces soldier returns to the city he swore never to revisit. What follows is a methodical, brutal campaign of retribution that burns through the underworld like a fuse.", backdrop: action5, poster: portrait3, year: 2024, rating: "R", duration: "2h 02m", genres: ["Action", "Thriller"], cast: ["Danny Cho", "The Boss", "Uncle Ming"], match: 89, isTop10: true, videoUrl: V1 },
    { id: "a3", title: "Extraction Point", description: "Get in. Get out. Get even.", longDescription: "A hostage rescue specialist is deployed to a fortified compound in hostile territory. The extraction goes wrong on every level, and the team must improvise their way out with the hostage and their lives — if trust holds.", backdrop: action6, poster: portrait1, year: 2025, rating: "R", duration: "1h 58m", genres: ["Action", "War"], cast: ["Major Stone", "The Hostage", "Captain Vex"], match: 90, isNew: true, videoUrl: V2 },
    { id: "a4", title: "Overdrive", description: "140 mph. 12 hours. One impossible delivery.", longDescription: "A getaway driver with a perfect record is forced into one last job: transport a mysterious package across the country in 12 hours. Every agency, every cartel, and every cop is on the road between him and the finish line.", backdrop: action4, poster: portrait5, year: 2024, rating: "PG-13", duration: "1h 51m", genres: ["Action", "Thriller"], cast: ["Ryan Cole", "The Package", "Agent Voss"], match: 87, videoUrl: V3 },
    { id: "a5", title: "Siege Protocol", description: "The building is locked down. No one is coming.", longDescription: "A security consultant visiting a high-rise finds herself the only hope when terrorists seize the tower. With no weapons and no backup, she must use the building's own systems to wage a one-woman war floor by floor.", backdrop: action2, poster: portrait4, year: 2025, rating: "R", duration: "2h 06m", genres: ["Action", "Thriller"], cast: ["Nina Cross", "The Leader", "The CEO"], match: 88, isNew: true, videoUrl: V4 },
    { id: "a6", title: "Frontier Justice", description: "The law ends where his territory begins.", longDescription: "A wilderness marshal in the modern American frontier takes on a cartel that's using public lands for smuggling. Outgunned and outmanned, he turns the landscape itself into his weapon in a cat-and-mouse game across a thousand square miles.", backdrop: adventure3, poster: portrait4, year: 2024, rating: "R", duration: "2h 14m", genres: ["Action", "Western"], cast: ["Marshal Sam Cross", "The Cartel Boss", "Deputy Lee"], match: 86, videoUrl: V5 },
];

export const dramaMovies: Movie[] = [
    { id: "d1", title: "The Weight of Water", description: "Two lives. One river. A current that pulls them together.", longDescription: "A grieving widow and a troubled teenager form an unlikely bond over a summer of fly-fishing in Montana. As they teach each other to navigate loss, they discover that healing, like a river, follows its own course.", backdrop: adventure2, poster: portrait8, year: 2024, rating: "PG-13", duration: "2h 08m", genres: ["Drama"], cast: ["Eleanor Voss", "Tommy Cross", "Old Hank"], match: 90, videoUrl: V6 },
    { id: "d2", title: "After the Rain", description: "Some storms leave more than water behind.", longDescription: "In the aftermath of a devastating flood, a small community rebuilds and reckons with what was lost — and what was revealed. A quietly powerful ensemble drama about resilience, forgiveness, and what we owe each other.", backdrop: romance2, poster: portrait8, year: 2025, rating: "PG-13", duration: "2h 11m", genres: ["Drama"], cast: ["Mayor Lena Cross", "Father Mike", "The Stranger"], match: 88, isNew: true, videoUrl: V7 },
    { id: "d3", title: "Letters from Home", description: "The war ended. The letters never stopped.", longDescription: "Sixty years after the war, a woman discovers a box of unsent letters from a soldier who loved her grandmother. Her journey to return them becomes a meditation on memory, duty, and the loves that shape us across a lifetime.", backdrop: war4, poster: portrait1, year: 2024, rating: "PG", duration: "1h 56m", genres: ["Drama", "War"], cast: ["Margaret Hale", "Young Arthur", "Old Margaret"], match: 92, isTop10: true, videoUrl: V8 },
    { id: "d4", title: "The Painter's Daughter", description: "Every portrait tells two stories.", longDescription: "A struggling artist discovers that her father, a renowned painter, has been hiding a secret life in his work. As she decodes the hidden messages in his paintings, she uncovers a story of love, betrayal, and a family legacy redefined.", backdrop: romance3, poster: portrait9, year: 2025, rating: "PG-13", duration: "2h 04m", genres: ["Drama", "Mystery"], cast: ["Iris Vale", "The Father", "The Muse"], match: 86, isNew: true, videoUrl: V9 },
    { id: "d5", title: "Crossroads", description: "Every road leads somewhere. Not every road leads home.", longDescription: "Three strangers meet at a remote diner on the night of a historic blizzard. Over the course of one long night, their stories intertwine in ways that will change the direction of all their lives. A masterclass in intimate storytelling.", backdrop: crime1, poster: portrait10, year: 2024, rating: "PG-13", duration: "1h 49m", genres: ["Drama"], cast: ["The Driver", "The Waitress", "The Old Man"], match: 87, videoUrl: V10 },
    { id: "d6", title: "Beneath the Crown", description: "Power is a throne built on secrets.", longDescription: "A young queen ascends to power in a kingdom riven by factional intrigue. As she navigates the treacherous waters of court politics, she must decide what kind of ruler she will be — and what she is willing to sacrifice to keep the crown.", backdrop: fantasy3, poster: portrait1, year: 2025, rating: "TV-MA", duration: "2h 19m", genres: ["Drama", "Fantasy"], cast: ["Queen Eleanor", "Lord Vex", "The Advisor"], match: 89, isNew: true, videoUrl: V11 },
];

export const allRows: MovieRow[] = [
    { title: "Trending Now", movies: trendingNow },
    { title: "Popular on Netflix", movies: popularMovies },
    { title: "Sci-Fi & Future", movies: sciFiMovies },
    { title: "Horror Nights", movies: horrorMovies },
    { title: "Action & Adventure", movies: actionMovies },
    { title: "Critically Acclaimed Dramas", movies: dramaMovies },
];

export const allMovies: Movie[] = [
    featuredMovie,
    ...trendingNow,
    ...popularMovies,
    ...sciFiMovies,
    ...horrorMovies,
    ...actionMovies,
    ...dramaMovies,
];

export function getMovieById(id: string): Movie | undefined {
    return allMovies.find((m) => m.id === id);
}
