export type SocialLink = {
  platform: string;
  url: string;
  icon?: string;
  order?: number;
  isActive?: boolean;
};

export type Settings = {
  SettingsID: number;
  Title: string;
  Description: string;
  Keywords: string;
  SiteName: string;
  SiteUrl: string;
  SiteLogo: string | null;
  Favicon: string | null;
  CoverImage: string | null;
  ContentUrl: string | null;
  HeaderScripts: string | null;
  AdsEnabled: boolean;
  GoogleAnalyticsID: string | null;
  GoogleTagManagerID: string | null;
  SearchConsoleMeta: string | null;
  BingVerification: string | null;
  DefaultOgImage: string | null;
  TwitterHandle: string | null;
  MetaAuthor: string | null;
  MetaRobots: string | null;
  FK_ThemeID: number | null;
  DefaultColorMode: "light" | "dark" | "system" | null;
  AllowColorToggle: boolean;
  ShowHeaderMenu: boolean;
  ShowFooterMenu: boolean;
  LlmsTxtEnabled: boolean;
  LlmsTxtIntro: string | null;
  SocialLinks: SocialLink[];
  AdsensePublisherID: string | null;
  AdsenseAutoAds: boolean;
  AdsenseExtraHead: string | null;
  IndexingEnabled: boolean;
  IndexingServiceAccountJSON: string | null;
  // Provider role assignments. NULL → fallback ("gemini" / "serpapi").
  MetaProvider: string | null;     // gemini | openai | anthropic
  ContentProvider: string | null;  // gemini | openai | anthropic
  TrendsProvider: string | null;   // serpapi
};

export type UserRole = "admin" | "editor" | "viewer";

export type User = {
  UserID: number;
  Email: string;
  Username: string | null;
  DisplayName: string | null;
  Role: UserRole;
  AvatarURL: string | null;
  LastLoginAt: Date | string | null;
  IsActive: boolean;
  CreatedDate: Date | string;
};

export type ApiKeyPurpose =
  | "news_source"
  | "trends_source"
  | "text_ai"
  | "image_ai";

export type ApiKey = {
  ApiKeyID: number;
  Provider: string;
  Purpose: ApiKeyPurpose;
  Label: string | null;
  KeyValue: string; // AES-GCM ciphertext
  Config: Record<string, unknown>;
  IsActive: boolean;
  CreatedDate: Date | string;
};

export type CronJobStatus = "ok" | "error" | "skipped" | null;

export type CronJobConfig = {
  // Common to news pipeline (NewsNow)
  newsCategory?: string;   // NewsNow category enum (BUSINESS, TECHNOLOGY, ...)
  location?: string;       // ISO-2 country
  language?: string;       // ISO-2 language
  page?: number;           // pagination cursor (default 1)

  // Article pipeline (SerpAPI + multi-provider AI)
  seedQuery?: string;            // "AI productivity tools"
  targetCatId?: number;          // site category to file articles under
  ideationBatchCount?: number;   // how many drafts to ideate per refill (10/20/30)
  trendsLocation?: string;       // ISO-2 country for SerpAPI
  trendsLanguage?: string;       // ISO-2 language for SerpAPI
  autoRefill?: boolean;          // when pending=0, auto-trigger ideation
  guidance?: string;             // optional tone/angle for the meta AI

  [key: string]: unknown;
};

export type CronJobKind = "news" | "article";

export type CronJob = {
  CronID: number;
  JobName: string;
  Kind: CronJobKind;
  FK_CatID: number | null;
  NewsProvider: string | null;
  TextAiProvider: string | null;
  ImageAiProvider: string | null;
  FrequencyCron: string;
  ArticlesPerRun: number;
  Config: CronJobConfig;
  LastRunAt: Date | string | null;
  LastRunStatus: CronJobStatus;
  LastRunMessage: string | null;
  NextRunAt: Date | string | null;
  IsActive: boolean;
  CreatedDate: Date | string;
};

export type ArticleDraftStatus =
  | "pending"
  | "processing"
  | "done"
  | "skipped"
  | "error";

export type ArticleDraft = {
  DraftID: string; // bigint as string from postgres
  FK_CronID: number | null;
  FK_CatID: number;
  Title: string;
  Summary: string | null;
  Keywords: string | null;
  ImagePrompt: string | null;
  Slug: string | null;
  TrendQuery: string | null;
  Status: ArticleDraftStatus;
  FK_ContentID: number | null;
  Message: string | null;
  CreatedAt: string;
  ProcessedAt: string | null;
  Fk_UserID: number | null;
};

export type Theme = {
  ThemeID: number;
  ThemeSlug: string;
  ThemeName: string;
  ThemeDesc: string | null;
  PreviewImage: string | null;
  Config: Record<string, unknown>;
  SupportsDark: boolean;
  IsActive: boolean;
};

export type IngestRun = {
  RunID: number;
  FK_CronID: number | null;
  FK_CatID: number | null;
  StartedAt: Date | string;
  FinishedAt: Date | string | null;
  Inserted: number;
  Skipped: number;
  Errored: number;
  Status: string | null;
  Log: string | null;
};

export type Category = {
  CatID: number;
  FK_LangID: number;
  CatName: string;
  CatTitle: string;
  CatKeywords: string | null;
  CatDesc: string | null;
  CatURL: string | null;
  CatSeo: string;
  CatImage: string | null;
  CatNumber: number;
  HeaderMenu: boolean;
  FooterMenu: boolean;
  SideMenu: boolean;
  DropdownMenu: boolean;
  IsActive: boolean;
  ParentCatID: number;
};

export type ContentSource = { href?: string; title?: string } | null;

export type Content = {
  ContentID: number;
  FK_CatID: number;
  FK_LangID: number;
  ContentTitle: string;
  ContentShort: string | null;
  ContentDetail: string | null;
  ContentAlternateTitle: string | null;
  ContentOriginalTitle: string | null;
  ContentKeywords: string | null;
  ContentDesc: string | null;
  ContentImage: string | null;
  ContentVideo: string | null;
  ContentSeo: string;
  ContentURL: string | null;
  ContentSource: ContentSource;
  Homepage: boolean;
  IsActive: boolean;
  PublishDate: Date | string;
  ModifiedDate?: Date | string | null;
  CreatedDate: Date | string;
  ImagePrompt?: string | null;
  ViewCount?: number;
  CatSeo?: string;
  CatName?: string;
  FK_AuthorID?: number | null;
  AuthorName?: string | null;
  AuthorSlug?: string | null;
  AuthorBio?: string | null;
  AuthorAvatarURL?: string | null;
};

export type Author = {
  AuthorID: number;
  DisplayName: string;
  Slug: string;
  Bio: string | null;
  AvatarURL: string | null;
  Email: string | null;
  FK_CatID: number | null;
  IsActive: boolean;
  CreatedDate: Date | string;
};

export type LinkRow = {
  LinkID: number;
  LinkTitle: string;
  Link: string | null;
  LinkIcon: string | null;
  LinkSeo: string | null;
  LinkContent: string | null;
  LinkNumber: number | null;
  TopMenu: boolean;
  Footer: boolean;
};

export type ContentListItem = Pick<
  Content,
  | "ContentID"
  | "FK_CatID"
  | "ContentTitle"
  | "ContentShort"
  | "ContentDesc"
  | "ContentImage"
  | "ContentSeo"
  | "PublishDate"
> & { CatSeo: string; CatName: string };
