import "server-only";

const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Margaret", "Anthony", "Betty", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Carol", "Kevin", "Amanda", "Brian", "Dorothy", "George", "Melissa",
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Laura",
  "Jeffrey", "Sharon", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen", "Stephen", "Anna",
  "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole", "Brandon", "Samantha",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
];

const BEAT_PHRASES: Record<string, string> = {
  business: "business and finance",
  technology: "technology and innovation",
  tech: "technology and innovation",
  politics: "politics and policy",
  world: "international affairs",
  sports: "sports",
  health: "health and wellness",
  science: "science and research",
  entertainment: "entertainment and culture",
  lifestyle: "lifestyle and culture",
  travel: "travel",
  opinion: "opinion and commentary",
  education: "education",
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type GeneratedAuthor = {
  displayName: string;
  slug: string;
  bio: string;
};

/** Generates a random American byline name + a one-line bio tied to the
 *  category beat. Caller is responsible for ensuring slug uniqueness on insert. */
export function generateRandomAuthor(args: {
  catSlug?: string | null;
  catName?: string | null;
  siteName: string;
}): GeneratedAuthor {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const displayName = `${first} ${last}`;
  const slugSuffix = Math.random().toString(36).slice(2, 6);
  const slug = `${slugify(displayName)}-${slugSuffix}`;

  const beatKey = (args.catSlug ?? args.catName ?? "").toLowerCase();
  const beat =
    BEAT_PHRASES[beatKey] ??
    (args.catName ? args.catName.toLowerCase() : "general news");
  const bio = `${displayName} covers ${beat} for ${args.siteName}.`;

  return { displayName, slug, bio };
}
